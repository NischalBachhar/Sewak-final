import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  collection,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  setDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  query,
  where,
  addDoc,
} from "firebase/firestore";
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
} from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { db, auth, functions } from "./firebaseConfig";
import { normalizeBooking } from "./bookingModel";
import { formatNpr } from "./config/brand";
import { SkeletonCard, VerificationBadge } from "./components/CareExperience";
import "./OrganizationDashboard.css";

const dashboardTabs = [
  "overview",
  "organizations",
  "caregivers",
  "bookings",
  "services",
  "blacklist",
  "admins",
  "analytics",
];

const PUBLIC_CAREGIVER_WRITE_BATCH_SIZE = 400;

const caregiverVerificationFields = [
  {
    key: "identity",
    label: "Identity",
    statusKey: "identityVerificationStatus",
    fallbackBooleanKey: "verified",
  },
  {
    key: "phone",
    label: "Phone",
    statusKey: "phoneVerificationStatus",
    evidenceKeys: ["phone", "phoneNumber", "mobile"],
  },
  {
    key: "training",
    label: "Training",
    statusKey: "trainingVerificationStatus",
    fallbackBooleanKey: "isCertified",
  },
  {
    key: "background",
    label: "Background",
    statusKey: "backgroundVerificationStatus",
    fallbackBooleanKey: "backgroundChecked",
  },
  {
    key: "references",
    label: "References",
    statusKey: "referencesVerificationStatus",
  },
];

function getCaregiverVerificationItems(caregiver) {
  return caregiverVerificationFields.map((field) => {
    const status = caregiver[field.statusKey];
    const fallback = field.fallbackBooleanKey
      ? caregiver[field.fallbackBooleanKey]
      : undefined;
    const hasSubmittedEvidence = Array.isArray(field.evidenceKeys)
      ? field.evidenceKeys.some((key) => {
          const value = caregiver[key];
          return typeof value === "string" && value.trim().length > 0;
        })
      : false;

    const hasRecordedStatus =
      status !== undefined && status !== null && status !== "";

    return {
      key: field.key,
      label: field.label,
      state:
        hasRecordedStatus
          ? status
          : typeof fallback === "boolean"
            ? fallback
            : hasSubmittedEvidence
              ? "pending"
            : undefined,
      badgeLabel:
        !hasRecordedStatus &&
        typeof fallback !== "boolean" &&
        hasSubmittedEvidence
          ? "Phone provided — review pending"
          : undefined,
    };
  });
}

function publicString(value, maximum) {
  return typeof value === "string" ? value.slice(0, maximum) : "";
}

function publicNumber(value, minimum, maximum, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum && number <= maximum
    ? number
    : fallback;
}

function publicList(value, maximum) {
  return Array.isArray(value) ? value.slice(0, maximum) : [];
}

function publicVerificationStatus(value) {
  return ["verified", "pending", "not_verified", "unavailable"].includes(value)
    ? value
    : "not_verified";
}

function isActiveOrganizationForTrial(organization) {
  return Boolean(
    organization &&
      organization.isApproved === true &&
      organization.isSuspended !== true &&
      organization.isBlacklisted !== true,
  );
}

function buildPublicCaregiverListing(caregiver, organizationActive) {
  const reviewCount = publicNumber(caregiver.reviewCount, 0, 1000000);
  const rating = reviewCount > 0
    ? publicNumber(caregiver.rating, 0, 5)
    : 0;

  return {
    caregiverId: caregiver.id,
    name: publicString(caregiver.name, 120),
    location: publicString(caregiver.location, 160),
    category: publicString(caregiver.category, 32),
    workType: publicString(caregiver.workType, 32),
    shifts: publicList(caregiver.shifts, 3),
    servicesOffered: publicList(caregiver.servicesOffered, 20),
    hourlyRate: publicNumber(caregiver.hourlyRate, 0, 1000000),
    experience: publicNumber(caregiver.experience, 0, 100),
    bio: publicString(caregiver.bio, 1000),
    jobsCompleted: publicNumber(caregiver.jobsCompleted, 0, 1000000),
    rating,
    reviewCount,
    verified: caregiver.verified === true,
    backgroundChecked: caregiver.backgroundChecked === true,
    isCertified: caregiver.isCertified === true,
    isAvailable: caregiver.isAvailable === true,
    isApproved: true,
    isSuspended: false,
    isBlacklisted: false,
    isOrganizationActive: organizationActive === true,
    organizationId: publicString(caregiver.organizationId, 128),
    organizationName: publicString(caregiver.organizationName, 160),
    identityVerificationStatus: publicVerificationStatus(
      caregiver.identityVerificationStatus,
    ),
    phoneVerificationStatus: publicVerificationStatus(
      caregiver.phoneVerificationStatus,
    ),
    trainingVerificationStatus: publicVerificationStatus(
      caregiver.trainingVerificationStatus,
    ),
    backgroundVerificationStatus: publicVerificationStatus(
      caregiver.backgroundVerificationStatus,
    ),
    referencesVerificationStatus: publicVerificationStatus(
      caregiver.referencesVerificationStatus,
    ),
    updatedAt: serverTimestamp(),
  };
}

function DashboardLoadingState({ label, cards = 3 }) {
  return (
    <section aria-busy="true" aria-live="polite" style={{ padding: "8px 0" }}>
      <p style={{ color: "var(--theme-text-muted)", margin: "0 0 14px" }}>
        {label}
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "16px",
        }}
      >
        {Array.from({ length: cards }, (_, index) => (
          <SkeletonCard
            key={index}
            variant="dashboard"
            lines={3}
            label={label}
          />
        ))}
      </div>
    </section>
  );
}

export default function AdminDashboardPage() {
  // ============ AUTH STATE ============
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [permissionsError, setPermissionsError] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // ============ UI STATE ============
  const [activeTab, setActiveTab] = useState("overview");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // ============ ORGANIZATIONS ============
  const [organizations, setOrganizations] = useState([]);
  const [loadingOrganizations, setLoadingOrganizations] = useState(true);
  const [orgStatusFilter, setOrgStatusFilter] = useState("all");
  const [searchOrg, setSearchOrg] = useState("");
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [organizationApplications, setOrganizationApplications] = useState([]);

  const [showAddOrgForm, setShowAddOrgForm] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgAdminName, setNewOrgAdminName] = useState("");
  const [newOrgEmail, setNewOrgEmail] = useState("");
  const [newOrgPhone, setNewOrgPhone] = useState("");
  const [newOrgAddress, setNewOrgAddress] = useState("");
  const [newOrgCity, setNewOrgCity] = useState("");
  const [addingOrg, setAddingOrg] = useState(false);

  const [editingOrg, setEditingOrg] = useState(null);
  const [editOrgName, setEditOrgName] = useState("");
  const [editOrgAdminName, setEditOrgAdminName] = useState("");
  const [editOrgEmail, setEditOrgEmail] = useState("");
  const [editOrgPhone, setEditOrgPhone] = useState("");
  const [editOrgAddress, setEditOrgAddress] = useState("");
  const [editOrgCity, setEditOrgCity] = useState("");
  const [editOrgCommission, setEditOrgCommission] = useState(15);
  const [showEditOrgModal, setShowEditOrgModal] = useState(false);
  const [showOrgPasswordModal, setShowOrgPasswordModal] = useState(false);
  const [orgPasswordOrg, setOrgPasswordOrg] = useState(null);

  // ============ CAREGIVERS ============
  const [vendors, setVendors] = useState([]);
  const [orgCaregivers, setOrgCaregivers] = useState([]);
  const [showOrgCaregiversModal, setShowOrgCaregiversModal] = useState(false);
  const [loadingVendors, setLoadingVendors] = useState(false);
  const [syncingPublicCaregivers, setSyncingPublicCaregivers] = useState(false);
  const [publicCaregiverSyncProgress, setPublicCaregiverSyncProgress] =
    useState("");
  const [vendorStatusFilter, setVendorStatusFilter] = useState("all");
  const [searchVendor, setSearchVendor] = useState("");
  const [showCaregiverPasswordModal, setShowCaregiverPasswordModal] =
    useState(false);
  const [caregiverPasswordUser, setCaregiverPasswordUser] = useState(null);

  const [showCaregiverBlacklistModal, setShowCaregiverBlacklistModal] =
    useState(false);
  const [caregiverBlacklistUser, setCaregiverBlacklistUser] = useState(null);
  const [caregiverBlacklistReason, setCaregiverBlacklistReason] = useState("");

  // ============ SUPER ADMINS ============
  const [superAdmins, setSuperAdmins] = useState([]);
  const [showAddSuperAdminForm, setShowAddSuperAdminForm] = useState(false);
  const [newSuperAdminName, setNewSuperAdminName] = useState("");
  const [newSuperAdminEmail, setNewSuperAdminEmail] = useState("");
  const [addingSuperAdmin, setAddingSuperAdmin] = useState(false);
  const [provisioningInvitation, setProvisioningInvitation] = useState("");

  // ============ BOOKINGS ============
  const [bookings, setBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [bookingStatusFilter, setBookingStatusFilter] = useState("");
  const [bookingDateFilter, setBookingDateFilter] = useState("");

  // ============ SERVICES ============
  const [services, setServices] = useState([]);
  const [newServiceLabel, setNewServiceLabel] = useState("");
  const [newServiceCategory, setNewServiceCategory] = useState("caregiver");
  const [editingService, setEditingService] = useState(null);
  const [editServiceLabel, setEditServiceLabel] = useState("");

  // ============ BLACKLIST ============
  const [blacklistReports, setBlacklistReports] = useState([]);
  const [blacklistFilter, setBlacklistFilter] = useState("pending");
  const [blacklist, setBlacklist] = useState([]);
  const [showOrgBlacklistModal, setShowOrgBlacklistModal] = useState(false);
  const [orgBlacklistOrg, setOrgBlacklistOrg] = useState(null);
  const [orgBlacklistReason, setOrgBlacklistReason] = useState("");

  // ============ SETTINGS ============
  const [globalCommissionRate, setGlobalCommissionRate] = useState(15);
  const [editingCommission, setEditingCommission] = useState(false);

  // ============ ANALYTICS ============
  const [analytics, setAnalytics] = useState({
    totalOrganizations: 0,
    approvedOrganizations: 0,
    totalCaregivers: 0,
    approvedCaregivers: 0,
    totalBookings: 0,
    completedBookings: 0,
    totalRevenue: 0,
    platformEarnings: 0,
  });

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const parts = location.pathname.split("/").filter(Boolean);
    const lastSegment = parts[parts.length - 1];
    const newTab = dashboardTabs.includes(lastSegment)
      ? lastSegment
      : "overview";

    if (newTab !== activeTab) {
      setActiveTab(newTab);
    }
  }, [location.pathname, activeTab]);

  // ============ LOAD ALL DATA ============
  const calculateAnalytics = useCallback(async (organizationsData = []) => {
    try {
      const vendorSnap = await getDocs(collection(db, "vendors"));
      const vendorsData = vendorSnap.docs.map((d) => d.data());

      const bookingSnap = await getDocs(collection(db, "bookings"));
      const bookingsData = bookingSnap.docs.map((d) => d.data());

      const totalRevenue = bookingsData
        .filter((b) => b.status === "completed")
        .reduce((sum, b) => sum + (b.totalAmount || 0), 0);

      const platformEarnings = bookingsData
        .filter((b) => b.status === "completed")
        .reduce((sum, b) => sum + (b.platformCommission || 0), 0);

      setAnalytics({
        totalOrganizations: organizationsData.length,
        approvedOrganizations: organizationsData.filter((o) => o.isApproved).length,
        totalCaregivers: vendorsData.length,
        approvedCaregivers: vendorsData.filter((v) => v.isApproved).length,
        totalBookings: bookingsData.length,
        completedBookings: bookingsData.filter((b) => b.status === "completed")
          .length,
        totalRevenue,
        platformEarnings,
      });
  } catch (err) {
    console.error("Unexpected error loading dashboard:", err);
    setError("Failed to load dashboard data");
    setLoadingOrganizations(false);
  }
  }, []);

  const loadAllData = useCallback(async () => {
    let orgsData = [];

    try {
      // Organizations
      try {
        setLoadingOrganizations(true);
        const orgSnap = await getDocs(collection(db, "organizations"));
        orgsData = orgSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setOrganizations(orgsData);
        setLoadingOrganizations(false);
      } catch (err) {
        console.error("Error loading organizations:", err);
        setError("Failed to load organizations");
      } finally {
        setLoadingOrganizations(false);
      }

      // Pending public partner applications are deliberately separate from
      // organization accounts until a super-admin issues the org claim.
      try {
        const applicationSnap = await getDocs(
          collection(db, "organizationApplications"),
        );
        setOrganizationApplications(
          applicationSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        );
      } catch (err) {
        console.error("Error loading organization applications:", err);
        setError(
          err?.code === "permission-denied"
            ? "Partner applications are temporarily unavailable while secure access rules are being updated."
            : "We couldn't load partner applications right now. Please try again.",
        );
      }

      // Vendors
      setLoadingVendors(true);
      try {
        const vendorSnap = await getDocs(collection(db, "vendors"));
        const vendorsData = vendorSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setVendors(vendorsData);
      } catch (err) {
        console.error("Error loading vendors:", err);
        setError("Failed to load caregivers");
      } finally {
        setLoadingVendors(false);
      }

      // Bookings
      setLoadingBookings(true);
      try {
        const bookingSnap = await getDocs(collection(db, "bookings"));
        const bookingsData = bookingSnap.docs.map((d) =>
          normalizeBooking({ id: d.id, ...d.data() }),
        );
        setBookings(bookingsData);
      } catch (err) {
        console.error("Error loading bookings:", err);
        setError("Failed to load bookings");
      } finally {
        setLoadingBookings(false);
      }

      // Services
      try {
        const servicesSnap = await getDocs(collection(db, "services"));
        const servicesData = servicesSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setServices(servicesData);
      } catch (err) {
        console.error("Error loading services:", err);
      }

      // Blacklist reports
      try {
        const reportsSnap = await getDocs(collection(db, "blacklistReports"));
        setBlacklistReports(
          reportsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        );
      } catch (err) {
        console.error("Error loading blacklist reports:", err);
      }

      // Blacklist
      try {
        const blacklistSnap = await getDocs(collection(db, "blacklist"));
        setBlacklist(
          blacklistSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        );
      } catch (err) {
        console.error("Error loading blacklist:", err);
      }

      // Superadmins
      try {
        const usersSnap = await getDocs(collection(db, "users"));
        const allUsers = usersSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        const superAdminList = allUsers.filter((u) => u.role === "superadmin");
        setSuperAdmins(superAdminList);
      } catch (err) {
        console.error("Error loading superadmins:", err);
        setError("Failed to load superadmins: " + err.message);
      }

      // Commission
      try {
        const settingsSnap = await getDoc(doc(db, "settings", "commission"));
        if (settingsSnap.exists()) {
          setGlobalCommissionRate(settingsSnap.data().rate || 15);
        }
      } catch (err) {
        console.error("Error loading commission settings:", err);
      }

      // Analytics
      await calculateAnalytics(orgsData);
    } catch (err) {
      console.error("Unexpected error loading dashboard:", err);
      setError("Failed to load dashboard data");
    }
  }, [calculateAnalytics]);

  // ============ EFFECT: AUTH CHECK ============
  useEffect(() => {
    let cancelled = false;

    setLoadingAuth(true);
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user || cancelled) {
        setPermissionsError("Please log in to access the Admin Dashboard.");
        setCurrentUser(null);
        setUserRole(null);
        setIsSuperAdmin(false);
        setLoadingAuth(false);
        return;
      }

      setCurrentUser(user);

      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));

        if (!userDoc.exists() || cancelled) {
          setPermissionsError(
            "User profile not found. Please contact support.",
          );
          setIsSuperAdmin(false);
          setLoadingAuth(false);
          return;
        }

        const userData = userDoc.data();
        setUserRole(userData.role);

        if (userData.role !== "superadmin") {
          setPermissionsError(
            `Access Denied: You are logged in as "${userData.role}". Only superadmin accounts can access this dashboard.`,
          );
          setIsSuperAdmin(false);
          setLoadingAuth(false);
          return;
        }

        setIsSuperAdmin(true);
        setPermissionsError("");
        setLoadingAuth(false);

        await loadAllData();
      } catch (err) {
        console.error("Error verifying user role:", err);
        setPermissionsError(`Permission verification failed: ${err.message}`);
        setIsSuperAdmin(false);
        setLoadingAuth(false);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [loadAllData]);

  // ============ HANDLERS: ORGANIZATIONS ============
  const handleOrgClick = async (org) => {
    setSelectedOrg(org);
    try {
      const q = query(
        collection(db, "vendors"),
        where("organizationId", "==", org.id),
      );
      const snap = await getDocs(q);
      setOrgCaregivers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setShowOrgCaregiversModal(true);
    } catch (err) {
      console.error("Error loading organization caregivers:", err);
      setError("Failed to load caregivers");
    }
  };

  const handleCreateOrganization = async (e) => {
    e.preventDefault();
    setError("");
    setProvisioningInvitation("");
    setAddingOrg(true);

    try {
      const provision = httpsCallable(functions, "provisionOrganizationAccount");
      const result = await provision({
        email: newOrgEmail,
        displayName: newOrgAdminName,
        organizationName: newOrgName,
        businessPhone: newOrgPhone,
        businessAddress: newOrgAddress,
        businessCity: newOrgCity,
      });
      const invitation = result.data?.invitation?.passwordResetLink || "";
      setProvisioningInvitation(invitation);
      setSuccessMessage(invitation
        ? "Organization account provisioned. Send the one-time invitation link using an approved secure channel."
        : "Organization account provisioned. Configure Firebase Auth email delivery before inviting this administrator.");
      setNewOrgName("");
      setNewOrgAdminName("");
      setNewOrgEmail("");
      setNewOrgPhone("");
      setNewOrgAddress("");
      setNewOrgCity("");
      setShowAddOrgForm(false);

      await loadAllData();
    } catch (err) {
      console.error("Error creating organization:", err);
      setError("Failed to create organization: " + err.message);
    }
    setAddingOrg(false);
  };

  const handleStartEditOrg = (org) => {
    setEditingOrg(org);
    setEditOrgName(org.organizationName || "");
    setEditOrgAdminName(org.adminName || "");
    setEditOrgEmail(org.email || org.adminEmail || "");
    setEditOrgPhone(org.businessPhone || org.phone || "");
    setEditOrgAddress(org.businessAddress || org.address || "");
    setEditOrgCity(org.businessCity || org.city || "");
    setEditOrgCommission(org.commissionRate ?? 15);
    setShowEditOrgModal(true);
  };

  const handleCancelEditOrg = () => {
    setEditingOrg(null);
    setShowEditOrgModal(false);
  };

  const handleUpdateOrganization = async (e) => {
    e.preventDefault();
    if (!editingOrg) return;
    setError("");

    try {
      await updateDoc(doc(db, "organizations", editingOrg.id), {
        organizationName: editOrgName,
        adminName: editOrgAdminName,
        adminEmail: editOrgEmail,
        businessPhone: editOrgPhone,
        businessAddress: editOrgAddress,
        businessCity: editOrgCity,
        commissionRate: Number(editOrgCommission) || 15,
        updatedAt: serverTimestamp(),
      });

      try {
        await updateDoc(doc(db, "users", editingOrg.id), {
          organizationName: editOrgName,
          name: editOrgAdminName,
          email: editOrgEmail,
          businessPhone: editOrgPhone,
          businessAddress: editOrgAddress,
          businessCity: editOrgCity,
          updatedAt: serverTimestamp(),
        });
      } catch (userErr) {
        console.warn(
          "Org user doc not updated (may not exist with same id):",
          userErr,
        );
      }

      setSuccessMessage("Organization updated successfully!");
      setEditingOrg(null);
      setShowEditOrgModal(false);
      await loadAllData();
    } catch (err) {
      console.error("Error updating organization", err);
      setError("Failed to update organization: " + err.message);
    }
  };

  const handleOpenOrgPasswordModal = async (org) => {
    const recipientEmail = org?.adminEmail || org?.email;
    if (!recipientEmail) {
      setError("This organization does not have an email address for a password reset.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, recipientEmail);
      setSuccessMessage(`A password reset email was sent to ${recipientEmail}. No password was collected or stored by Sewak.`);
    } catch (resetError) {
      setError(`Could not send a password reset email: ${resetError.message}`);
    }
  };

  const handleOpenOrgBlacklistModal = (org) => {
    setOrgBlacklistOrg(org);
    setOrgBlacklistReason("");
    setShowOrgBlacklistModal(true);
  };

  const runAccountSafetyAction = async (payload) => {
    const applySafetyAction = httpsCallable(
      functions,
      "applyAccountSafetyAction",
    );
    const response = await applySafetyAction(payload);
    const result = response?.data || {};

    if (result.authRevocationStatus === "partial") {
      setError(
        "Safety restrictions were saved, but Firebase Authentication revocation could not be completed. Retry this action before treating account access as revoked.",
      );
      return { complete: false, result };
    }

    if (result.caregiverCascadeStatus === "partial") {
      setError(
        "The organization is blocked from bookings and active care, but some caregiver safety records still need a retry. Re-run this action before treating the staff cascade as complete.",
      );
      return { complete: false, result };
    }

    return { complete: true, result };
  };

  const handleSubmitOrgBlacklist = async (e) => {
    e.preventDefault();
    if (!orgBlacklistOrg) return;

    try {
      const outcome = await runAccountSafetyAction({
        targetType: "organization",
        targetId: orgBlacklistOrg.id,
        reason:
          orgBlacklistReason.trim() ||
          "Organization suspended and blacklisted by Sewak operations.",
      });

      if (!outcome.complete) {
        await loadAllData();
        return;
      }

      setSuccessMessage(
        outcome.result.caregiverAuthRevocationDeferred
          ? "Organization safety action applied. Its admin account is revoked, caregiver work access is blocked, and staff credential revocation is continuing securely in the background."
          : "Organization safety action applied. Its admin account is revoked and caregiver work access is blocked.",
      );
      setShowOrgBlacklistModal(false);
      setOrgBlacklistOrg(null);
      setOrgBlacklistReason("");
      await loadAllData();
    } catch (err) {
      console.error("Error blacklisting organization:", err);
      setError("Failed to blacklist organization: " + err.message);
    }
  };

  const handleApproveOrganization = async (orgId) => {
    const organization = organizations.find((item) => item.id === orgId);
    if (organization?.isSuspended || organization?.isBlacklisted) {
      setError("A suspended or blacklisted organization cannot be approved.");
      return;
    }

    try {
      const approveOrganization = httpsCallable(functions, "approveOrganizationAccount");
      await approveOrganization({ organizationId: orgId });
      setSuccessMessage("Organization approved and its secure organization-admin claim was updated.");
      await loadAllData();
    } catch (err) {
      // Cloud Functions require Blaze. For the free-tier investor trial a
      // superadmin may activate only this existing organization record; this
      // does not issue any custom claim or create a privileged account.
      try {
        await updateDoc(doc(db, "organizations", orgId), {
          isApproved: true,
          verified: true,
          isSuspended: false,
          isBlacklisted: false,
          approvedAt: serverTimestamp(),
          approvedBy: currentUser?.email || "superadmin",
          updatedAt: serverTimestamp(),
        });
        setSuccessMessage(
          "Organization approved for the free-tier trial. Publish its approved caregivers next.",
        );
        await loadAllData();
      } catch (fallbackError) {
        console.error("Error approving organization:", err, fallbackError);
        setError("Failed to approve organization: " + fallbackError.message);
      }
    }
  };

  const handleApproveOrganizationApplication = async (applicationId) => {
    try {
      const approveApplication = httpsCallable(
        functions,
        "approveOrganizationApplication",
      );
      await approveApplication({ applicationId });
      setSuccessMessage(
        "Organization application approved and secure organization access was issued.",
      );
      await loadAllData();
    } catch (err) {
      console.error("Error approving organization application:", err);
      setError("Failed to approve organization application: " + err.message);
    }
  };

  const handleRejectOrganization = async (orgId) => {
    const reason = window.prompt("Enter rejection reason");
    if (!reason) return;
    try {
      const outcome = await runAccountSafetyAction({
        targetType: "organization",
        targetId: orgId,
        reason,
      });
      if (!outcome.complete) {
        await loadAllData();
        return;
      }
      setSuccessMessage(
        outcome.result.caregiverAuthRevocationDeferred
          ? "Organization rejected. Its admin account is revoked, caregiver work access is blocked, and staff credential revocation is continuing securely in the background."
          : "Organization rejected. Its admin account is revoked and caregiver work access is blocked.",
      );
      await loadAllData();
    } catch (err) {
      console.error("Error rejecting organization:", err);
      setError("Failed to reject organization: " + err.message);
    }
  };

  // ============ HANDLERS: CAREGIVERS ============
  const handleApproveCaregiverClick = async (caregiverId) => {
    try {
      const now = serverTimestamp();
      await updateDoc(doc(db, "vendors", caregiverId), {
        isApproved: true,
        approvedAt: now,
        approvedBy: currentUser?.email || "superadmin",
      });
      try {
        await updateDoc(doc(db, "users", caregiverId), { isApproved: true });
      } catch {
        // users doc may not exist
      }
      setVendors((prev) =>
        prev.map((vendor) =>
          vendor.id === caregiverId
            ? {
                ...vendor,
                isApproved: true,
                approvedAt: now,
                approvedBy: currentUser?.email || "superadmin",
              }
            : vendor,
        ),
      );
      setSuccessMessage("Caregiver approved successfully!");
      if (selectedOrg) await handleOrgClick(selectedOrg);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      console.error("Error approving caregiver:", err);
      setError("Failed to approve caregiver: " + err.message);
    }
  };

  /* Legacy paid-plan Function sync retained as reference. The Spark trial uses
     the direct, schema-validated publisher immediately below. */
  /*
  const handleSyncPublicCaregiverListings = async () => {
    if (!isSuperAdmin) return;

    const confirmed = window.confirm(
      "Publish the approved caregiver directory now? This copies only safe profile fields; phone, email, earnings, and addresses stay private.",
    );
    if (!confirmed) return;

    setError("");
    setSuccessMessage("");
    setSyncingPublicCaregivers(true);
    setPublicCaregiverSyncProgress("Preparing the public caregiver directory…");

    try {
      const backfillPublicCaregivers = httpsCallable(
        functions,
        "backfillPublicCaregivers",
      );
      let cursor = "";
      let totalProcessed = 0;

      for (let page = 0; page < MAX_PUBLIC_CAREGIVER_SYNC_PAGES; page += 1) {
        const result = await backfillPublicCaregivers({
          limit: PUBLIC_CAREGIVER_SYNC_BATCH_SIZE,
          ...(cursor ? { cursor } : {}),
        });
        const data = result?.data || {};
        const processed = Number(data.processed);
        const nextCursor = data.nextCursor;

        if (
          !Number.isInteger(processed) ||
          processed < 0 ||
          processed > PUBLIC_CAREGIVER_SYNC_BATCH_SIZE
        ) {
          throw new Error("The listing sync returned an invalid progress response.");
        }

        totalProcessed += processed;

        if (!nextCursor) {
          setPublicCaregiverSyncProgress("");
          setSuccessMessage(
            `Public caregiver listings synced. ${totalProcessed} caregiver profile${
              totalProcessed === 1 ? "" : "s"
            } processed.`,
          );
          await loadAllData();
          return;
        }

        if (typeof nextCursor !== "string" || nextCursor === cursor) {
          throw new Error("The listing sync could not safely continue to its next page.");
        }

        cursor = nextCursor;
        setPublicCaregiverSyncProgress(
          `Syncing public listings… ${totalProcessed} caregiver profile${
            totalProcessed === 1 ? "" : "s"
          } processed.`,
        );
      }

      throw new Error(
        "The listing sync reached its safety limit. Run it again to continue.",
      );
    } catch (err) {
      console.error("Error syncing public caregiver listings:", err);

      if (
        typeof err?.message === "string" &&
        err.message.startsWith("The listing sync")
      ) {
        setError(err.message);
      } else if (err?.code === "functions/permission-denied") {
        setError(
          "Your Firebase session does not have the required superadmin permission. Sign out and back in after the secure superadmin claim is set.",
        );
      } else if (err?.code === "functions/unauthenticated") {
        setError(
          "Firebase could not verify this secure sync request. Refresh your sign-in after Firebase App Check is configured, then try again.",
        );
      } else if (err?.code === "functions/not-found") {
        setError(
          "Public listing sync is not deployed yet. Enable Cloud Functions API and deploy the Firebase Functions before trying again.",
        );
      } else {
        setError(
          "Could not sync public caregiver listings. Check the Firebase Functions and App Check deployment, then try again.",
        );
      }
    } finally {
      setSyncingPublicCaregivers(false);
      setPublicCaregiverSyncProgress("");
    }
  };

  */
  const handlePublishTrialCaregiverListings = async () => {
    if (!isSuperAdmin) return;

    const confirmed = window.confirm(
      "Publish the approved caregiver directory now? This copies only safe profile fields; phone, email, earnings, and addresses stay private.",
    );
    if (!confirmed) return;

    setError("");
    setSuccessMessage("");
    setSyncingPublicCaregivers(true);
    setPublicCaregiverSyncProgress("Preparing public caregiver listings…");

    try {
      const organizationsById = new Map(
        organizations.map((organization) => [organization.id, organization]),
      );
      const existingPublicListings = await getDocs(
        collection(db, "publicCaregivers"),
      );
      const writes = [];
      let published = 0;

      vendors.forEach((caregiver) => {
        const organizationId = publicString(caregiver.organizationId, 128);
        const organizationActive = organizationId
          ? isActiveOrganizationForTrial(organizationsById.get(organizationId))
          : true;
        const eligible =
          caregiver.isApproved === true &&
          caregiver.isSuspended !== true &&
          caregiver.isBlacklisted !== true &&
          organizationActive;

        if (eligible) {
          writes.push({
            type: "set",
            ref: doc(db, "publicCaregivers", caregiver.id),
            data: buildPublicCaregiverListing(caregiver, organizationActive),
          });
          published += 1;
        }
      });

      const eligibleIds = new Set(
        writes.filter((entry) => entry.type === "set").map((entry) => entry.ref.id),
      );
      existingPublicListings.docs.forEach((listing) => {
        if (!eligibleIds.has(listing.id)) {
          writes.push({ type: "delete", ref: listing.ref });
        }
      });

      for (
        let offset = 0;
        offset < writes.length;
        offset += PUBLIC_CAREGIVER_WRITE_BATCH_SIZE
      ) {
        const batch = writeBatch(db);
        const chunk = writes.slice(
          offset,
          offset + PUBLIC_CAREGIVER_WRITE_BATCH_SIZE,
        );
        chunk.forEach((entry) => {
          if (entry.type === "set") {
            batch.set(entry.ref, entry.data);
          } else {
            batch.delete(entry.ref);
          }
        });
        await batch.commit();
        setPublicCaregiverSyncProgress(
          `Publishing public listings… ${Math.min(offset + chunk.length, writes.length)} of ${writes.length} changes saved.`,
        );
      }

      setSuccessMessage(
        `${published} approved caregiver profile${published === 1 ? "" : "s"} published for Browse.`,
      );
      await loadAllData();
    } catch (err) {
      console.error("Error publishing trial caregiver listings:", err);
      setError(
        err?.code === "permission-denied"
          ? "Your session is not allowed to publish public caregiver listings. Sign out and back in as a superadmin."
          : "Could not publish public caregiver listings. Please try again.",
      );
    } finally {
      setSyncingPublicCaregivers(false);
      setPublicCaregiverSyncProgress("");
    }
  };

  const handleRejectCaregiverClick = async (caregiverId) => {
    const reason = window.prompt("Enter rejection reason:");
    if (!reason) return;

    try {
      const outcome = await runAccountSafetyAction({
        targetType: "caregiver",
        targetId: caregiverId,
        reason,
      });
      if (!outcome.complete) {
        await loadAllData();
        return;
      }
      setSuccessMessage("Caregiver rejected and account access revoked.");
      if (selectedOrg) await handleOrgClick(selectedOrg);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      console.error("Error rejecting caregiver:", err);
      setError("Failed to reject caregiver: " + err.message);
    }
  };

  const handleStartEditCaregiver = (caregiver) => {
    setSelectedOrg(null);
    setOrgCaregivers([caregiver]);
    // You can extend this to open a dedicated edit modal if needed.
  };

  const handleOpenCaregiverPasswordModal = async (caregiver) => {
    if (!caregiver?.email) {
      setError("This caregiver does not have an email address for a password reset.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, caregiver.email);
      setSuccessMessage(`A password reset email was sent to ${caregiver.email}. No password was collected or stored by Sewak.`);
    } catch (resetError) {
      setError(`Could not send a password reset email: ${resetError.message}`);
    }
  };

  const handleOpenCaregiverBlacklistModal = (caregiver) => {
    setCaregiverBlacklistUser(caregiver);
    setCaregiverBlacklistReason("");
    setShowCaregiverBlacklistModal(true);
  };

  const handleSubmitCaregiverBlacklist = async (e) => {
    e.preventDefault();
    if (!caregiverBlacklistUser?.id) return;

    try {
      const outcome = await runAccountSafetyAction({
        targetType: "caregiver",
        targetId: caregiverBlacklistUser.id,
        reason:
          caregiverBlacklistReason.trim() ||
          "Caregiver suspended and blacklisted by Sewak operations.",
      });

      if (!outcome.complete) {
        await loadAllData();
        return;
      }

      setSuccessMessage("Caregiver safety action applied and account access revoked.");
      setShowCaregiverBlacklistModal(false);
      setCaregiverBlacklistUser(null);
      setCaregiverBlacklistReason("");

      await loadAllData();
    } catch (err) {
      console.error("Error blacklisting caregiver:", err);
      setError("Failed to blacklist caregiver: " + err.message);
    }
  };

  // ============ HANDLERS: SUPER ADMINS ============
  const handleCreateSuperAdmin = async (e) => {
    e.preventDefault();
    setError("");
    setProvisioningInvitation("");
    setAddingSuperAdmin(true);

    try {
      const provision = httpsCallable(functions, "provisionSuperAdminAccount");
      const result = await provision({
        email: newSuperAdminEmail,
        displayName: newSuperAdminName,
      });
      const invitation = result.data?.invitation?.passwordResetLink || "";
      setProvisioningInvitation(invitation);
      setSuccessMessage(invitation
        ? "Superadmin account provisioned. Send the one-time invitation link using an approved secure channel."
        : "Superadmin account provisioned. Configure Firebase Auth email delivery before inviting this administrator.");
      setNewSuperAdminName("");
      setNewSuperAdminEmail("");
      setShowAddSuperAdminForm(false);

      const usersSnap = await getDocs(collection(db, "users"));
      const allUsers = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setSuperAdmins(allUsers.filter((u) => u.role === "superadmin"));
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      console.error("Error creating superadmin:", err);
      setError("Failed to create superadmin: " + err.message);
    }
    setAddingSuperAdmin(false);
  };

  // ============ HANDLERS: SERVICES ============
  const handleAddService = async (e) => {
    e.preventDefault();
    if (!newServiceLabel.trim()) {
      setError("Service label cannot be empty");
      return;
    }

    try {
      await addDoc(collection(db, "services"), {
        label: newServiceLabel,
        category: newServiceCategory,
        createdAt: serverTimestamp(),
        createdBy: currentUser?.email || "system",
      });
      setSuccessMessage("Service added successfully!");
      setNewServiceLabel("");
      setNewServiceCategory("caregiver");

      const servicesSnap = await getDocs(collection(db, "services"));
      setServices(servicesSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      console.error("Error adding service:", err);
      setError("Failed to add service: " + err.message);
    }
  };

  const handleUpdateService = async (serviceId, updatedLabel) => {
    try {
      await updateDoc(doc(db, "services", serviceId), {
        label: updatedLabel,
        updatedAt: serverTimestamp(),
      });
      setSuccessMessage("Service updated!");
      const servicesSnap = await getDocs(collection(db, "services"));
      setServices(servicesSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setEditingService(null);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      console.error("Error updating service:", err);
      setError("Failed to update service: " + err.message);
    }
  };

  const handleDeleteService = async (serviceId) => {
    if (!window.confirm("Are you sure you want to delete this service?"))
      return;

    try {
      await deleteDoc(doc(db, "services", serviceId));
      setSuccessMessage("Service deleted!");
      const servicesSnap = await getDocs(collection(db, "services"));
      setServices(servicesSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      console.error("Error deleting service:", err);
      setError("Failed to delete service: " + err.message);
    }
  };

  // ============ HANDLERS: COMMISSION ============
  const handleUpdateGlobalCommission = async (newRate) => {
    try {
      await setDoc(doc(db, "settings", "commission"), {
        rate: Number(newRate),
        updatedAt: serverTimestamp(),
        updatedBy: currentUser?.email || "system",
      });
      setGlobalCommissionRate(Number(newRate));
      setEditingCommission(false);
      setSuccessMessage("Global commission rate updated!");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      console.error("Error updating commission:", err);
      setError("Failed to update commission: " + err.message);
    }
  };

  // ============ HANDLERS: BLACKLIST ============
  const handleApproveBlacklistReport = async (reportId) => {
    try {
      const reportSnap = await getDoc(doc(db, "blacklistReports", reportId));
      if (!reportSnap.exists()) return;

      const reportData = reportSnap.data();
      const reason = String(
        reportData.reason || reportData.description || "",
      ).trim();
      if (!reportData.userId || reason.length < 3) {
        setError(
          "This report is missing a valid customer and safety reason, so no account restriction was changed.",
        );
        return;
      }

      const outcome = await runAccountSafetyAction({
        targetType: "customer",
        targetId: reportData.userId,
        reason,
        reportId,
      });

      const reportsSnap = await getDocs(collection(db, "blacklistReports"));
      setBlacklistReports(
        reportsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      );
      if (!outcome.complete) return;

      setSuccessMessage("Customer account suspended and report approved.");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      console.error("Error approving blacklist report:", err);
      setError("Failed to process blacklist: " + err.message);
    }
  };

  const handleRejectBlacklistReport = async (reportId) => {
    try {
      await updateDoc(doc(db, "blacklistReports", reportId), {
        status: "rejected",
        rejectedAt: serverTimestamp(),
        rejectedBy: currentUser?.uid || "",
      });
      setSuccessMessage("Report rejected!");
      const reportsSnap = await getDocs(collection(db, "blacklistReports"));
      setBlacklistReports(
        reportsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      );
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      console.error("Error rejecting blacklist report:", err);
      setError("Failed to reject report: " + err.message);
    }
  };

  // ============ UI: LOADING / PERMISSIONS ============
  if (loadingAuth) {
    return (
      <main style={{ padding: "40px", maxWidth: "980px", margin: "0 auto" }}>
        <DashboardLoadingState label="Verifying permissions…" />
      </main>
    );
  }

  if (permissionsError || !isSuperAdmin) {
    return (
      <div
        style={{
          padding: "40px",
          maxWidth: "600px",
          margin: "0 auto",
          backgroundColor: "var(--theme-warning-soft)",
          border: "1px solid var(--theme-danger-soft)",
          borderRadius: "8px",
          color: "var(--theme-danger)",
        }}
      >
        <h1>⛔ Access Denied</h1>
        <p>
          <strong>{permissionsError}</strong>
        </p>
        <hr style={{ borderColor: "var(--theme-danger-soft)" }} />
        <p>
          <strong>Why are you seeing this?</strong>
        </p>
        <ul>
          <li>You are not logged in, or</li>
          <li>Your account does not have superadmin role, or</li>
          <li>Firestore security rules are blocking access</li>
        </ul>
        <p>
          <strong>What to do:</strong>
        </p>
        <ol>
          <li>Ensure you are logged in as a superadmin account</li>
          <li>Check Firestore Security Rules in Firebase Console</li>
          <li>Have a trusted administrator provision your account with the Admin SDK</li>
          <li>Contact system administrator if you need access</li>
        </ol>
        <p style={{ marginTop: "20px", fontSize: "12px", color: "var(--theme-text-muted)" }}>
          Current User: {currentUser?.email || "Not logged in"}
        </p>
      </div>
    );
  }

  // ============ UI: MAIN DASHBOARD ============
  const pendingOrgCount = organizations.filter((org) => !org.isApproved).length;
  const pendingOrganizationApplicationCount = organizationApplications.filter(
    (application) => application.status === "pending",
  ).length;
  const approvedOrgCount = organizations.filter((org) => org.isApproved).length;
  const pendingCaregiverCount = vendors.filter((vendor) => vendor.isApproved !== true).length;
  const approvedCaregiverCount = vendors.filter((vendor) => vendor.isApproved === true).length;
  const pendingBlacklistCount = blacklistReports.filter((report) => report.status === "pending").length;
  const approvedBlacklistCount = blacklistReports.filter((report) => report.status === "approved").length;
  const rejectedBlacklistCount = blacklistReports.filter((report) => report.status === "rejected").length;
  const activeCareCount = bookings.filter((booking) => booking.status === "in_progress").length;
  const pendingPaymentVerificationCount = bookings.filter(
    (booking) => booking.paymentMethod === "fonepay" && booking.paymentStatus === "awaiting_verification",
  ).length;
  const unassignedBookingCount = bookings.filter(
    (booking) => !booking.caregiverId && booking.status !== "cancelled",
  ).length;
  const attentionQueues = [
    pendingOrganizationApplicationCount > 0 && {
      title: "New partner applications need review",
      detail: "Approve only after verifying the applicant and organization details.",
      count: pendingOrganizationApplicationCount,
      tab: "organizations",
    },
    pendingOrgCount > 0 && {
      title: "Partner applications need review",
      detail: "Review the organization profile before approval.",
      count: pendingOrgCount,
      tab: "organizations",
    },
    pendingCaregiverCount > 0 && {
      title: "Caregiver profiles need review",
      detail: "Approval is separate from identity, training, and background verification.",
      count: pendingCaregiverCount,
      tab: "caregivers",
    },
    pendingBlacklistCount > 0 && {
      title: "Safety reports need review",
      detail: "Review the booking context before taking any account action.",
      count: pendingBlacklistCount,
      tab: "blacklist",
    },
    pendingPaymentVerificationCount > 0 && {
      title: "Payments await server verification",
      detail: "Do not treat these bookings as paid until the gateway verification is complete.",
      count: pendingPaymentVerificationCount,
      tab: "bookings",
    },
  ].filter(Boolean);

  const getTabLabel = (tab) => {
    const count =
      tab === "organizations"
        ? pendingOrgCount + pendingOrganizationApplicationCount
        : tab === "caregivers"
        ? pendingCaregiverCount
        : tab === "blacklist"
        ? pendingBlacklistCount
        : 0;
    const label = tab.charAt(0).toUpperCase() + tab.slice(1);
    return count > 0 ? `${label} (${count})` : label;
  };

  return (
    <div
      className="dashboard-admin-content"
      style={{
        padding: "20px",
        backgroundColor: "var(--theme-surface)",
        minHeight: "100vh",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: "30px" }}>
        <h1>Admin Dashboard</h1>
        <p>
          Logged in as: <strong>{currentUser?.email}</strong> ({userRole})
        </p>
      </div>

      {/* Error Messages */}
      {error && (
        <div
          className="dashboard-notice dashboard-notice--error"
          role="alert"
          style={{
            padding: "15px",
            marginBottom: "20px",
            backgroundColor: "var(--theme-warning-soft)",
            border: "1px solid var(--theme-danger-soft)",
            borderRadius: "4px",
            color: "var(--theme-danger)",
          }}
        >
          ❌ {error}
          <button
            type="button"
            className="dashboard-notice-close"
            onClick={() => setError("")}
          >
            Close
          </button>
        </div>
      )}

      {/* Success Messages */}
      {successMessage && (
        <div
          className="dashboard-notice dashboard-notice--success"
          role="status"
          style={{
            padding: "15px",
            marginBottom: "20px",
            backgroundColor: "var(--theme-positive-soft)",
            border: "1px solid var(--theme-positive-soft)",
            borderRadius: "4px",
            color: "var(--theme-positive)",
          }}
        >
          ✅ {successMessage}
        </div>
      )}

      {provisioningInvitation && (
        <section
          role="alert"
          aria-label="One-time account invitation"
          style={{ padding: "16px", marginBottom: "20px", background: "var(--theme-warning-soft)", border: "1px solid var(--theme-warning)", borderRadius: "8px" }}
        >
          <strong>One-time invitation link</strong>
          <p style={{ margin: "8px 0", color: "var(--theme-text-muted)", fontSize: 13 }}>
            Send this only through an approved secure channel. It can reset the invited account&apos;s password, so do not add it to notes, screenshots, or chat messages.
          </p>
          <textarea readOnly aria-label="One-time account invitation link" value={provisioningInvitation} rows={3} style={{ width: "100%", marginBottom: 10 }} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={async () => {
                await navigator.clipboard?.writeText(provisioningInvitation);
                setSuccessMessage("Invitation link copied. Send it only through an approved secure channel.");
              }}
            >
              Copy invitation
            </button>
            <button type="button" className="btn btn-outline" onClick={() => setProvisioningInvitation("")}>Hide link</button>
          </div>
        </section>
      )}

      {/* Tabs */}
      <nav className="dashboard-tabs" aria-label="Admin dashboard sections">
        {dashboardTabs.map((tab) => (
          <button
            type="button"
            key={tab}
            className={`dashboard-tab${activeTab === tab ? " is-active" : ""}`}
            aria-current={activeTab === tab ? "page" : undefined}
            onClick={() => navigate(`/superadmin/${tab}`)}
          >
            {getTabLabel(tab)}
          </button>
        ))}
      </nav>

      {/* ===== TAB: OPERATIONS OVERVIEW ===== */}
      {activeTab === "overview" && (
        <section aria-labelledby="operations-overview-heading">
          <div style={{ marginBottom: "24px" }}>
            <p style={{ margin: 0, color: "var(--theme-text-muted)", fontWeight: 700, fontSize: "12px", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Operations
            </p>
            <h2 id="operations-overview-heading" style={{ margin: "6px 0 8px", color: "var(--theme-text)" }}>What needs attention</h2>
            <p style={{ margin: 0, color: "var(--theme-text-muted)" }}>
              These counts come from live operational records; they are not performance or trust claims.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "14px", marginBottom: "24px" }}>
            {[
              ["Active care", activeCareCount, "bookings"],
              ["New partner applications", pendingOrganizationApplicationCount, "organizations"],
              ["Pending partner review", pendingOrgCount, "organizations"],
              ["Pending caregiver review", pendingCaregiverCount, "caregivers"],
              ["Safety reports", pendingBlacklistCount, "blacklist"],
              ["Unassigned requests", unassignedBookingCount, "bookings"],
            ].map(([label, value, tab]) => (
              <button
                type="button"
                key={label}
                className="dashboard-action-card"
                onClick={() => navigate(`/superadmin/${tab}`)}
                style={{ textAlign: "left", background: "var(--theme-surface)", border: "1px solid var(--theme-border)", borderRadius: "12px", padding: "18px", cursor: "pointer", color: "var(--theme-text)" }}
              >
                <span style={{ display: "block", color: "var(--theme-text-muted)", fontSize: "13px" }}>{label}</span>
                <strong style={{ display: "block", fontSize: "30px", marginTop: "8px" }}>{value}</strong>
              </button>
            ))}
          </div>

          <div style={{ background: "var(--theme-surface)", border: "1px solid var(--theme-border)", borderRadius: "12px", padding: "20px" }}>
            <h3 style={{ color: "var(--theme-text)", marginTop: 0 }}>Review queue</h3>
            {attentionQueues.length ? attentionQueues.map((item) => (
              <div key={item.title} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", padding: "14px 0", borderTop: "1px solid var(--theme-border)", flexWrap: "wrap" }}>
                <div>
                  <strong>{item.count} {item.title}</strong>
                  <p style={{ margin: "4px 0 0", color: "var(--theme-text-muted)", fontSize: "13px" }}>{item.detail}</p>
                </div>
                <button type="button" className="btn btn-outline" onClick={() => navigate(`/superadmin/${item.tab}`)}>Open queue</button>
              </div>
            )) : <p style={{ margin: 0, color: "var(--theme-text-muted)" }}>No records currently need a review action.</p>}
          </div>
        </section>
      )}

      {/* ===== TAB: ORGANIZATIONS ===== */}
      {activeTab === "organizations" && (
        <div>
          <div style={{ marginBottom: "20px" }}>
            <button
              onClick={() => setShowAddOrgForm(true)}
              style={{
                padding: "10px 20px",
                backgroundColor: "var(--theme-positive)",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              + Add New Organization
            </button>
          </div>

          {pendingOrganizationApplicationCount > 0 && (
            <section
              aria-labelledby="organization-applications-heading"
              style={{
                marginBottom: "20px",
                padding: "16px",
                background: "var(--theme-warning-soft)",
                border: "1px solid var(--theme-warning)",
                borderRadius: "8px",
              }}
            >
              <h3
                id="organization-applications-heading"
                style={{ margin: "0 0 10px", color: "var(--theme-text)" }}
              >
                Pending partner applications ({pendingOrganizationApplicationCount})
              </h3>
              {organizationApplications
                .filter((application) => application.status === "pending")
                .map((application) => (
                  <article
                    key={application.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "12px",
                      padding: "10px 0",
                      borderTop: "1px solid var(--theme-border)",
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <strong>{application.organizationName}</strong>
                      <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--theme-text-muted)" }}>
                        {application.applicantName} · {application.applicantEmail}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() =>
                        handleApproveOrganizationApplication(application.id)
                      }
                    >
                      Approve application
                    </button>
                  </article>
                ))}
            </section>
          )}

          {loadingOrganizations ? (
            <DashboardLoadingState label="Loading organizations…" />
          ) : (
            <div>
              <div
                style={{
                  marginBottom: "15px",
                  display: "flex",
                  gap: "10px",
                }}
              >
                <input
                  type="text"
                  placeholder="Search organizations..."
                  value={searchOrg}
                  onChange={(e) => setSearchOrg(e.target.value)}
                  style={{
                    padding: "8px",
                    borderRadius: "4px",
                    border: "1px solid var(--theme-neutral-light)",
                    flex: 1,
                  }}
                />
                <select
                  className="dropdown-select"
                  value={orgStatusFilter}
                  onChange={(e) => setOrgStatusFilter(e.target.value)}
                  style={{
                    padding: "8px",
                    borderRadius: "4px",
                    border: "1px solid var(--theme-neutral-light)",
                  }}
                >
                  <option value="all">All Status ({organizations.length})</option>
                  <option value="approved">Approved ({approvedOrgCount})</option>
                  <option value="pending">Pending ({pendingOrgCount})</option>
                </select>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                  gap: "20px",
                }}
              >
                {organizations
                  .filter(
                    (org) =>
                      (searchOrg === "" ||
                        org.organizationName
                          ?.toLowerCase()
                          .includes(searchOrg.toLowerCase())) &&
                      (orgStatusFilter === "all" ||
                        (orgStatusFilter === "approved"
                          ? org.isApproved
                          : !org.isApproved)),
                  )
                  .map((org) => (
                    <div
                      key={org.id}
                      onClick={() => handleOrgClick(org)}
                      style={{
                        backgroundColor: "white",
                        padding: "20px",
                        borderRadius: "8px",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                        cursor: "pointer",
                        border:
                          selectedOrg?.id === org.id
                            ? "2px solid var(--theme-help)"
                            : "1px solid var(--theme-neutral-light)",
                      }}
                    >
                      <h4>{org.organizationName}</h4>
                      <p>
                        <strong>Admin:</strong> {org.adminName}
                      </p>
                      <p>
                        <strong>Email:</strong> {org.adminEmail || org.email}
                      </p>
                      <p>
                        <strong>Commission:</strong> {org.commissionRate}%
                      </p>
                      <p>
                        <strong>Status:</strong>{" "}
                        {org.isApproved ? "✅ Approved" : "⏳ Pending"}
                      </p>

                      <div
                        style={{
                          marginTop: 10,
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        {!org.isApproved && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleApproveOrganization(org.id);
                              }}
                              style={{
                                padding: "6px 12px",
                                backgroundColor: "var(--theme-positive)",
                                color: "white",
                                border: "none",
                                borderRadius: 4,
                                cursor: "pointer",
                                fontSize: 12,
                              }}
                            >
                              Approve
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRejectOrganization(org.id);
                              }}
                              style={{
                                padding: "6px 12px",
                                backgroundColor: "var(--theme-warning)",
                                color: "black",
                                border: "none",
                                borderRadius: 4,
                                cursor: "pointer",
                                fontSize: 12,
                              }}
                            >
                              Reject
                            </button>
                          </>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartEditOrg(org);
                          }}
                          style={{
                            padding: "6px 12px",
                            backgroundColor: "var(--theme-help)",
                            color: "white",
                            border: "none",
                            borderRadius: 4,
                            cursor: "pointer",
                            fontSize: 12,
                          }}
                        >
                          Edit
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenOrgPasswordModal(org);
                          }}
                          style={{
                            padding: "6px 12px",
                            backgroundColor: "var(--theme-help)",
                            color: "white",
                            border: "none",
                            borderRadius: 4,
                            cursor: "pointer",
                            fontSize: 12,
                          }}
                        >
                          Send reset email
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenOrgBlacklistModal(org);
                          }}
                          style={{
                            padding: "6px 12px",
                            backgroundColor: "var(--theme-danger)",
                            color: "white",
                            border: "none",
                            borderRadius: 4,
                            cursor: "pointer",
                            fontSize: 12,
                          }}
                        >
                          Blacklist Org
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Create Organization Modal */}
          {showAddOrgForm && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                backgroundColor: "rgba(0,0,0,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
              }}
              onClick={() => setShowAddOrgForm(false)}
            >
              <div
                style={{
                  backgroundColor: "white",
                  padding: "20px",
                  borderRadius: "8px",
                  maxWidth: "600px",
                  width: "95%",
                  maxHeight: "80vh",
                  overflowY: "auto",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "10px",
                  }}
                >
                  <h3>Create New Organization</h3>
                  <button
                    onClick={() => setShowAddOrgForm(false)}
                    style={{
                      border: "none",
                      background: "transparent",
                      fontSize: 18,
                      cursor: "pointer",
                    }}
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleCreateOrganization}>
                  <div style={{ marginBottom: "15px" }}>
                    <label style={{ display: "block", marginBottom: "5px" }}>
                      Organization Name *
                    </label>
                    <input
                      type="text"
                      value={newOrgName}
                      onChange={(e) => setNewOrgName(e.target.value)}
                      placeholder="e.g., Care Plus"
                      required
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid var(--theme-neutral-light)",
                      }}
                    />
                  </div>
                  <div style={{ marginBottom: "15px" }}>
                    <label style={{ display: "block", marginBottom: "5px" }}>
                      Admin Name *
                    </label>
                    <input
                      type="text"
                      value={newOrgAdminName}
                      onChange={(e) => setNewOrgAdminName(e.target.value)}
                      placeholder="e.g., John Doe"
                      required
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid var(--theme-neutral-light)",
                      }}
                    />
                  </div>
                  <div style={{ marginBottom: "15px" }}>
                    <label style={{ display: "block", marginBottom: "5px" }}>
                      Email *
                    </label>
                    <input
                      type="email"
                      value={newOrgEmail}
                      onChange={(e) => setNewOrgEmail(e.target.value)}
                      placeholder="admin@careplus.com"
                      required
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid var(--theme-neutral-light)",
                      }}
                    />
                  </div>
                  <p style={{ margin: "0 0 15px", color: "var(--theme-text-muted)", fontSize: 13 }}>
                    Sewak creates a one-time invitation and never asks an administrator to choose or store another person&apos;s password.
                  </p>
                  <div style={{ marginBottom: "15px" }}>
                    <label style={{ display: "block", marginBottom: "5px" }}>
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={newOrgPhone}
                      onChange={(e) => setNewOrgPhone(e.target.value)}
                      placeholder="+1234567890"
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid var(--theme-neutral-light)",
                      }}
                    />
                  </div>
                  <div style={{ marginBottom: "15px" }}>
                    <label style={{ display: "block", marginBottom: "5px" }}>
                      Address
                    </label>
                    <input
                      type="text"
                      value={newOrgAddress}
                      onChange={(e) => setNewOrgAddress(e.target.value)}
                      placeholder="Street address"
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid var(--theme-neutral-light)",
                      }}
                    />
                  </div>
                  <div style={{ marginBottom: "15px" }}>
                    <label style={{ display: "block", marginBottom: "5px" }}>
                      City
                    </label>
                    <input
                      type="text"
                      value={newOrgCity}
                      onChange={(e) => setNewOrgCity(e.target.value)}
                      placeholder="Kathmandu"
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid var(--theme-neutral-light)",
                      }}
                    />
                  </div>
                  <p style={{ margin: "0 0 15px", color: "var(--theme-text-muted)", fontSize: 13 }}>
                    New partner accounts start with the platform&apos;s 15% commission policy. Review it after approval if a different agreement is needed.
                  </p>
                  <button
                    type="submit"
                    disabled={addingOrg}
                    style={{
                      padding: "10px 20px",
                      backgroundColor: addingOrg ? "var(--theme-border)" : "var(--theme-help)",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: addingOrg ? "not-allowed" : "pointer",
                      fontWeight: "bold",
                    }}
                  >
                    {addingOrg ? "Creating..." : "Create Organization"}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Edit Organization Modal */}
          {showEditOrgModal && editingOrg && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                backgroundColor: "rgba(0,0,0,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
              }}
              onClick={handleCancelEditOrg}
            >
              <div
                style={{
                  backgroundColor: "white",
                  padding: 20,
                  borderRadius: 8,
                  maxWidth: "600px",
                  width: "95%",
                  maxHeight: "80vh",
                  overflowY: "auto",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 10,
                  }}
                >
                  <h3>Edit Organization – {editingOrg.organizationName}</h3>
                  <button
                    onClick={handleCancelEditOrg}
                    style={{
                      border: "none",
                      background: "transparent",
                      fontSize: 18,
                      cursor: "pointer",
                    }}
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleUpdateOrganization}>
                  <div style={{ marginBottom: 15 }}>
                    <label style={{ display: "block", marginBottom: 5 }}>
                      Organization Name
                    </label>
                    <input
                      type="text"
                      value={editOrgName}
                      onChange={(e) => setEditOrgName(e.target.value)}
                      required
                      style={{
                        width: "100%",
                        padding: 8,
                        borderRadius: 4,
                        border: "1px solid var(--theme-neutral-light)",
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: 15 }}>
                    <label style={{ display: "block", marginBottom: 5 }}>
                      Admin Name
                    </label>
                    <input
                      type="text"
                      value={editOrgAdminName}
                      onChange={(e) => setEditOrgAdminName(e.target.value)}
                      required
                      style={{
                        width: "100%",
                        padding: 8,
                        borderRadius: 4,
                        border: "1px solid var(--theme-neutral-light)",
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: 15 }}>
                    <label style={{ display: "block", marginBottom: 5 }}>
                      Email
                    </label>
                    <input
                      type="email"
                      value={editOrgEmail}
                      onChange={(e) => setEditOrgEmail(e.target.value)}
                      required
                      style={{
                        width: "100%",
                        padding: 8,
                        borderRadius: 4,
                        border: "1px solid var(--theme-neutral-light)",
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: 15 }}>
                    <label style={{ display: "block", marginBottom: 5 }}>
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={editOrgPhone}
                      onChange={(e) => setEditOrgPhone(e.target.value)}
                      style={{
                        width: "100%",
                        padding: 8,
                        borderRadius: 4,
                        border: "1px solid var(--theme-neutral-light)",
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: 15 }}>
                    <label style={{ display: "block", marginBottom: 5 }}>
                      Address
                    </label>
                    <input
                      type="text"
                      value={editOrgAddress}
                      onChange={(e) => setEditOrgAddress(e.target.value)}
                      style={{
                        width: "100%",
                        padding: 8,
                        borderRadius: 4,
                        border: "1px solid var(--theme-neutral-light)",
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: 15 }}>
                    <label style={{ display: "block", marginBottom: 5 }}>
                      City
                    </label>
                    <input
                      type="text"
                      value={editOrgCity}
                      onChange={(e) => setEditOrgCity(e.target.value)}
                      style={{
                        width: "100%",
                        padding: 8,
                        borderRadius: 4,
                        border: "1px solid var(--theme-neutral-light)",
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: 15 }}>
                    <label style={{ display: "block", marginBottom: 5 }}>
                      Commission Rate (%)
                    </label>
                    <input
                      type="number"
                      value={editOrgCommission}
                      onChange={(e) => setEditOrgCommission(e.target.value)}
                      min={0}
                      max={100}
                      required
                      style={{
                        width: "100%",
                        padding: 8,
                        borderRadius: 4,
                        border: "1px solid var(--theme-neutral-light)",
                      }}
                    />
                  </div>

                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      type="submit"
                      style={{
                        padding: "10px 20px",
                        backgroundColor: "var(--theme-positive)",
                        color: "white",
                        border: "none",
                        borderRadius: 4,
                        cursor: "pointer",
                        fontWeight: "bold",
                      }}
                    >
                      Save Changes
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEditOrg}
                      style={{
                        padding: "10px 20px",
                        backgroundColor: "var(--theme-text-muted)",
                        color: "white",
                        border: "none",
                        borderRadius: 4,
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Change Organization Password Modal */}
          {showOrgPasswordModal && orgPasswordOrg && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                backgroundColor: "rgba(0,0,0,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
              }}
              onClick={() => {
                setShowOrgPasswordModal(false);
                setOrgPasswordOrg(null);
              }}
            >
              <div
                style={{
                  backgroundColor: "white",
                  padding: 20,
                  borderRadius: 8,
                  maxWidth: "500px",
                  width: "95%",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 10,
                  }}
                >
                  <h3>
                    Change Password – {orgPasswordOrg.organizationName} (
                    {orgPasswordOrg.email})
                  </h3>
                  <button
                    onClick={() => {
                      setShowOrgPasswordModal(false);
                      setOrgPasswordOrg(null);
                    }}
                    style={{
                      border: "none",
                      background: "transparent",
                      fontSize: 18,
                      cursor: "pointer",
                    }}
                  >
                    ✕
                  </button>
                </div>

                <p style={{ color: "var(--theme-text-muted)" }}>
                  Passwords are never collected or stored here. Close this dialog and use the Send reset email action instead.
                </p>
              </div>
            </div>
          )}

          {/* Org Caregivers Modal */}
          {showOrgCaregiversModal && selectedOrg && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                backgroundColor: "rgba(0,0,0,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
              }}
              onClick={() => setShowOrgCaregiversModal(false)}
            >
              <div
                style={{
                  backgroundColor: "white",
                  padding: 20,
                  borderRadius: 8,
                  maxWidth: "900px",
                  width: "90%",
                  maxHeight: "80vh",
                  overflowY: "auto",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 10,
                  }}
                >
                  <h3>Caregivers for {selectedOrg.organizationName}</h3>
                  <button
                    onClick={() => setShowOrgCaregiversModal(false)}
                    style={{
                      border: "none",
                      background: "transparent",
                      fontSize: 18,
                      cursor: "pointer",
                    }}
                  >
                    ✕
                  </button>
                </div>

                {orgCaregivers.length === 0 ? (
                  <p>No caregivers found for this organization.</p>
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fill, minmax(250px, 1fr))",
                      gap: 20,
                    }}
                  >
                    {orgCaregivers.map((caregiver) => (
                      <div
                        key={caregiver.id}
                        style={{
                          backgroundColor: "var(--theme-surface)",
                          padding: 15,
                          borderRadius: 8,
                          border: "1px solid var(--theme-neutral-lighter)",
                        }}
                      >
                        <h5>{caregiver.name}</h5>
                        <p>
                          <strong>Location:</strong> {caregiver.location}
                        </p>
                        <p>
                          <strong>Rate:</strong> Rs. {caregiver.hourlyRate}
                          /hour
                        </p>
                        <p>
                          <strong>Status:</strong>{" "}
                          {caregiver.isApproved ? "✅" : "⏳"}
                        </p>
                        <div
                          style={{
                            marginTop: 10,
                            display: "flex",
                            gap: 10,
                            flexWrap: "wrap",
                          }}
                        >
                          {!caregiver.isApproved && (
                            <>
                              <button
                                onClick={() =>
                                  handleApproveCaregiverClick(caregiver.id)
                                }
                                style={{
                                  padding: "8px 15px",
                                  backgroundColor: "var(--theme-positive)",
                                  color: "white",
                                  border: "none",
                                  borderRadius: 4,
                                  cursor: "pointer",
                                  fontSize: 12,
                                }}
                              >
                                Approve
                              </button>
                              <button
                                onClick={() =>
                                  handleRejectCaregiverClick(caregiver.id)
                                }
                                style={{
                                  padding: "8px 15px",
                                  backgroundColor: "var(--theme-danger)",
                                  color: "white",
                                  border: "none",
                                  borderRadius: 4,
                                  cursor: "pointer",
                                  fontSize: 12,
                                }}
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Caregiver Password Modal */}
          {showCaregiverPasswordModal && caregiverPasswordUser && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                backgroundColor: "rgba(0,0,0,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
              }}
              onClick={() => {
                setShowCaregiverPasswordModal(false);
                setCaregiverPasswordUser(null);
              }}
            >
              <div
                style={{
                  backgroundColor: "white",
                  padding: 20,
                  borderRadius: 8,
                  maxWidth: "500px",
                  width: "95%",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 10,
                  }}
                >
                  <h3>
                    Change Caregiver Password – {caregiverPasswordUser.name} (
                    {caregiverPasswordUser.email})
                  </h3>
                  <button
                    onClick={() => {
                      setShowCaregiverPasswordModal(false);
                      setCaregiverPasswordUser(null);
                    }}
                    style={{
                      border: "none",
                      background: "transparent",
                      fontSize: 18,
                      cursor: "pointer",
                    }}
                  >
                    ✕
                  </button>
                </div>

                <p style={{ color: "var(--theme-text-muted)" }}>
                  Passwords are never collected or stored here. Close this dialog and use the Send reset email action instead.
                </p>
              </div>
            </div>
          )}

          {/* Caregiver Blacklist Modal */}
          {showCaregiverBlacklistModal && caregiverBlacklistUser && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                backgroundColor: "rgba(0,0,0,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
              }}
              onClick={() => {
                setShowCaregiverBlacklistModal(false);
                setCaregiverBlacklistUser(null);
                setCaregiverBlacklistReason("");
              }}
            >
              <div
                style={{
                  backgroundColor: "white",
                  padding: 20,
                  borderRadius: 8,
                  maxWidth: "600px",
                  width: "95%",
                  maxHeight: "80vh",
                  overflowY: "auto",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 10,
                  }}
                >
                  <h3>Blacklist Caregiver – {caregiverBlacklistUser.name}</h3>
                  <button
                    onClick={() => {
                      setShowCaregiverBlacklistModal(false);
                      setCaregiverBlacklistUser(null);
                      setCaregiverBlacklistReason("");
                    }}
                    style={{
                      border: "none",
                      background: "transparent",
                      fontSize: 18,
                      cursor: "pointer",
                    }}
                  >
                    ✕
                  </button>
                </div>

                <p>
                  This will mark the caregiver as blacklisted and add them to
                  the blacklist table. They will no longer be able to receive
                  bookings.
                </p>

                <form onSubmit={handleSubmitCaregiverBlacklist}>
                  <div style={{ marginBottom: 15 }}>
                    <label style={{ display: "block", marginBottom: 5 }}>
                      Reason (optional)
                    </label>
                    <textarea
                      value={caregiverBlacklistReason}
                      onChange={(e) =>
                        setCaregiverBlacklistReason(e.target.value)
                      }
                      rows={3}
                      style={{
                        width: "100%",
                        padding: 8,
                        borderRadius: 4,
                        border: "1px solid var(--theme-neutral-light)",
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    style={{
                      padding: "10px 20px",
                      backgroundColor: "var(--theme-text-muted)",
                      color: "white",
                      border: "none",
                      borderRadius: 4,
                      cursor: "pointer",
                      fontWeight: "bold",
                    }}
                  >
                    Confirm Blacklist
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Org Blacklist Modal */}
          {showOrgBlacklistModal && orgBlacklistOrg && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                backgroundColor: "rgba(0,0,0,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
              }}
              onClick={() => {
                setShowOrgBlacklistModal(false);
                setOrgBlacklistOrg(null);
                setOrgBlacklistReason("");
              }}
            >
              <div
                style={{
                  backgroundColor: "white",
                  padding: 20,
                  borderRadius: 8,
                  maxWidth: "600px",
                  width: "95%",
                  maxHeight: "80vh",
                  overflowY: "auto",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 10,
                  }}
                >
                  <h3>
                    Blacklist Organization – {orgBlacklistOrg.organizationName}
                  </h3>
                  <button
                    onClick={() => {
                      setShowOrgBlacklistModal(false);
                      setOrgBlacklistOrg(null);
                      setOrgBlacklistReason("");
                    }}
                    style={{
                      border: "none",
                      background: "transparent",
                      fontSize: 18,
                      cursor: "pointer",
                    }}
                  >
                    ✕
                  </button>
                </div>

                <p>
                  This will mark the organization and all caregivers under it as
                  blacklisted and add them to the blacklist table.
                </p>

                <form onSubmit={handleSubmitOrgBlacklist}>
                  <div style={{ marginBottom: 15 }}>
                    <label style={{ display: "block", marginBottom: 5 }}>
                      Reason (optional)
                    </label>
                    <textarea
                      value={orgBlacklistReason}
                      onChange={(e) => setOrgBlacklistReason(e.target.value)}
                      rows={3}
                      style={{
                        width: "100%",
                        padding: 8,
                        borderRadius: 4,
                        border: "1px solid var(--theme-neutral-light)",
                      }}
                    />
                  </div>
                  <button
                    type="submit"
                    style={{
                      padding: "10px 20px",
                      backgroundColor: "var(--theme-danger)",
                      color: "white",
                      border: "none",
                      borderRadius: 4,
                      cursor: "pointer",
                      fontWeight: "bold",
                    }}
                  >
                    Confirm Blacklist
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== TAB: CAREGIVERS ===== */}
      {activeTab === "caregivers" && (
        <div>
          {loadingVendors ? (
            <DashboardLoadingState label="Loading caregivers…" />
          ) : (
            <div>
              <section
                className="card"
                aria-labelledby="public-caregiver-sync-title"
                style={{ marginBottom: "18px", padding: "18px" }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: "16px",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ maxWidth: "720px" }}>
                    <p
                      style={{
                        margin: "0 0 6px",
                        color: "var(--theme-text-muted)",
                        fontSize: "12px",
                        fontWeight: "700",
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                      }}
                    >
                      Superadmin control
                    </p>
                    <h3
                      id="public-caregiver-sync-title"
                      style={{ margin: "0 0 8px" }}
                    >
                      Public caregiver listings
                    </h3>
                    <p
                      id="public-caregiver-sync-help"
                      style={{
                        margin: 0,
                        color: "var(--theme-text-muted)",
                        lineHeight: 1.55,
                      }}
                    >
                      Publish the PII-free public directory from caregiver
                      records without Cloud Functions. Only approved,
                      unsuspended, unblacklisted caregivers from active
                      organizations can be listed.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handlePublishTrialCaregiverListings}
                    disabled={syncingPublicCaregivers}
                    aria-describedby="public-caregiver-sync-help"
                    title="Publish approved public caregiver listings"
                  >
                    {syncingPublicCaregivers
                      ? "Syncing public listings…"
                      : "Sync public listings"}
                  </button>
                </div>

                <p
                  style={{
                    margin: "14px 0 0",
                    color: "var(--theme-text-muted)",
                    fontSize: "13px",
                    lineHeight: 1.5,
                  }}
                >
                  For this free-tier trial, publish after approving, rejecting,
                  or changing a caregiver. The browser never reads private
                  caregiver records on public pages.
                </p>

                {publicCaregiverSyncProgress && (
                  <p
                    role="status"
                    aria-live="polite"
                    style={{
                      margin: "12px 0 0",
                      color: "var(--theme-help)",
                      fontWeight: "700",
                    }}
                  >
                    {publicCaregiverSyncProgress}
                  </p>
                )}
              </section>

              <div
                style={{ marginBottom: "15px", display: "flex", gap: "10px" }}
              >
                <input
                  type="text"
                  placeholder="Search caregivers..."
                  value={searchVendor}
                  onChange={(e) => setSearchVendor(e.target.value)}
                  style={{
                    padding: "8px",
                    borderRadius: "4px",
                    border: "1px solid var(--theme-neutral-light)",
                    flex: 1,
                  }}
                />
                <select
                  className="dropdown-select"
                  value={vendorStatusFilter}
                  onChange={(e) => setVendorStatusFilter(e.target.value)}
                  style={{
                    padding: "8px",
                    borderRadius: "4px",
                    border: "1px solid var(--theme-neutral-light)",
                  }}
                >
                  <option value="all">All Status ({vendors.length})</option>
                  <option value="approved">Approved ({approvedCaregiverCount})</option>
                  <option value="pending">Pending ({pendingCaregiverCount})</option>
                </select>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                  gap: "20px",
                }}
              >
                {vendors
                  .filter((vendor) => {
                    const matchesSearch =
                      searchVendor === "" ||
                      vendor.name
                        ?.toLowerCase()
                        .includes(searchVendor.toLowerCase());
                    const matchesStatus =
                      vendorStatusFilter === "all" ||
                      (vendorStatusFilter === "approved"
                        ? vendor.isApproved === true
                        : vendor.isApproved !== true);

                    return matchesSearch && matchesStatus;
                  })
                  .map((vendor) => (
                    <div
                      key={vendor.id}
                      style={{
                        backgroundColor: "white",
                        padding: "20px",
                        borderRadius: "8px",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                        border: vendor.isApproved
                          ? "1px solid var(--theme-positive)"
                          : "1px solid var(--theme-warning)",
                      }}
                    >
                      <h4>{vendor.name}</h4>
                      <p>
                        <strong>Location:</strong> {vendor.location}
                      </p>
                      <p>
                        <strong>Hourly Rate:</strong>{" "}
                        {formatNpr(vendor.hourlyRate, "Rate not set")}
                      </p>
                      <p>
                        <strong>Work Type:</strong> {vendor.workType}
                      </p>
                      <p>
                        <strong>Experience:</strong> {vendor.experience} years
                      </p>
                      <p>
                        <strong>Status:</strong>{" "}
                        {vendor.isApproved ? "✅ Approved" : "⏳ Pending"}
                      </p>
                      <section
                        aria-label="Caregiver verification records"
                        style={{
                          marginTop: "14px",
                          paddingTop: "12px",
                          borderTop: "1px solid var(--theme-border)",
                        }}
                      >
                        <p
                          style={{
                            margin: "0 0 8px",
                            color: "var(--theme-text-muted)",
                            fontSize: "12px",
                            fontWeight: "700",
                            letterSpacing: "0.04em",
                            textTransform: "uppercase",
                          }}
                        >
                          Verification records
                        </p>
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "8px",
                          }}
                        >
                          {getCaregiverVerificationItems(vendor).map((item) => (
                            <div
                              key={item.key}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "5px",
                              }}
                            >
                              <span
                                style={{
                                  color: "var(--theme-text-muted)",
                                  fontSize: "12px",
                                }}
                              >
                                {item.label}
                              </span>
                              <VerificationBadge
                                state={item.state}
                                label={item.badgeLabel}
                                compact
                              />
                            </div>
                          ))}
                        </div>
                        <p
                          style={{
                            margin: "10px 0 0",
                            color: "var(--theme-text-muted)",
                            fontSize: "12px",
                          }}
                        >
                          Marketplace approval is reviewed separately from these checks.
                        </p>
                      </section>
                      <div
                        style={{
                          marginTop: 10,
                          display: "flex",
                          gap: 10,
                          flexWrap: "wrap",
                        }}
                      >
                        {!vendor.isApproved && (
                          <button
                            onClick={() =>
                              handleApproveCaregiverClick(vendor.id)
                            }
                            style={{
                              padding: "8px 15px",
                              backgroundColor: "var(--theme-positive)",
                              color: "white",
                              border: "none",
                              borderRadius: 4,
                              cursor: "pointer",
                              fontSize: 12,
                            }}
                          >
                            Approve
                          </button>
                        )}

                        <button
                          onClick={() => handleRejectCaregiverClick(vendor.id)}
                          style={{
                            padding: "8px 15px",
                            backgroundColor: "var(--theme-danger)",
                            color: "white",
                            border: "none",
                            borderRadius: 4,
                            cursor: "pointer",
                            fontSize: 12,
                          }}
                        >
                          Reject
                        </button>

                        <button
                          onClick={() => handleStartEditCaregiver(vendor)}
                          style={{
                            padding: "8px 15px",
                            backgroundColor: "var(--theme-help)",
                            color: "white",
                            border: "none",
                            borderRadius: 4,
                            cursor: "pointer",
                            fontSize: 12,
                          }}
                        >
                          Edit Caregiver
                        </button>

                        <button
                          onClick={() =>
                            handleOpenCaregiverPasswordModal(vendor)
                          }
                          style={{
                            padding: "8px 15px",
                            backgroundColor: "var(--theme-help)",
                            color: "white",
                            border: "none",
                            borderRadius: 4,
                            cursor: "pointer",
                            fontSize: 12,
                          }}
                        >
                          Send reset email
                        </button>

                        <button
                          onClick={() =>
                            handleOpenCaregiverBlacklistModal(vendor)
                          }
                          style={{
                            padding: "8px 15px",
                            backgroundColor: "var(--theme-text-muted)",
                            color: "white",
                            border: "none",
                            borderRadius: 4,
                            cursor: "pointer",
                            fontSize: 12,
                          }}
                        >
                          Blacklist
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== TAB: BOOKINGS ===== */}
      {activeTab === "bookings" && (
        <div>
          {loadingBookings ? (
            <DashboardLoadingState label="Loading bookings…" />
          ) : (
            <div>
              <div
                style={{
                  marginBottom: "15px",
                  display: "flex",
                  gap: "10px",
                  flexWrap: "wrap",
                }}
              >
                <select
                  className="dropdown-select"
                  value={bookingStatusFilter}
                  onChange={(e) => setBookingStatusFilter(e.target.value)}
                  style={{
                    padding: "8px",
                    borderRadius: "4px",
                    border: "1px solid var(--theme-neutral-light)",
                  }}
                >
                  <option value="">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="accepted">Accepted</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <input
                  type="date"
                  value={bookingDateFilter}
                  onChange={(e) => setBookingDateFilter(e.target.value)}
                  style={{
                    padding: "8px",
                    borderRadius: "4px",
                    border: "1px solid var(--theme-neutral-light)",
                  }}
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))",
                  gap: "20px",
                }}
              >
                {bookings
                  .filter(
                    (booking) =>
                      (bookingStatusFilter === "" ||
                        booking.status === bookingStatusFilter) &&
                      (bookingDateFilter === "" ||
                        booking.date?.includes(bookingDateFilter)),
                  )
                  .map((booking) => (
                    <div
                      key={booking.id}
                      style={{
                        backgroundColor: "white",
                        padding: "20px",
                        borderRadius: "8px",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                        borderLeft: `4px solid ${
                          booking.status === "completed"
                            ? "var(--theme-positive)"
                            : booking.status === "cancelled"
                              ? "var(--theme-danger)"
                              : booking.status === "in_progress"
                                ? "var(--theme-help)"
                                : booking.status === "accepted"
                                  ? "var(--theme-warning)"
                                  : "var(--theme-text-muted)"
                        }`,
                      }}
                    >
                      <h5>Booking #{booking.id.substring(0, 8)}</h5>
                      <p>
                        <strong>User:</strong> {booking.userName}
                      </p>
                      <p>
                        <strong>Caregiver:</strong> {booking.caregiverName}
                      </p>
                      <p>
                        <strong>Date:</strong> {booking.date || "To be confirmed"}
                      </p>
                      <p>
                        <strong>Time:</strong> {booking.time || "To be confirmed"}
                        {booking.endTime ? ` - ${booking.endTime}` : booking.durationHours ? ` (${booking.durationHours} hours)` : ""}
                      </p>
                      <p>
                        <strong>Amount:</strong>{" "}
                        {formatNpr(booking.totalAmount, "Amount unavailable")}
                      </p>
                      <p>
                        <strong>Platform Commission:</strong>{" "}
                        {formatNpr(booking.platformCommission, "NPR 0")}
                      </p>
                      <p>
                        <strong>Status:</strong>{" "}
                        <strong
                          style={{
                            color:
                              booking.status === "completed"
                                ? "var(--theme-positive)"
                                : booking.status === "cancelled"
                                  ? "var(--theme-danger)"
                                  : "var(--theme-warning)",
                          }}
                        >
                          {booking.status.toUpperCase()}
                        </strong>
                      </p>
                    </div>
                  ))}
              </div>
              {bookings.length === 0 && <p>No bookings found.</p>}
            </div>
          )}
        </div>
      )}

      {/* ===== TAB: SERVICES ===== */}
      {activeTab === "services" && (
        <div>
          <div style={{ marginBottom: "20px" }}>
            <div
              style={{
                backgroundColor: "white",
                padding: "20px",
                borderRadius: "8px",
                marginBottom: "20px",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              }}
            >
              <h3>Add New Service</h3>
              <form onSubmit={handleAddService}>
                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    marginBottom: "15px",
                  }}
                >
                  <input
                    type="text"
                    value={newServiceLabel}
                    onChange={(e) => setNewServiceLabel(e.target.value)}
                    placeholder="Service name (e.g., Elderly Care)"
                    style={{
                      flex: 1,
                      padding: "8px",
                      borderRadius: "4px",
                      border: "1px solid var(--theme-neutral-light)",
                    }}
                  />
                  <select
                    className="dropdown-select"
                    value={newServiceCategory}
                    onChange={(e) => setNewServiceCategory(e.target.value)}
                    style={{
                      padding: "8px",
                      borderRadius: "4px",
                      border: "1px solid var(--theme-neutral-light)",
                    }}
                  >
                    <option value="caregiver">Caregiver</option>
                    <option value="vendor">Vendor</option>
                    <option value="both">Both</option>
                  </select>
                  <button
                    type="submit"
                    style={{
                      padding: "8px 20px",
                      backgroundColor: "var(--theme-positive)",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontWeight: "bold",
                    }}
                  >
                    Add Service
                  </button>
                </div>
              </form>
            </div>

            <h3>Existing Services</h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
                gap: "20px",
              }}
            >
              {services.map((service) => (
                <div
                  key={service.id}
                  style={{
                    backgroundColor: "white",
                    padding: "15px",
                    borderRadius: "8px",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  }}
                >
                  {editingService === service.id ? (
                    <div>
                      <input
                        type="text"
                        value={editServiceLabel}
                        onChange={(e) => setEditServiceLabel(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px",
                          marginBottom: "10px",
                          borderRadius: "4px",
                          border: "1px solid var(--theme-neutral-light)",
                        }}
                      />
                      <div style={{ display: "flex", gap: "10px" }}>
                        <button
                          onClick={() =>
                            handleUpdateService(service.id, editServiceLabel)
                          }
                          style={{
                            flex: 1,
                            padding: "8px",
                            backgroundColor: "var(--theme-positive)",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "12px",
                          }}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingService(null)}
                          style={{
                            flex: 1,
                            padding: "8px",
                            backgroundColor: "var(--theme-text-muted)",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "12px",
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h5>{service.label}</h5>
                      <p>
                        <strong>Category:</strong> {service.category}
                      </p>
                      <div
                        style={{
                          display: "flex",
                          gap: "10px",
                          marginTop: "10px",
                        }}
                      >
                        <button
                          onClick={() => {
                            setEditingService(service.id);
                            setEditServiceLabel(service.label);
                          }}
                          style={{
                            flex: 1,
                            padding: "8px",
                            backgroundColor: "var(--theme-help)",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "12px",
                          }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteService(service.id)}
                          style={{
                            flex: 1,
                            padding: "8px",
                            backgroundColor: "var(--theme-danger)",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "12px",
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== TAB: ADMINS ===== */}
      {activeTab === "admins" && (
        <div>
          <div style={{ marginBottom: "20px" }}>
            <button
              onClick={() => setShowAddSuperAdminForm(!showAddSuperAdminForm)}
              style={{
                padding: "10px 20px",
                backgroundColor: "var(--theme-positive)",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              {showAddSuperAdminForm ? "Cancel" : "+ Add Superadmin"}
            </button>
          </div>

          {showAddSuperAdminForm && (
            <div
              style={{
                backgroundColor: "white",
                padding: "20px",
                borderRadius: "8px",
                marginBottom: "20px",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              }}
            >
              <h3>Create New Superadmin</h3>
              <form onSubmit={handleCreateSuperAdmin}>
                <div style={{ marginBottom: "15px" }}>
                  <label style={{ display: "block", marginBottom: "5px" }}>
                    Admin Name *
                  </label>
                  <input
                    type="text"
                    value={newSuperAdminName}
                    onChange={(e) => setNewSuperAdminName(e.target.value)}
                    placeholder="e.g., Sarah Admin"
                    required
                    style={{
                      width: "100%",
                      padding: "8px",
                      borderRadius: "4px",
                      border: "1px solid var(--theme-neutral-light)",
                    }}
                  />
                </div>
                <div style={{ marginBottom: "15px" }}>
                  <label style={{ display: "block", marginBottom: "5px" }}>
                    Email *
                  </label>
                  <input
                    type="email"
                    value={newSuperAdminEmail}
                    onChange={(e) => setNewSuperAdminEmail(e.target.value)}
                    placeholder="admin@sewak.example"
                    required
                    style={{
                      width: "100%",
                      padding: "8px",
                      borderRadius: "4px",
                      border: "1px solid var(--theme-neutral-light)",
                    }}
                  />
                </div>
                <p style={{ margin: "0 0 15px", color: "var(--theme-text-muted)", fontSize: 13 }}>
                  A secure one-time invitation is generated after provisioning. This screen never collects or stores an administrator&apos;s password.
                </p>
                <button
                  type="submit"
                  disabled={addingSuperAdmin}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: addingSuperAdmin ? "var(--theme-border)" : "var(--theme-help)",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: addingSuperAdmin ? "not-allowed" : "pointer",
                    fontWeight: "bold",
                  }}
                >
                  {addingSuperAdmin ? "Creating..." : "Create Superadmin"}
                </button>
              </form>
            </div>
          )}

          <h3>Current Superadmins</h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: "20px",
            }}
          >
            {superAdmins.map((admin) => (
              <div
                key={admin.id}
                style={{
                  backgroundColor: "white",
                  padding: "20px",
                  borderRadius: "8px",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  border:
                    admin.id === currentUser?.uid
                      ? "2px solid var(--theme-help)"
                      : "1px solid var(--theme-neutral-light)",
                }}
              >
                <h5>{admin.name}</h5>
                <p>
                  <strong>Email:</strong> {admin.email}
                </p>
                <p>
                  <strong>Created:</strong>{" "}
                  {admin.createdAt
                    ? new Date(admin.createdAt).toLocaleDateString()
                    : "-"}
                </p>
                <p>
                  <strong>Status:</strong>{" "}
                  {admin.isSuspended ? "🚫 Suspended" : "✅ Active"}
                </p>
                {admin.id === currentUser?.uid && (
                  <p style={{ color: "var(--theme-help)", fontWeight: "bold" }}>
                    👤 (You)
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== TAB: BLACKLIST ===== */}
      {activeTab === "blacklist" && (
        <div>
          <div
            style={{
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <h3 style={{ margin: 0 }}>Blacklist Reports</h3>
            <select
              className="dropdown-select"
              value={blacklistFilter}
              onChange={(e) => setBlacklistFilter(e.target.value)}
              style={{
                minWidth: "180px",
                maxWidth: "240px",
                width: "auto",
                padding: "8px 10px",
                borderRadius: "4px",
                border: "1px solid var(--theme-neutral-light)",
                fontSize: "14px",
              }}
            >
              <option value="pending">Pending Reports ({pendingBlacklistCount})</option>
              <option value="approved">Approved ({approvedBlacklistCount})</option>
              <option value="rejected">Rejected ({rejectedBlacklistCount})</option>
            </select>
          </div>

          <div style={{ marginBottom: "30px" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))",
                gap: "20px",
              }}
            >
              {blacklistReports
                .filter((report) => report.status === blacklistFilter)
                .map((report) => (
                  <div
                    key={report.id}
                    style={{
                      backgroundColor: "white",
                      padding: "20px",
                      borderRadius: "8px",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                      borderLeft: `4px solid ${
                        report.status === "approved"
                          ? "var(--theme-positive)"
                          : report.status === "rejected"
                            ? "var(--theme-danger)"
                            : "var(--theme-warning)"
                      }`,
                    }}
                  >
                    <h5>Report #{report.id.substring(0, 8)}</h5>
                    <p>
                      <strong>User ID:</strong> {report.userId}
                    </p>
                    <p>
                      <strong>Reported by:</strong>{" "}
                      {vendors.find((v) => v.id === report.reportedBy)?.name ||
                        report.reportedByName ||
                        report.reportedBy ||
                        "Caregiver"}
                    </p>
                    <p>
                      <strong>Organization:</strong>{" "}
                      {organizations.find(
                        (org) =>
                          org.id === report.reportedByOrgId ||
                          org.id ===
                            vendors.find((v) => v.id === report.reportedBy)
                              ?.organizationId,
                      )?.organizationName ||
                        vendors.find((v) => v.id === report.reportedBy)
                          ?.organizationName ||
                        "Unknown"}
                    </p>
                    <p>
                      <strong>Reason:</strong> {report.reason}
                    </p>
                    <p>
                      <strong>Status:</strong> {report.status.toUpperCase()}
                    </p>
                    {report.status === "pending" && (
                      <div
                        style={{
                          marginTop: "10px",
                          display: "flex",
                          gap: "10px",
                        }}
                      >
                        <button
                          onClick={() =>
                            handleApproveBlacklistReport(report.id)
                          }
                          style={{
                            flex: 1,
                            padding: "8px 15px",
                            backgroundColor: "var(--theme-positive)",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "12px",
                          }}
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleRejectBlacklistReport(report.id)}
                          style={{
                            flex: 1,
                            padding: "8px 15px",
                            backgroundColor: "var(--theme-danger)",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "12px",
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>

          <div>
            <h3>Blacklisted Users</h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: "20px",
              }}
            >
              {blacklist.map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    backgroundColor: "var(--theme-warning-soft)",
                    padding: "20px",
                    borderRadius: "8px",
                    border: "1px solid var(--theme-danger-soft)",
                  }}
                >
                  <h5>🚫 {entry.userName || entry.userId}</h5>
                  <p>
                    <strong>User ID:</strong> {entry.userId}
                  </p>
                  <p>
                    <strong>Reported by:</strong>{" "}
                    {vendors.find((v) => v.id === entry.reportedBy)?.name ||
                      entry.reportedByName ||
                      entry.reportedBy ||
                      "Caregiver"}
                  </p>
                  <p>
                    <strong>Organization:</strong>{" "}
                    {organizations.find((org) => org.id === entry.reportedByOrgId)
                      ?.organizationName ||
                      vendors.find((v) => v.id === entry.reportedBy)
                        ?.organizationName ||
                      "Unknown"}
                  </p>
                  <p>
                    <strong>Blacklisted by:</strong>{" "}
                    {entry.blacklistedBy || entry.approvedBy || "Unknown"}
                  </p>
                  <p>
                    <strong>Type:</strong> {entry.userType}
                  </p>
                  <p>
                    <strong>Reason:</strong> {entry.reason}
                  </p>
                  <p>
                    <strong>Added:</strong>{" "}
                    {entry.addedAt
                      ? entry.addedAt.toDate().toLocaleDateString()
                      : "-"}
                  </p>
                  <p
                    style={{
                      margin: "10px 0 0",
                      color: "var(--theme-text-muted)",
                      fontSize: "12px",
                    }}
                  >
                    Reinstatement requires a trusted server review.
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== TAB: ANALYTICS ===== */}
      {activeTab === "analytics" && (
        <div>
          <h2>Platform Analytics</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "20px",
              marginBottom: "30px",
            }}
          >
            <div
              style={{
                backgroundColor: "white",
                padding: "20px",
                borderRadius: "8px",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                textAlign: "center",
              }}
            >
              <h3 style={{ color: "var(--theme-help)" }}>
                {analytics.totalOrganizations}
              </h3>
              <p>Total Organizations</p>
            </div>
            <div
              style={{
                backgroundColor: "white",
                padding: "20px",
                borderRadius: "8px",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                textAlign: "center",
              }}
            >
              <h3 style={{ color: "var(--theme-positive)" }}>
                {analytics.approvedOrganizations}
              </h3>
              <p>Approved Organizations</p>
            </div>
            <div
              style={{
                backgroundColor: "white",
                padding: "20px",
                borderRadius: "8px",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                textAlign: "center",
              }}
            >
              <h3 style={{ color: "var(--theme-help)" }}>{analytics.totalCaregivers}</h3>
              <p>Total Caregivers</p>
            </div>
            <div
              style={{
                backgroundColor: "white",
                padding: "20px",
                borderRadius: "8px",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                textAlign: "center",
              }}
            >
              <h3 style={{ color: "var(--theme-positive)" }}>
                {analytics.approvedCaregivers}
              </h3>
              <p>Approved Caregivers</p>
            </div>
            <div
              style={{
                backgroundColor: "white",
                padding: "20px",
                borderRadius: "8px",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                textAlign: "center",
              }}
            >
              <h3 style={{ color: "var(--theme-warning)" }}>{analytics.totalBookings}</h3>
              <p>Total Bookings</p>
            </div>
            <div
              style={{
                backgroundColor: "white",
                padding: "20px",
                borderRadius: "8px",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                textAlign: "center",
              }}
            >
              <h3 style={{ color: "var(--theme-positive)" }}>
                {analytics.completedBookings}
              </h3>
              <p>Completed Bookings</p>
            </div>
            <div
              style={{
                backgroundColor: "white",
                padding: "20px",
                borderRadius: "8px",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                textAlign: "center",
              }}
            >
              <h3 style={{ color: "var(--theme-help)" }}>
                Rs. {analytics.totalRevenue.toFixed(2)}
              </h3>
              <p>Total Revenue</p>
            </div>
            <div
              style={{
                backgroundColor: "white",
                padding: "20px",
                borderRadius: "8px",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                textAlign: "center",
              }}
            >
              <h3 style={{ color: "var(--theme-text-muted)" }}>
                Rs. {analytics.platformEarnings.toFixed(2)}
              </h3>
              <p>Platform Earnings</p>
            </div>
          </div>

          <div
            style={{
              backgroundColor: "white",
              padding: "20px",
              borderRadius: "8px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            }}
          >
            <h3>Global Commission Settings</h3>
            <p>
              <strong>Current Rate:</strong> {globalCommissionRate}%
            </p>
            {editingCommission ? (
              <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                <input
                  type="number"
                  value={globalCommissionRate}
                  onChange={(e) =>
                    setGlobalCommissionRate(Number(e.target.value))
                  }
                  min="0"
                  max="100"
                  style={{
                    padding: "8px",
                    borderRadius: "4px",
                    border: "1px solid var(--theme-neutral-light)",
                    flex: 1,
                  }}
                />
                <button
                  onClick={() =>
                    handleUpdateGlobalCommission(globalCommissionRate)
                  }
                  style={{
                    padding: "8px 20px",
                    backgroundColor: "var(--theme-positive)",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Update
                </button>
                <button
                  onClick={() => setEditingCommission(false)}
                  style={{
                    padding: "8px 20px",
                    backgroundColor: "var(--theme-text-muted)",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditingCommission(true)}
                style={{
                  marginTop: "10px",
                  padding: "8px 20px",
                  backgroundColor: "var(--theme-help)",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Edit Commission Rate
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
