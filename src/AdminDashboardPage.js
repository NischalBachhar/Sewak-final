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
  serverTimestamp,
  query,
  where,
  addDoc,
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
} from "firebase/auth";
import { db, auth } from "./firebaseConfig";
import { saveOrganizationRecord } from "./saveOrganizationRecord";
import "./OrganizationDashboard.css";

const dashboardTabs = [
  "organizations",
  "caregivers",
  "bookings",
  "services",
  "blacklist",
  "admins",
  "analytics",
];

export default function AdminDashboardPage() {
  // ============ AUTH STATE ============
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [permissionsError, setPermissionsError] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // ============ UI STATE ============
  const [activeTab, setActiveTab] = useState("organizations");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // ============ ORGANIZATIONS ============
  const [organizations, setOrganizations] = useState([]);
  const [loadingOrganizations, setLoadingOrganizations] = useState(true);
  const [orgStatusFilter, setOrgStatusFilter] = useState("all");
  const [searchOrg, setSearchOrg] = useState("");
  const [selectedOrg, setSelectedOrg] = useState(null);

  const [showAddOrgForm, setShowAddOrgForm] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgAdminName, setNewOrgAdminName] = useState("");
  const [newOrgEmail, setNewOrgEmail] = useState("");
  const [newOrgPassword, setNewOrgPassword] = useState("");
  const [newOrgPhone, setNewOrgPhone] = useState("");
  const [newOrgAddress, setNewOrgAddress] = useState("");
  const [newOrgCity, setNewOrgCity] = useState("");
  const [newOrgCommission, setNewOrgCommission] = useState(15);
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
  const [orgNewPassword, setOrgNewPassword] = useState("");

  // ============ CAREGIVERS ============
  const [vendors, setVendors] = useState([]);
  const [orgCaregivers, setOrgCaregivers] = useState([]);
  const [showOrgCaregiversModal, setShowOrgCaregiversModal] = useState(false);
  const [loadingVendors, setLoadingVendors] = useState(false);
  const [vendorStatusFilter, setVendorStatusFilter] = useState("all");
  const [searchVendor, setSearchVendor] = useState("");
  const [showCaregiverPasswordModal, setShowCaregiverPasswordModal] =
    useState(false);
  const [caregiverPasswordUser, setCaregiverPasswordUser] = useState(null);
  const [caregiverNewPassword, setCaregiverNewPassword] = useState("");

  const [showCaregiverBlacklistModal, setShowCaregiverBlacklistModal] =
    useState(false);
  const [caregiverBlacklistUser, setCaregiverBlacklistUser] = useState(null);
  const [caregiverBlacklistReason, setCaregiverBlacklistReason] = useState("");

  // ============ SUPER ADMINS ============
  const [superAdmins, setSuperAdmins] = useState([]);
  const [showAddSuperAdminForm, setShowAddSuperAdminForm] = useState(false);
  const [newSuperAdminName, setNewSuperAdminName] = useState("");
  const [newSuperAdminEmail, setNewSuperAdminEmail] = useState("");
  const [newSuperAdminPassword, setNewSuperAdminPassword] = useState("");
  const [addingSuperAdmin, setAddingSuperAdmin] = useState(false);

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
      : "organizations";

    if (newTab !== activeTab) {
      setActiveTab(newTab);
    }
  }, [location.pathname, activeTab]);

  // ============ LOAD ALL DATA ============
  const calculateAnalytics = useCallback(async () => {
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
        totalOrganizations: organizations.length,
        approvedOrganizations: organizations.filter((o) => o.isApproved).length,
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
    try {
      // Organizations
      try {
        setLoadingOrganizations(true);
        const orgSnap = await getDocs(collection(db, "organizations"));
        const orgsData = orgSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setOrganizations(orgsData);
        setLoadingOrganizations(false);
      } catch (err) {
        console.error("Error loading organizations:", err);
        setError("Failed to load organizations");
      } finally {
        setLoadingOrganizations(false);
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
        const bookingsData = bookingSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
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
      await calculateAnalytics();
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
  }, [auth, loadAllData]);

  // ============ CREATE FIRST SUPERADMIN (OPTIONAL) ============
  const createFirstSuperAdminIfNeeded = async () => {
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      const allUsers = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const superAdminList = allUsers.filter((u) => u.role === "superadmin");

      if (superAdminList.length === 0) {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          "admin@gharsathi.com",
          "admin123",
        );
        const uid = userCredential.user.uid;

        const userData = {
          uid,
          name: "Super Admin",
          email: "admin@gharsathi.com",
          role: "superadmin",
          createdAt: new Date().toISOString(),
          isApproved: true,
          isSuspended: false,
          profileComplete: true,
          permissions: [
            "read",
            "write",
            "delete",
            "approve_vendors",
            "manage_admins",
          ],
        };

        await setDoc(doc(db, "users", uid), userData);

        setSuccessMessage(
          "First superadmin account created! Please log in with admin@gharsathi.com / admin123",
        );
        setTimeout(() => setSuccessMessage(""), 10000);
      } else {
        setError(
          "Superadmin accounts exist. Please log in with a superadmin account.",
        );
      }
    } catch (error) {
      console.error("Error creating first superadmin:", error);
      setError("Failed to initialize superadmin: " + error.message);
    }
  };

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
    setAddingOrg(true);

    try {
      const orgCred = await createUserWithEmailAndPassword(
        auth,
        newOrgEmail,
        newOrgPassword,
      );
      const orgUid = orgCred.user.uid;

      const userData = {
        uid: orgUid,
        name: newOrgAdminName,
        email: newOrgEmail,
        role: "orgadmin",
        organizationName: newOrgName,
        organizationId: orgUid,
        businessPhone: newOrgPhone,
        businessAddress: newOrgAddress,
        businessCity: newOrgCity,
        createdAt: new Date().toISOString(),
        isApproved: true,
        isSuspended: false,
        profileComplete: true,
        createdBy: currentUser?.email || "system",
      };
      await setDoc(doc(db, "users", orgUid), userData);

      await saveOrganizationRecord({
        orgUid,
        organizationName: newOrgName,
        adminName: newOrgAdminName,
        adminEmail: newOrgEmail,
        businessPhone: newOrgPhone,
        businessAddress: newOrgAddress,
        businessCity: newOrgCity,
      });

      await updateDoc(doc(db, "organizations", orgUid), {
        commissionRate: Number(newOrgCommission) || 15,
        isApproved: true,
        verified: true,
        createdBy: currentUser?.email || "system",
      });

      setSuccessMessage("Organization created successfully!");
      setNewOrgName("");
      setNewOrgAdminName("");
      setNewOrgEmail("");
      setNewOrgPassword("");
      setNewOrgPhone("");
      setNewOrgAddress("");
      setNewOrgCity("");
      setNewOrgCommission(15);
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
        email: editOrgEmail,
        businessPhone: editOrgPhone,
        businessAddress: editOrgAddress,
        businessCity: editOrgCity,
        commissionRate: Number(editOrgCommission) || 15,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser?.email || "system",
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
          updatedBy: currentUser?.email || "system",
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

  const handleOpenOrgPasswordModal = (org) => {
    setOrgPasswordOrg(org);
    setOrgNewPassword("");
    setShowOrgPasswordModal(true);
  };

  const handleSubmitOrgPasswordChange = async (e) => {
    e.preventDefault();
    if (!orgPasswordOrg || !orgPasswordOrg.email || !orgNewPassword) return;

    try {
      await addDoc(collection(db, "adminPasswordResets"), {
        targetEmail: orgPasswordOrg.email,
        targetUserId: orgPasswordOrg.id,
        newPassword: orgNewPassword,
        createdAt: serverTimestamp(),
        requestedBy: currentUser?.email || "superadmin",
        role: "orgadmin",
      });

      setSuccessMessage(
        "Password reset request created. Backend admin function must apply the change.",
      );
      setShowOrgPasswordModal(false);
      setOrgPasswordOrg(null);
      setOrgNewPassword("");
    } catch (err) {
      console.error("Error creating password reset request:", err);
      setError("Failed to create password reset request: " + err.message);
    }
  };

  const handleOpenOrgBlacklistModal = (org) => {
    setOrgBlacklistOrg(org);
    setOrgBlacklistReason("");
    setShowOrgBlacklistModal(true);
  };

  const handleSubmitOrgBlacklist = async (e) => {
    e.preventDefault();
    if (!orgBlacklistOrg) return;

    try {
      const org = orgBlacklistOrg;

      await updateDoc(doc(db, "organizations", org.id), {
        isBlacklisted: true,
        blacklistedAt: serverTimestamp(),
        blacklistedBy: currentUser?.email || "superadmin",
        blacklistReason: orgBlacklistReason || "Blacklisted by superadmin",
      });

      await addDoc(collection(db, "blacklist"), {
        userId: org.id,
        userType: "organization",
        reason: orgBlacklistReason || "Blacklisted by superadmin",
        addedAt: serverTimestamp(),
        approvedBy: currentUser?.email || "superadmin",
      });

      const q = query(
        collection(db, "vendors"),
        where("organizationId", "==", org.id),
      );
      const snap = await getDocs(q);

      for (const d of snap.docs) {
        const caregiverId = d.id;

        await updateDoc(doc(db, "vendors", caregiverId), {
          isBlacklisted: true,
          blacklistedAt: serverTimestamp(),
          blacklistedBy: currentUser?.email || "superadmin",
          blacklistReason:
            orgBlacklistReason ||
            `Organization ${org.organizationName} blacklisted`,
        });

        await addDoc(collection(db, "blacklist"), {
          userId: caregiverId,
          userType: "caregiver",
          reason:
            orgBlacklistReason ||
            `Organization ${org.organizationName} blacklisted`,
          addedAt: serverTimestamp(),
          approvedBy: currentUser?.email || "superadmin",
        });
      }

      setSuccessMessage(
        "Organization and all its caregivers have been blacklisted.",
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
    try {
      await updateDoc(doc(db, "organizations", orgId), {
        isApproved: true,
        verified: true,
        approvedAt: serverTimestamp(),
        approvedBy: currentUser?.email || "superadmin",
      });
      setSuccessMessage("Organization approved!");
      await loadAllData();
    } catch (err) {
      console.error("Error approving organization:", err);
      setError("Failed to approve organization: " + err.message);
    }
  };

  const handleRejectOrganization = async (orgId) => {
    const reason = window.prompt("Enter rejection reason");
    if (!reason) return;
    try {
      await updateDoc(doc(db, "organizations", orgId), {
        isApproved: false,
        verified: false,
        rejectionReason: reason,
        rejectedAt: serverTimestamp(),
        rejectedBy: currentUser?.email || "superadmin",
      });
      setSuccessMessage("Organization rejected!");
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

  const handleRejectCaregiverClick = async (caregiverId) => {
    const reason = window.prompt("Enter rejection reason:");
    if (!reason) return;

    try {
      const now = serverTimestamp();
      await updateDoc(doc(db, "vendors", caregiverId), {
        isApproved: false,
        rejectionReason: reason,
        rejectedAt: now,
        rejectedBy: currentUser?.email || "superadmin",
      });
      setVendors((prev) =>
        prev.map((vendor) =>
          vendor.id === caregiverId
            ? {
                ...vendor,
                isApproved: false,
                rejectionReason: reason,
                rejectedAt: now,
                rejectedBy: currentUser?.email || "superadmin",
              }
            : vendor,
        ),
      );
      setSuccessMessage("Caregiver rejected!");
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

  const handleOpenCaregiverPasswordModal = (caregiver) => {
    setCaregiverPasswordUser(caregiver);
    setCaregiverNewPassword("");
    setShowCaregiverPasswordModal(true);
  };

  const handleSubmitCaregiverPasswordChange = async (e) => {
    e.preventDefault();
    if (
      !caregiverPasswordUser?.id ||
      !caregiverPasswordUser?.email ||
      !caregiverNewPassword
    ) {
      return;
    }

    try {
      await addDoc(collection(db, "adminPasswordResets"), {
        targetEmail: caregiverPasswordUser.email,
        targetUserId: caregiverPasswordUser.id,
        newPassword: caregiverNewPassword,
        createdAt: serverTimestamp(),
        requestedBy: currentUser?.email || "superadmin",
        role: "caregiver",
      });

      setSuccessMessage(
        "Caregiver password reset request created. Backend must apply the change.",
      );
      setShowCaregiverPasswordModal(false);
      setCaregiverPasswordUser(null);
      setCaregiverNewPassword("");
    } catch (err) {
      console.error("Error creating caregiver password reset:", err);
      setError("Failed to create caregiver password reset: " + err.message);
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
      const user = caregiverBlacklistUser;

      await updateDoc(doc(db, "vendors", user.id), {
        isBlacklisted: true,
        blacklistedAt: serverTimestamp(),
        blacklistedBy: currentUser?.email || "superadmin",
        blacklistReason:
          caregiverBlacklistReason || "Blacklisted by superadmin",
      });

      await addDoc(collection(db, "blacklist"), {
        userId: user.id,
        userType: "caregiver",
        reason: caregiverBlacklistReason || "Blacklisted by superadmin",
        addedAt: serverTimestamp(),
        approvedBy: currentUser?.email || "superadmin",
      });

      setSuccessMessage("Caregiver has been blacklisted.");
      setShowCaregiverBlacklistModal(false);
      setCaregiverBlacklistUser(null);
      setCaregiverBlacklistReason("");

      await loadAllData();
    } catch (err) {
      console.error("Error blacklisting caregiver:", err);
      setError("Failed to blacklist caregiver: " + err.message);
    }
  };

  const handleDeleteCaregiver = async (caregiverId) => {
    if (!window.confirm("Are you sure you want to delete this caregiver?"))
      return;

    try {
      await deleteDoc(doc(db, "vendors", caregiverId));
      try {
        await deleteDoc(doc(db, "users", caregiverId));
      } catch {
        // users doc may not exist
      }
      setSuccessMessage("Caregiver deleted!");
      if (selectedOrg) await handleOrgClick(selectedOrg);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      console.error("Error deleting caregiver:", err);
      setError("Failed to delete caregiver: " + err.message);
    }
  };

  const handleEditCaregiver = async (caregiverId, updatedData) => {
    try {
      await updateDoc(doc(db, "vendors", caregiverId), updatedData);
      setSuccessMessage("Caregiver updated successfully!");
      if (selectedOrg) await handleOrgClick(selectedOrg);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      console.error("Error updating caregiver:", err);
      setError("Failed to update caregiver: " + err.message);
    }
  };

  // ============ HANDLERS: SUPER ADMINS ============
  const handleCreateSuperAdmin = async (e) => {
    e.preventDefault();
    setError("");
    setAddingSuperAdmin(true);

    try {
      const adminCred = await createUserWithEmailAndPassword(
        auth,
        newSuperAdminEmail,
        newSuperAdminPassword,
      );
      const adminUid = adminCred.user.uid;

      const userData = {
        uid: adminUid,
        name: newSuperAdminName,
        email: newSuperAdminEmail,
        role: "superadmin",
        createdAt: new Date().toISOString(),
        isApproved: true,
        isSuspended: false,
        createdBy: currentUser?.email || "system",
        permissions: [
          "read",
          "write",
          "delete",
          "approve_vendors",
          "manage_admins",
        ],
      };

      await setDoc(doc(db, "users", adminUid), userData);

      setSuccessMessage("Superadmin created successfully!");
      setNewSuperAdminName("");
      setNewSuperAdminEmail("");
      setNewSuperAdminPassword("");
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

  const handleDeleteSuperAdmin = async (adminId) => {
    if (adminId === currentUser?.uid) {
      setError("You cannot delete your own account!");
      return;
    }
    if (!window.confirm("Are you sure? This will delete the admin account.")) {
      return;
    }

    try {
      await deleteDoc(doc(db, "users", adminId));
      setSuccessMessage("Superadmin deleted!");
      const usersSnap = await getDocs(collection(db, "users"));
      const allUsers = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setSuperAdmins(allUsers.filter((u) => u.role === "superadmin"));
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      console.error("Error deleting superadmin:", err);
      setError("Failed to delete superadmin: " + err.message);
    }
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

      await addDoc(collection(db, "blacklist"), {
        userId: reportData.userId,
        userName: reportData.userName || "",
        userType: reportData.userType || "user",
        reportedBy: reportData.reportedBy || "",
        reportedByName: reportData.reportedByName || "Caregiver",
        reportedByOrgId: reportData.reportedByOrgId || "",
        reason: reportData.reason,
        addedAt: serverTimestamp(),
        approvedBy: currentUser?.email || "system",
        blacklistedBy: currentUser?.email || "system",
        originalReportId: reportId,
      });

      await updateDoc(doc(db, "blacklistReports", reportId), {
        status: "approved",
        approvedAt: serverTimestamp(),
        approvedBy: currentUser?.email || "system",
      });

      setSuccessMessage("User blacklisted!");
      const reportsSnap = await getDocs(collection(db, "blacklistReports"));
      setBlacklistReports(
        reportsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      );
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
        rejectedBy: currentUser?.email || "system",
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

  const handleRemoveFromBlacklist = async (blacklistId) => {
    if (
      !window.confirm(
        "Are you sure you want to remove this user from blacklist?",
      )
    )
      return;

    try {
      await deleteDoc(doc(db, "blacklist", blacklistId));
      setSuccessMessage("User removed from blacklist!");
      const blacklistSnap = await getDocs(collection(db, "blacklist"));
      setBlacklist(blacklistSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      console.error("Error removing from blacklist:", err);
      setError("Failed to remove from blacklist: " + err.message);
    }
  };

  // ============ UI: LOADING / PERMISSIONS ============
  if (loadingAuth) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <h2>Loading...</h2>
        <p>Verifying permissions...</p>
      </div>
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
          <li>
            Verify your user role in Firestore &quot;users&quot; collection
          </li>
          <li>Contact system administrator if you need access</li>
        </ol>
        <p style={{ marginTop: "20px", fontSize: "12px", color: "var(--theme-text-muted)" }}>
          Current User: {currentUser?.email || "Not logged in"}
        </p>
        <button
          style={{
            marginTop: "10px",
            padding: "8px 12px",
            cursor: "pointer",
            borderRadius: 4,
            border: "1px solid var(--theme-danger)",
            background: "var(--theme-danger)",
            color: "var(--theme-button-text)",
          }}
          onClick={createFirstSuperAdminIfNeeded}
        >
          Initialize First Superadmin
        </button>
      </div>
    );
  }

  // ============ UI: MAIN DASHBOARD ============
  const pendingOrgCount = organizations.filter((org) => !org.isApproved).length;
  const approvedOrgCount = organizations.filter((org) => org.isApproved).length;
  const pendingCaregiverCount = vendors.filter((vendor) => vendor.isApproved !== true).length;
  const approvedCaregiverCount = vendors.filter((vendor) => vendor.isApproved === true).length;
  const pendingBlacklistCount = blacklistReports.filter((report) => report.status === "pending").length;
  const approvedBlacklistCount = blacklistReports.filter((report) => report.status === "approved").length;
  const rejectedBlacklistCount = blacklistReports.filter((report) => report.status === "rejected").length;

  const getTabLabel = (tab) => {
    const count =
      tab === "organizations"
        ? pendingOrgCount
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
            onClick={() => setError("")}
            style={{ marginLeft: "10px", cursor: "pointer" }}
          >
            Close
          </button>
        </div>
      )}

      {/* Success Messages */}
      {successMessage && (
        <div
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

      {/* Tabs */}
      <div
        style={{
          marginBottom: "30px",
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
        }}
      >
        {[
          "organizations",
          "caregivers",
          "bookings",
          "services",
          "blacklist",
          "admins",
          "analytics",
        ].map((tab) => (
          <button
            type="button"
            key={tab}
            onClick={() => navigate(`/superadmin/${tab}`)}
            style={{
              padding: "10px 20px",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              backgroundColor: activeTab === tab ? "var(--theme-help)" : "var(--theme-border)",
              color: activeTab === tab ? "white" : "black",
              fontWeight: activeTab === tab ? "bold" : "normal",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            {getTabLabel(tab)}
          </button>
        ))}
      </div>

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

          {loadingOrganizations ? (
            <p>Loading organizations...</p>
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
                          Change Password
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
                  <div style={{ marginBottom: "15px" }}>
                    <label style={{ display: "block", marginBottom: "5px" }}>
                      Password *
                    </label>
                    <input
                      type="password"
                      value={newOrgPassword}
                      onChange={(e) => setNewOrgPassword(e.target.value)}
                      placeholder="Secure password"
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
                  <div style={{ marginBottom: "15px" }}>
                    <label style={{ display: "block", marginBottom: "5px" }}>
                      Commission Rate (%) *
                    </label>
                    <input
                      type="number"
                      value={newOrgCommission}
                      onChange={(e) => setNewOrgCommission(e.target.value)}
                      placeholder="15"
                      min="0"
                      max="100"
                      required
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid var(--theme-neutral-light)",
                      }}
                    />
                  </div>
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
                setOrgNewPassword("");
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
                      setOrgNewPassword("");
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

                <form onSubmit={handleSubmitOrgPasswordChange}>
                  <div style={{ marginBottom: 15 }}>
                    <label style={{ display: "block", marginBottom: 5 }}>
                      New Password
                    </label>
                    <input
                      type="password"
                      value={orgNewPassword}
                      onChange={(e) => setOrgNewPassword(e.target.value)}
                      required
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
                      backgroundColor: "var(--theme-help)",
                      color: "white",
                      border: "none",
                      borderRadius: 4,
                      cursor: "pointer",
                      fontWeight: "bold",
                    }}
                  >
                    Create Reset Request
                  </button>
                </form>
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
                          <button
                            onClick={() => handleDeleteCaregiver(caregiver.id)}
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
                            Delete
                          </button>
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
                setCaregiverNewPassword("");
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
                      setCaregiverNewPassword("");
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

                <form onSubmit={handleSubmitCaregiverPasswordChange}>
                  <div style={{ marginBottom: 15 }}>
                    <label style={{ display: "block", marginBottom: 5 }}>
                      New Password
                    </label>
                    <input
                      type="password"
                      value={caregiverNewPassword}
                      onChange={(e) => setCaregiverNewPassword(e.target.value)}
                      required
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
                      backgroundColor: "var(--theme-help)",
                      color: "white",
                      border: "none",
                      borderRadius: 4,
                      cursor: "pointer",
                      fontWeight: "bold",
                    }}
                  >
                    Create Reset Request
                  </button>
                </form>
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
            <p>Loading caregivers...</p>
          ) : (
            <div>
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
                        <strong>Hourly Rate:</strong> Rs. {vendor.hourlyRate}
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
                          onClick={() => handleDeleteCaregiver(vendor.id)}
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
                          Delete
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
                          Change Password
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
            <p>Loading bookings...</p>
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
                  <option value="confirmed">Confirmed</option>
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
                        booking.bookingDate?.includes(bookingDateFilter)),
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
                                : booking.status === "confirmed"
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
                        <strong>Caregiver:</strong> {booking.vendorName}
                      </p>
                      <p>
                        <strong>Date:</strong> {booking.bookingDate}
                      </p>
                      <p>
                        <strong>Time:</strong> {booking.startTime} -{" "}
                        {booking.endTime}
                      </p>
                      <p>
                        <strong>Amount:</strong> Rs. {booking.totalAmount}
                      </p>
                      <p>
                        <strong>Platform Commission:</strong> Rs.{" "}
                        {booking.platformCommission}
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
                    placeholder="admin@gharsathi.com"
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
                    Password *
                  </label>
                  <input
                    type="password"
                    value={newSuperAdminPassword}
                    onChange={(e) => setNewSuperAdminPassword(e.target.value)}
                    placeholder="Secure password"
                    required
                    style={{
                      width: "100%",
                      padding: "8px",
                      borderRadius: "4px",
                      border: "1px solid var(--theme-neutral-light)",
                    }}
                  />
                </div>
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
                {admin.id !== currentUser?.uid && (
                  <button
                    onClick={() => handleDeleteSuperAdmin(admin.id)}
                    style={{
                      marginTop: "10px",
                      padding: "8px 15px",
                      backgroundColor: "var(--theme-danger)",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "12px",
                    }}
                  >
                    Delete Admin
                  </button>
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
                  <button
                    onClick={() => handleRemoveFromBlacklist(entry.id)}
                    style={{
                      marginTop: "10px",
                      padding: "8px 15px",
                      backgroundColor: "var(--theme-danger)",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "12px",
                    }}
                  >
                    Remove from Blacklist
                  </button>
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
