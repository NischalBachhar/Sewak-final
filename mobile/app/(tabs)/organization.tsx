import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Screen } from "@/components/Screen";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useAuth } from "@/auth/AuthProvider";
import {
  createOrganizationService,
  getOrganization,
  listBookings,
  listOrganizationCaregivers,
  listOrganizationServices,
  provisionCaregiver,
  retireOrganizationService,
  updateOrganizationCaregiverServices,
  updateOrganizationProfile,
} from "@/api/sewak";
import { Booking, Caregiver, Organization, PublicService } from "@/types";
import { formatNpr } from "@/domain/booking";
import { colors, radius, spacing } from "@/theme";

type Section = "overview" | "caregivers" | "services" | "bookings" | "profile";
const SHIFTS = ["morning", "day", "evening", "night"];

export default function OrganizationScreen() {
  const { user } = useAuth();
  const [section, setSection] = useState<Section>("overview");
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [caregivers, setCaregivers] = useState<Caregiver[]>([]);
  const [services, setServices] = useState<PublicService[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [invitation, setInvitation] = useState("");

  const [showCaregiverForm, setShowCaregiverForm] = useState(false);
  const [editingCaregiverId, setEditingCaregiverId] = useState<string | null>(null);
  const [editingServices, setEditingServices] = useState<string[]>([]);
  const [cgName, setCgName] = useState("");
  const [cgEmail, setCgEmail] = useState("");
  const [cgPhone, setCgPhone] = useState("");
  const [cgLocation, setCgLocation] = useState("");
  const [cgCategory, setCgCategory] = useState<"caregiver" | "vendor" | "both">("caregiver");
  const [cgWorkType, setCgWorkType] = useState<"parttime" | "fulltime">("parttime");
  const [cgShifts, setCgShifts] = useState<string[]>([]);
  const [cgServices, setCgServices] = useState<string[]>([]);
  const [cgRate, setCgRate] = useState("500");
  const [cgExperience, setCgExperience] = useState("0");

  const [serviceLabel, setServiceLabel] = useState("");
  const [serviceCategory, setServiceCategory] = useState("caregiver");

  const [orgName, setOrgName] = useState("");
  const [orgPhone, setOrgPhone] = useState("");
  const [orgAddress, setOrgAddress] = useState("");
  const [orgCity, setOrgCity] = useState("");

  const load = useCallback(async () => {
    if (!user || user.role !== "orgadmin") return;
    setError("");
    try {
      const [org, team, offeredServices, history] = await Promise.all([
        getOrganization(user.uid),
        listOrganizationCaregivers(user.uid),
        listOrganizationServices(user.uid),
        listBookings(user),
      ]);
      setOrganization(org);
      setCaregivers(team);
      setServices(offeredServices);
      setBookings(history);
      if (org) {
        setOrgName(org.organizationName || "");
        setOrgPhone(org.businessPhone || "");
        setOrgAddress(org.businessAddress || "");
        setOrgCity(org.businessCity || "");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load organization dashboard.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const completed = useMemo(() => bookings.filter((booking) => booking.status === "completed"), [bookings]);
  const revenue = useMemo(() => completed.reduce((sum, booking) => sum + Number(booking.totalAmount || 0), 0), [completed]);
  const caregiverEarnings = useMemo(() => completed.reduce((sum, booking) => sum + Number(booking.vendorEarnings || 0), 0), [completed]);
  const activeServices = useMemo(() => services.filter((service) => service.isActive !== false), [services]);
  const serviceName = (id: string) => services.find((service) => service.id === id || service.serviceId === id)?.label || services.find((service) => service.id === id || service.serviceId === id)?.serviceName || id.replaceAll("_", " ");
  const serviceAssignedCount = (id: string) => caregivers.filter((caregiver) => (caregiver.servicesOffered || []).includes(id)).length;

  if (!user || user.role !== "orgadmin") return <Screen><Text style={styles.error}>Organization access is not available for this account.</Text></Screen>;
  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>;

  if (!organization?.isApproved) {
    return (
      <Screen>
        <Text style={styles.eyebrow}>ORGANIZATION APPLICATION</Text>
        <Text style={styles.title}>{organization?.organizationName || "Sewak partner"}</Text>
        <View style={styles.pending}>
          <Text style={styles.pendingTitle}>Approval pending</Text>
          <Text style={styles.body}>Your organization is waiting for Sewak platform review. Caregiver provisioning and operational controls remain unavailable until approval.</Text>
        </View>
        {organization ? (
          <View style={styles.card}>
            <Row label="Admin" value={organization.adminName || user.displayName || "—"} />
            <Row label="Email" value={organization.adminEmail || user.email} />
            <Row label="Phone" value={organization.businessPhone || "—"} />
            <Row label="Address" value={organization.businessAddress || "—"} />
            <Row label="City" value={organization.businessCity || "—"} />
          </View>
        ) : null}
      </Screen>
    );
  }

  const run = async (task: () => Promise<unknown>, success?: string) => {
    setWorking(true); setError(""); setNotice("");
    try {
      await task();
      if (success) setNotice(success);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The organization update failed.");
    } finally { setWorking(false); }
  };

  const addCaregiver = async () => {
    if (!cgName.trim() || !cgEmail.trim() || !cgLocation.trim() || !cgPhone.trim()) {
      return setError("Name, email, phone and location are required.");
    }
    if (!cgServices.length) return setError("Choose at least one service.");
    setWorking(true); setError(""); setNotice(""); setInvitation("");
    try {
      const result = await provisionCaregiver({
        email: cgEmail.trim(),
        displayName: cgName.trim(),
        phone: cgPhone.trim(),
        location: cgLocation.trim(),
        category: cgCategory,
        workType: cgWorkType,
        shifts: cgWorkType === "parttime" ? cgShifts : [],
        servicesOffered: cgServices,
        hourlyRate: Number(cgRate) || 0,
        experience: Number(cgExperience) || 0,
      });
      setInvitation(result.invitation.activationToken);
      setNotice("Caregiver account created. It stays unavailable until authorized platform review is complete.");
      setShowCaregiverForm(false);
      setCgName(""); setCgEmail(""); setCgPhone(""); setCgLocation(""); setCgCategory("caregiver");
      setCgWorkType("parttime"); setCgShifts([]); setCgServices([]); setCgRate("500"); setCgExperience("0");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not provision caregiver.");
    } finally { setWorking(false); }
  };

  const addService = async () => {
    if (!serviceLabel.trim()) return setError("Enter a service name.");
    await run(async () => {
      await createOrganizationService(user.uid, organization.organizationName, serviceLabel, serviceCategory);
      setServiceLabel("");
    }, "Service added.");
  };

  const beginCaregiverServiceEdit = (caregiver: Caregiver) => {
    setError("");
    setNotice("");
    setEditingCaregiverId(caregiver.id);
    setEditingServices((caregiver.servicesOffered || []).filter((id) => activeServices.some((service) => service.id === id || service.serviceId === id)));
  };

  const saveCaregiverServices = async (caregiverId: string) => {
    if (!editingServices.length) return setError("Assign at least one active service to this caregiver.");
    setWorking(true); setError(""); setNotice("");
    try {
      await updateOrganizationCaregiverServices(caregiverId, editingServices);
      setEditingCaregiverId(null);
      setEditingServices([]);
      setNotice("Caregiver services updated.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update caregiver services.");
    } finally { setWorking(false); }
  };

  const saveProfile = async () => {
    if (!orgName.trim()) return setError("Organization name is required.");
    await run(
      () => updateOrganizationProfile(user.uid, {
        organizationName: orgName.trim(),
        businessPhone: orgPhone.trim(),
        businessAddress: orgAddress.trim(),
        businessCity: orgCity.trim(),
      }),
      "Organization profile saved.",
    );
  };

  return (
    <Screen>
      <Text style={styles.eyebrow}>ORGANIZATION</Text>
      <Text style={styles.title}>{organization.organizationName}</Text>
      <Text style={styles.body}>Manage your approved caregiver team, services and booking activity.</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {invitation ? (
        <View style={styles.invitation}>
          <Text style={styles.invitationTitle}>One-time caregiver activation token</Text>
          <Text style={styles.muted}>Share this token only through an approved private channel. It is shown here because automated invitation email is not configured.</Text>
          <Text selectable style={styles.token}>{invitation}</Text>
          <Pressable onPress={() => setInvitation("")}><Text style={styles.hide}>Hide token</Text></Pressable>
        </View>
      ) : null}

      <View style={styles.nav}>
        {(["overview","caregivers","services","bookings","profile"] as Section[]).map((item) => (
          <Pressable key={item} onPress={() => setSection(item)} style={[styles.navChip, section === item && styles.navChipActive]}>
            <Text style={[styles.navText, section === item && styles.navTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </View>

      {section === "overview" ? (
        <>
          <View style={styles.grid}>
            <Stat label="Caregivers" value={String(caregivers.length)} />
            <Stat label="Active" value={String(caregivers.filter((c) => c.isApproved && c.isAvailable).length)} />
            <Stat label="Bookings" value={String(bookings.length)} />
            <Stat label="Completed" value={String(completed.length)} />
            <Stat label="Gross care value" value={formatNpr(revenue)} />
            <Stat label="Caregiver earnings" value={formatNpr(caregiverEarnings)} />
          </View>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Organization status</Text>
            <Row label="Verified" value={organization.verified ? "Yes" : "No"} />
            <Row label="Commission rate" value={`${organization.commissionRate ?? 15}%`} />
            <Row label="Caregivers" value={String(organization.totalCaregivers ?? caregivers.length)} />
          </View>
        </>
      ) : null}

      {section === "caregivers" ? (
        <>
          <PrimaryButton label={showCaregiverForm ? "Hide caregiver form" : "Add caregiver"} onPress={() => setShowCaregiverForm((value) => !value)} />
          {showCaregiverForm ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Provision caregiver account</Text>
              <Field label="Full name *" value={cgName} onChangeText={setCgName} />
              <Field label="Email *" value={cgEmail} onChangeText={setCgEmail} keyboardType="email-address" autoCapitalize="none" />
              <Field label="Phone *" value={cgPhone} onChangeText={setCgPhone} keyboardType="phone-pad" />
              <Field label="Location *" value={cgLocation} onChangeText={setCgLocation} />
              <Field label="Hourly rate (NPR)" value={cgRate} onChangeText={setCgRate} keyboardType="numeric" />
              <Field label="Experience (years)" value={cgExperience} onChangeText={setCgExperience} keyboardType="numeric" />

              <Text style={styles.label}>Category</Text>
              <View style={styles.choices}>
                {(["caregiver","vendor","both"] as const).map((item) => <Choice key={item} label={item} active={cgCategory === item} onPress={() => setCgCategory(item)} />)}
              </View>
              <Text style={styles.label}>Work type</Text>
              <View style={styles.choices}>
                <Choice label="Part time" active={cgWorkType === "parttime"} onPress={() => setCgWorkType("parttime")} />
                <Choice label="Full time" active={cgWorkType === "fulltime"} onPress={() => { setCgWorkType("fulltime"); setCgShifts([]); }} />
              </View>
              {cgWorkType === "parttime" ? (
                <>
                  <Text style={styles.label}>Shifts</Text>
                  <View style={styles.choices}>{SHIFTS.map((shift) => <Choice key={shift} label={shift} active={cgShifts.includes(shift)} onPress={() => setCgShifts((current) => current.includes(shift) ? current.filter((x) => x !== shift) : [...current, shift])} />)}</View>
                </>
              ) : null}
              <Text style={styles.label}>Services *</Text>
              {activeServices.length ? (
                <View style={styles.choices}>
                  {activeServices.map((service) => (
                    <Choice key={service.id} label={service.label || service.serviceName || service.id} active={cgServices.includes(service.id)} onPress={() => setCgServices((current) => current.includes(service.id) ? current.filter((x) => x !== service.id) : [...current, service.id])} />
                  ))}
                </View>
              ) : (
                <Text style={styles.warnText}>Add an active organization service before creating a caregiver.</Text>
              )}
              <PrimaryButton label="Create caregiver & invitation" loading={working} disabled={!activeServices.length || !cgServices.length} onPress={addCaregiver} />
            </View>
          ) : null}

          {caregivers.map((caregiver) => (
            <View key={caregiver.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{caregiver.name}</Text>
                <Text style={caregiver.isApproved ? styles.goodBadge : styles.warnBadge}>{caregiver.isApproved ? "Approved" : "Pending review"}</Text>
              </View>
              <Text style={styles.muted}>{caregiver.location || "No location"} · {caregiver.workType || "Work type not set"}</Text>
              <Row label="Rate" value={`${formatNpr(caregiver.hourlyRate)}/hr`} />
              <Row label="Experience" value={`${caregiver.experience ?? 0} years`} />
              <Row label="Availability" value={caregiver.isAvailable ? "Available" : "Unavailable"} />
              <Row label="Services" value={(caregiver.servicesOffered || []).map(serviceName).join(", ") || "None assigned"} />
              {editingCaregiverId === caregiver.id ? (
                <View style={styles.serviceEditor}>
                  <Text style={styles.label}>Assigned booking services *</Text>
                  {activeServices.length ? (
                    <View style={styles.choices}>
                      {activeServices.map((service) => (
                        <Choice key={service.id} label={service.label || service.serviceName || service.id} active={editingServices.includes(service.id)} onPress={() => setEditingServices((current) => current.includes(service.id) ? current.filter((x) => x !== service.id) : [...current, service.id])} />
                      ))}
                    </View>
                  ) : <Text style={styles.warnText}>No active organization services are available.</Text>}
                  <PrimaryButton label="Save services" loading={working} disabled={!editingServices.length || !activeServices.length} onPress={() => saveCaregiverServices(caregiver.id)} />
                  <PrimaryButton label="Cancel" variant="secondary" disabled={working} onPress={() => { setEditingCaregiverId(null); setEditingServices([]); }} />
                </View>
              ) : (
                <PrimaryButton label="Edit services" variant="secondary" disabled={working} onPress={() => beginCaregiverServiceEdit(caregiver)} />
              )}
            </View>
          ))}
          {!caregivers.length ? <View style={styles.empty}><Text style={styles.body}>No caregivers yet.</Text></View> : null}
        </>
      ) : null}

      {section === "services" ? (
        <>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Add service</Text>
            <Field label="Service name" value={serviceLabel} onChangeText={setServiceLabel} />
            <Text style={styles.label}>Category</Text>
            <View style={styles.choices}>
              <Choice label="Caregiver" active={serviceCategory === "caregiver"} onPress={() => setServiceCategory("caregiver")} />
              <Choice label="Household / vendor" active={serviceCategory === "vendor"} onPress={() => setServiceCategory("vendor")} />
            </View>
            <PrimaryButton label="Add service" loading={working} onPress={addService} />
          </View>
          {services.map((service) => {
            const assignedCount = serviceAssignedCount(service.id);
            return (
              <View key={service.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{service.label || service.serviceName || service.id}</Text>
                    <Text style={styles.muted}>{service.category || "caregiver"} · {service.isActive === false ? "Retired" : "Active"} · {assignedCount} caregiver{assignedCount === 1 ? "" : "s"}</Text>
                  </View>
                  {service.isActive !== false && assignedCount === 0 ? (
                    <Pressable disabled={working} onPress={() => run(() => retireOrganizationService(service.id), "Service retired.")}><Text style={styles.retire}>Retire</Text></Pressable>
                  ) : null}
                </View>
                {service.isActive !== false && assignedCount > 0 ? <Text style={styles.warnText}>Unassign this service from every caregiver before retiring it.</Text> : null}
              </View>
            );
          })}
        </>
      ) : null}

      {section === "bookings" ? (
        <>
          {bookings.map((booking) => (
            <View key={booking.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{booking.caregiverName || "Caregiver"}</Text>
                <Text style={styles.status}>{booking.status.replaceAll("_", " ")}</Text>
              </View>
              <Text style={styles.body}>{booking.userName || "Customer"} · {booking.serviceLabel || "Care support"}</Text>
              <Text style={styles.muted}>{[booking.date, booking.time || booking.requestedTimeWindows?.join(", "), formatNpr(booking.totalAmount)].filter(Boolean).join(" · ")}</Text>
            </View>
          ))}
          {!bookings.length ? <View style={styles.empty}><Text style={styles.body}>No organization bookings yet.</Text></View> : null}
        </>
      ) : null}

      {section === "profile" ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Organization profile</Text>
          <Field label="Organization name *" value={orgName} onChangeText={setOrgName} />
          <Field label="Business phone" value={orgPhone} onChangeText={setOrgPhone} keyboardType="phone-pad" />
          <Field label="Business address" value={orgAddress} onChangeText={setOrgAddress} />
          <Field label="Business city" value={orgCity} onChangeText={setOrgCity} />
          <PrimaryButton label="Save organization profile" loading={working} onPress={saveProfile} />
        </View>
      ) : null}
    </Screen>
  );
}

function Field({ label, ...props }: React.ComponentProps<typeof TextInput> & { label: string }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...props} placeholderTextColor="#7A8F9A" style={styles.input} /></View>;
}
function Choice({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.choice, active && styles.choiceActive]}><Text style={[styles.choiceText, active && styles.choiceTextActive]}>{label.replaceAll("_", " ")}</Text></Pressable>;
}
function Row({ label, value }: { label: string; value: string }) {
  return <View style={styles.row}><Text style={styles.rowLabel}>{label}</Text><Text style={styles.rowValue}>{value}</Text></View>;
}
function Stat({ label, value }: { label: string; value: string }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  eyebrow: { color: colors.accent, fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  title: { color: colors.text, fontSize: 27, fontWeight: "900" },
  body: { color: colors.textSecondary, lineHeight: 21 },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  error: { color: colors.danger, fontWeight: "800" },
  notice: { color: colors.positive, backgroundColor: colors.positiveSoft, padding: spacing.sm, borderRadius: radius.sm, fontWeight: "800" },
  pending: { backgroundColor: colors.warningSoft, borderWidth: 1, borderColor: colors.warning, borderRadius: radius.md, padding: spacing.lg, gap: 8 },
  pendingTitle: { color: colors.warning, fontSize: 18, fontWeight: "900" },
  invitation: { backgroundColor: colors.warningSoft, borderWidth: 1, borderColor: colors.warning, borderRadius: radius.md, padding: spacing.md, gap: 8 },
  invitationTitle: { color: colors.warning, fontWeight: "900" },
  token: { color: colors.text, backgroundColor: colors.surface, borderRadius: radius.sm, padding: spacing.sm, fontFamily: "monospace", fontSize: 12 },
  hide: { color: colors.help, fontWeight: "900" },
  nav: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  navChip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: colors.surface },
  navChipActive: { backgroundColor: colors.accentStrong, borderColor: colors.accentStrong },
  navText: { color: colors.textSecondary, textTransform: "capitalize", fontWeight: "800", fontSize: 12 },
  navTextActive: { color: "#FFF" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stat: { width: "48%", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, gap: 4 },
  statValue: { color: colors.accentStrong, fontWeight: "900", fontSize: 18 },
  statLabel: { color: colors.muted, fontSize: 11 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  sectionTitle: { color: colors.text, fontWeight: "900", fontSize: 18 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  cardTitle: { color: colors.text, fontWeight: "900", fontSize: 16 },
  goodBadge: { color: colors.positive, backgroundColor: colors.positiveSoft, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 4, fontSize: 10, fontWeight: "900" },
  warnBadge: { color: colors.warning, backgroundColor: colors.warningSoft, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 4, fontSize: 10, fontWeight: "900" },
  status: { color: colors.accent, textTransform: "capitalize", fontWeight: "900", fontSize: 11 },
  field: { gap: 6 },
  label: { color: colors.textSecondary, fontWeight: "800", fontSize: 13 },
  warnText: { color: colors.warning, backgroundColor: colors.warningSoft, borderRadius: radius.sm, padding: spacing.sm, fontSize: 12, lineHeight: 18, fontWeight: "700" },
  serviceEditor: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderMuted, paddingTop: spacing.sm, gap: spacing.sm },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, paddingHorizontal: 12, color: colors.text },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  choice: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: colors.surfaceAlt },
  choiceActive: { borderColor: colors.accent, backgroundColor: colors.accentLight },
  choiceText: { color: colors.textSecondary, fontWeight: "800", fontSize: 11, textTransform: "capitalize" },
  choiceTextActive: { color: colors.accentStrong },
  row: { gap: 2, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderMuted, paddingBottom: 6 },
  rowLabel: { color: colors.muted, fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  rowValue: { color: colors.text, fontWeight: "700" },
  retire: { color: colors.danger, fontWeight: "900" },
  empty: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.lg },
});
