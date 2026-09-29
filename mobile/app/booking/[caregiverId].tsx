import React, { useEffect, useMemo, useState } from "react";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Screen } from "@/components/Screen";
import { PrimaryButton } from "@/components/PrimaryButton";
import { createBooking, getCaregiver } from "@/api/sewak";
import { useAuth } from "@/auth/AuthProvider";
import { BookingDraft, Caregiver, Quote } from "@/types";
import { calculateQuote, formatNpr, validateBooking } from "@/domain/booking";
import { colors, radius, spacing } from "@/theme";

const WINDOWS = [
  ["morning", "Morning"],
  ["day", "Day"],
  ["evening", "Evening"],
  ["night", "Night"],
] as const;

export default function BookingScreen() {
  const { caregiverId } = useLocalSearchParams<{ caregiverId: string }>();
  const router = useRouter();
  const { user, role } = useAuth();
  const [caregiver, setCaregiver] = useState<Caregiver | null>(null);
  const [caregiverLoading, setCaregiverLoading] = useState(true);
  const [step, setStep] = useState(0);
  const [scheduleMode, setScheduleMode] = useState<"exact" | "window">("exact");
  const [draft, setDraft] = useState<BookingDraft>({
    serviceId: "",
    serviceLabel: "",
    careRecipient: "",
    date: "",
    time: "",
    requestedTimeWindows: [],
    durationHours: 4,
    recurrence: "one_time",
    userName: String(user?.profile?.name || user?.displayName || ""),
    userPhone: String(user?.profile?.phone || ""),
    address: String(user?.profile?.address || ""),
    city: String(user?.profile?.city || ""),
    careNeeds: "",
    notes: "",
  });
  const [confirmedQuote, setConfirmedQuote] = useState<Quote | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!caregiverId) return;
    setCaregiverLoading(true);
    setCaregiver(null);
    setError("");
    setDraft((current) => ({ ...current, serviceId: "", serviceLabel: "" }));
    getCaregiver(caregiverId)
      .then(setCaregiver)
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load caregiver."))
      .finally(() => setCaregiverLoading(false));
  }, [caregiverId]);

  const quote = useMemo(() => {
    if (!caregiver) return null;
    try { return calculateQuote(caregiver, draft.durationHours); } catch { return null; }
  }, [caregiver, draft.durationHours]);

  if (!user) return <Redirect href="/sign-in" />;
  if (role !== "user") return <Redirect href="/(tabs)/home" />;

  const partTime = ["parttime", "part_time"].includes(String(caregiver?.workType || ""));
  const serviceIds = caregiver?.servicesOffered || [];
  const serviceLabels = caregiver?.serviceLabels || [];
  const hasServices = serviceIds.length > 0;

  const patch = <K extends keyof BookingDraft>(key: K, value: BookingDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const chooseService = (id: string, index: number) => {
    patch("serviceId", id);
    patch("serviceLabel", serviceLabels[index] || id.replace(/_/g, " "));
  };

  const chooseMode = (mode: "exact" | "window") => {
    setScheduleMode(mode);
    if (mode === "exact") patch("requestedTimeWindows", []);
    else patch("time", "");
  };

  const toggleWindow = (window: string) => {
    const next = draft.requestedTimeWindows.includes(window)
      ? draft.requestedTimeWindows.filter((item) => item !== window)
      : [...draft.requestedTimeWindows, window];
    patch("requestedTimeWindows", next);
  };

  const stepValid = () => {
    if (step === 0) return Boolean(caregiver && draft.careRecipient.trim() && serviceIds.includes(draft.serviceId));
    if (step === 1) {
      return Boolean(
        draft.date &&
        draft.durationHours >= 1 &&
        draft.durationHours <= 24 &&
        (scheduleMode === "exact" ? draft.time : draft.requestedTimeWindows.length),
      );
    }
    if (step === 2) return Boolean(draft.userName.trim() && draft.userPhone.trim() && draft.address.trim() && draft.city.trim());
    return true;
  };

  const next = () => {
    setError("");
    if (!stepValid()) return setError("Complete the required fields before continuing.");
    if (step === 2 && caregiver) {
      const errors = validateBooking(draft, caregiver);
      if (errors.length) return setError(errors[0]);
      if (!quote) return setError("This caregiver's rate is not ready for booking.");
      setConfirmedQuote(quote);
    }
    setStep((current) => Math.min(3, current + 1));
  };

  const submit = async () => {
    if (!caregiver || !confirmedQuote) return;
    setBusy(true);
    setError("");
    try {
      const result = await createBooking({ user, caregiver, input: draft, confirmedQuote });
      if ("changedQuote" in result) {
        setConfirmedQuote(result.changedQuote);
        setError("The caregiver's rate changed. Review the updated total before confirming again.");
        return;
      }
      router.replace({ pathname: "/booking-detail/[id]", params: { id: result.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create booking.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Text style={styles.step}>STEP {step + 1} OF 4</Text>
      <Text style={styles.title}>{["Care details", "Schedule", "Contact & needs", "Review request"][step]}</Text>
      <Text style={styles.body}>Booking {caregiver?.name || "caregiver"}.</Text>

      <View style={styles.progress}>
        {[0,1,2,3].map((index) => <View key={index} style={[styles.progressBar, index <= step && styles.progressBarActive]} />)}
      </View>

      <View style={styles.card}>
        {step === 0 ? (
          <>
            <Field label="Who needs care? *" value={draft.careRecipient} onChangeText={(value) => patch("careRecipient", value)} placeholder="Example: My father" />
            <Text style={styles.label}>Care service *</Text>
            {caregiverLoading ? (
              <Text style={styles.serviceHint}>Loading available services…</Text>
            ) : hasServices ? (
              <View style={styles.chips}>
                {serviceIds.map((id, index) => (
                  <Choice key={id} label={serviceLabels[index] || id.replace(/_/g, " ")} active={draft.serviceId === id} onPress={() => chooseService(id, index)} />
                ))}
              </View>
            ) : caregiver ? (
              <View style={styles.serviceEmpty}>
                <Text style={styles.serviceEmptyTitle}>No booking service is assigned to this caregiver.</Text>
                <Text style={styles.serviceHint}>Please go back and choose another caregiver, or ask the caregiver's organization to assign an active service.</Text>
              </View>
            ) : (
              <Text style={styles.serviceHint}>Care services could not be loaded.</Text>
            )}
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Field label="Date (YYYY-MM-DD) *" value={draft.date} onChangeText={(value) => patch("date", value)} placeholder="2026-10-05" />
            {partTime ? (
              <>
                <Text style={styles.label}>How do you want to schedule?</Text>
                <View style={styles.chips}>
                  <Choice label="Exact time" active={scheduleMode === "exact"} onPress={() => chooseMode("exact")} />
                  <Choice label="Time window" active={scheduleMode === "window"} onPress={() => chooseMode("window")} />
                </View>
              </>
            ) : null}
            {scheduleMode === "exact" || !partTime ? (
              <Field label="Start time (24-hour HH:MM) *" value={draft.time} onChangeText={(value) => patch("time", value)} placeholder="10:00" />
            ) : (
              <>
                <Text style={styles.label}>Preferred time window(s) *</Text>
                <View style={styles.chips}>
                  {WINDOWS.map(([id, label]) => <Choice key={id} label={label} active={draft.requestedTimeWindows.includes(id)} onPress={() => toggleWindow(id)} />)}
                </View>
              </>
            )}
            <Field
              label="Duration in hours (1–24) *"
              value={String(draft.durationHours)}
              onChangeText={(value) => patch("durationHours", Number(value.replace(/\D/g, "")) || 0)}
              keyboardType="numeric"
            />
            <Text style={styles.label}>Frequency</Text>
            <View style={styles.chips}>
              <Choice label="One time" active={draft.recurrence === "one_time"} onPress={() => patch("recurrence", "one_time")} />
              <Choice label="Recurring" active={draft.recurrence === "recurring"} onPress={() => patch("recurrence", "recurring")} />
            </View>
            {draft.recurrence === "recurring" ? <Text style={styles.notice}>This marks the care request as recurring. The caregiver and family can confirm the ongoing schedule after acceptance.</Text> : null}
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Field label="Contact name *" value={draft.userName} onChangeText={(value) => patch("userName", value)} />
            <Field label="Phone *" value={draft.userPhone} onChangeText={(value) => patch("userPhone", value)} keyboardType="phone-pad" placeholder="98XXXXXXXX" />
            <Field label="Address *" value={draft.address} onChangeText={(value) => patch("address", value)} />
            <Field label="City *" value={draft.city} onChangeText={(value) => patch("city", value)} />
            <Field label="Care needs" value={draft.careNeeds} onChangeText={(value) => patch("careNeeds", value)} multiline />
            <Field label="Additional instructions" value={draft.notes} onChangeText={(value) => patch("notes", value)} multiline />
          </>
        ) : null}

        {step === 3 ? (
          <>
            <ReviewRow label="Caregiver" value={caregiver?.name || ""} />
            <ReviewRow label="Service" value={draft.serviceLabel} />
            <ReviewRow label="Care for" value={draft.careRecipient} />
            <ReviewRow label="Schedule" value={draft.time ? `${draft.date} at ${draft.time}` : `${draft.date} · ${draft.requestedTimeWindows.join(", ")}`} />
            <ReviewRow label="Duration" value={`${draft.durationHours} hour${draft.durationHours === 1 ? "" : "s"} · ${draft.recurrence === "recurring" ? "Recurring" : "One time"}`} />
            <ReviewRow label="Address" value={`${draft.address}, ${draft.city}`} />
            {confirmedQuote ? (
              <View style={styles.quote}>
                <Text style={styles.quoteLabel}>Estimated cash total</Text>
                <Text style={styles.quoteTotal}>{formatNpr(confirmedQuote.amountDue)}</Text>
                <Text style={styles.muted}>{formatNpr(confirmedQuote.hourlyRate)}/hr × {draft.durationHours} hours</Text>
              </View>
            ) : null}
            <Text style={styles.notice}>The Worker rechecks caregiver availability, service eligibility, pricing, organization status and authorization when you submit. Payment is cash/pending until recorded.</Text>
          </>
        ) : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        {step > 0 ? <PrimaryButton label="Back" variant="secondary" onPress={() => setStep((current) => Math.max(0, current - 1))} /> : null}
        <PrimaryButton
          label={step === 0 && !caregiverLoading && caregiver && !hasServices ? "No service available" : step === 3 ? "Send care request" : "Continue"}
          onPress={step === 3 ? submit : next}
          loading={busy || (step === 0 && caregiverLoading)}
          disabled={!stepValid() || (step === 3 && !confirmedQuote)}
        />
      </View>
    </Screen>
  );
}

function Field({ label, multiline, ...props }: React.ComponentProps<typeof TextInput> & { label: string }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...props} multiline={multiline} textAlignVertical={multiline ? "top" : "center"} placeholderTextColor="#7A8F9A" style={[styles.input, multiline && styles.multiline]} /></View>;
}
function Choice({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.choice, active && styles.choiceActive]}><Text style={[styles.choiceText, active && styles.choiceTextActive]}>{label}</Text></Pressable>;
}
function ReviewRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.reviewRow}><Text style={styles.muted}>{label}</Text><Text style={styles.reviewValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  step: { color: colors.accent, fontSize: 12, fontWeight: "900", letterSpacing: 1 },
  title: { color: colors.text, fontSize: 28, fontWeight: "900" },
  body: { color: colors.muted, lineHeight: 21 },
  progress: { flexDirection: "row", gap: 6 },
  progressBar: { flex: 1, height: 5, backgroundColor: colors.borderMuted, borderRadius: radius.pill },
  progressBarActive: { backgroundColor: colors.accent },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: spacing.md },
  field: { gap: 7 },
  label: { color: colors.textSecondary, fontSize: 13, fontWeight: "800" },
  input: { minHeight: 50, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, paddingHorizontal: 14, color: colors.text, fontSize: 16 },
  multiline: { minHeight: 100, paddingTop: 12 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  serviceEmpty: { backgroundColor: colors.warningSoft, borderRadius: radius.sm, padding: spacing.sm, gap: 5 },
  serviceEmptyTitle: { color: colors.warning, fontWeight: "900", lineHeight: 19 },
  serviceHint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  choice: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: colors.surfaceAlt },
  choiceActive: { backgroundColor: colors.accentLight, borderColor: colors.accent },
  choiceText: { color: colors.textSecondary, fontWeight: "800", fontSize: 13 },
  choiceTextActive: { color: colors.accentStrong },
  actions: { gap: 10 },
  error: { color: colors.danger, fontWeight: "800" },
  notice: { backgroundColor: colors.warningSoft, color: colors.warning, borderRadius: radius.sm, padding: spacing.sm, lineHeight: 19, fontSize: 12, fontWeight: "700" },
  reviewRow: { gap: 3, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderMuted, paddingBottom: 8 },
  reviewValue: { color: colors.text, fontWeight: "800", lineHeight: 20 },
  muted: { color: colors.muted, fontSize: 12 },
  quote: { backgroundColor: colors.accentLight, padding: spacing.md, borderRadius: radius.md, gap: 4 },
  quoteLabel: { color: colors.accentStrong, fontWeight: "800" },
  quoteTotal: { color: colors.accentStrong, fontSize: 26, fontWeight: "900" },
});
