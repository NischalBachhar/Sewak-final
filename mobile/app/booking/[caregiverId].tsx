import React, { useEffect, useMemo, useState } from "react";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Screen } from "@/components/Screen";
import { PrimaryButton } from "@/components/PrimaryButton";
import { createBooking, getCaregiver } from "@/api/sewak";
import { usingMockData } from "@/api/client";
import { useAuth } from "@/auth/AuthProvider";
import { Caregiver } from "@/types";
import { colors, radius, spacing } from "@/theme";

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "phone-pad" | "numeric";
  multiline?: boolean;
};

function Field({ label, multiline, ...props }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        multiline={multiline}
        style={[styles.input, multiline && styles.multiline]}
        placeholderTextColor="#7A8F9A"
        textAlignVertical={multiline ? "top" : "center"}
      />
    </View>
  );
}

export default function BookingScreen() {
  const { caregiverId } = useLocalSearchParams<{ caregiverId: string }>();
  const router = useRouter();
  const { user, role, profile } = useAuth();
  const [caregiver, setCaregiver] = useState<Caregiver | null>(null);
  const [step, setStep] = useState(0);
  const [careRecipient, setCareRecipient] = useState("");
  const [careNeeds, setCareNeeds] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("4");
  const [fullName, setFullName] = useState(profile?.name || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [successId, setSuccessId] = useState("");

  useEffect(() => {
    if (!caregiverId) return;
    getCaregiver(caregiverId)
      .then(setCaregiver)
      .catch(() => setError("Unable to load caregiver."));
  }, [caregiverId]);

  useEffect(() => {
    if (!fullName && profile?.name) setFullName(profile.name);
    if (!phone && profile?.phone) setPhone(profile.phone);
  }, [profile?.name, profile?.phone, fullName, phone]);

  const titles = ["Care details", "Schedule", "Your details", "Review"];

  const canContinue = useMemo(() => {
    if (step === 0) return Boolean(careRecipient.trim() && careNeeds.trim());
    if (step === 1) {
      const hours = Number(duration);
      return Boolean(date && time && Number.isFinite(hours) && hours >= 1 && hours <= 24);
    }
    if (step === 2) return Boolean(fullName.trim() && phone.trim() && address.trim() && city.trim());
    return true;
  }, [step, careRecipient, careNeeds, date, time, duration, fullName, phone, address, city]);

  if (!user) return <Redirect href="/sign-in" />;
  if (role !== "user") return <Redirect href="/(tabs)/home" />;

  const next = () => {
    setError("");
    if (!canContinue) {
      setError("Complete the required fields before continuing.");
      return;
    }
    setStep((current) => Math.min(3, current + 1));
  };

  const submit = async () => {
    if (!caregiverId) return;
    setBusy(true);
    setError("");
    try {
      const result = await createBooking({
        caregiverId,
        careRecipient: careRecipient.trim(),
        careNeeds: careNeeds.trim(),
        date,
        time,
        durationHours: Number(duration),
        recurrence: "one_time",
        fullName: fullName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        city: city.trim(),
        notes: notes.trim(),
      });
      setSuccessId(result.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create booking.");
    } finally {
      setBusy(false);
    }
  };

  if (successId) {
    return (
      <Screen contentStyle={styles.successWrap}>
        <View style={styles.successCard}>
          <Text style={styles.successMark}>✓</Text>
          <Text style={styles.title}>Care request sent</Text>
          <Text style={styles.body}>
            {usingMockData
              ? "This was created in mobile development mode and was not written to production."
              : "Your caregiver can now review the request. You can follow its status in My bookings."}
          </Text>
          <Text style={styles.reference}>Reference: {successId}</Text>
          <PrimaryButton
            label="Go to My bookings"
            onPress={() => router.replace("/(tabs)/bookings")}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={styles.step}>STEP {step + 1} OF 4</Text>
      <Text style={styles.title}>{titles[step]}</Text>
      <Text style={styles.body}>
        Requesting care from {caregiver?.name || "this caregiver"}.
      </Text>

      <View style={styles.progress}>
        {[0, 1, 2, 3].map((index) => (
          <View
            key={index}
            style={[styles.progressBar, index <= step && styles.progressBarActive]}
          />
        ))}
      </View>

      <View style={styles.card}>
        {step === 0 ? (
          <>
            <Field
              label="Who needs care? *"
              value={careRecipient}
              onChangeText={setCareRecipient}
              placeholder="Example: My father"
            />
            <Field
              label="What support is needed? *"
              value={careNeeds}
              onChangeText={setCareNeeds}
              placeholder="Describe the care needs"
              multiline
            />
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Field
              label="Date (YYYY-MM-DD) *"
              value={date}
              onChangeText={setDate}
              placeholder="2026-10-01"
            />
            <Field
              label="Start time (HH:MM) *"
              value={time}
              onChangeText={setTime}
              placeholder="10:00"
            />
            <Field
              label="Duration in hours (1–24) *"
              value={duration}
              onChangeText={setDuration}
              keyboardType="numeric"
            />
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Field label="Contact name *" value={fullName} onChangeText={setFullName} />
            <Field
              label="Phone *"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
            <Field label="Address *" value={address} onChangeText={setAddress} />
            <Field label="City *" value={city} onChangeText={setCity} />
            <Field
              label="Additional instructions"
              value={notes}
              onChangeText={setNotes}
              multiline
            />
          </>
        ) : null}

        {step === 3 ? (
          <View style={styles.review}>
            <Text style={styles.reviewTitle}>{caregiver?.name || "Caregiver"}</Text>
            <Text style={styles.reviewText}>Care for: {careRecipient}</Text>
            <Text style={styles.reviewText}>Needs: {careNeeds}</Text>
            <Text style={styles.reviewText}>
              Schedule: {date} at {time} · {duration} hours
            </Text>
            <Text style={styles.reviewText}>Contact: {fullName} · {phone}</Text>
            <Text style={styles.reviewText}>Address: {address}, {city}</Text>
            {notes ? <Text style={styles.reviewText}>Notes: {notes}</Text> : null}
            <Text style={styles.notice}>
              Final pricing and booking validation come from Sewak's backend. The mobile app never calculates authoritative charges or commission.
            </Text>
          </View>
        ) : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        {step > 0 ? (
          <PrimaryButton
            label="Back"
            variant="secondary"
            onPress={() => setStep((current) => Math.max(0, current - 1))}
          />
        ) : null}
        <PrimaryButton
          label={step === 3 ? "Send care request" : "Continue"}
          onPress={step === 3 ? submit : next}
          loading={busy}
          disabled={!canContinue}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  step: { color: colors.accent, fontSize: 12, fontWeight: "900", letterSpacing: 1 },
  title: { color: colors.text, fontSize: 28, fontWeight: "900" },
  body: { color: colors.muted, lineHeight: 21 },
  progress: { flexDirection: "row", gap: 6 },
  progressBar: {
    flex: 1,
    height: 5,
    backgroundColor: colors.borderMuted,
    borderRadius: radius.pill,
  },
  progressBarActive: { backgroundColor: colors.accent },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  field: { gap: 7 },
  label: { color: colors.textSecondary, fontSize: 13, fontWeight: "800" },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 14,
    color: colors.text,
    fontSize: 16,
  },
  multiline: { minHeight: 110, paddingTop: 12 },
  actions: { gap: 10 },
  error: { color: colors.danger, fontWeight: "800" },
  review: { gap: 10 },
  reviewTitle: { color: colors.text, fontSize: 19, fontWeight: "900" },
  reviewText: { color: colors.textSecondary, lineHeight: 20 },
  notice: {
    marginTop: 6,
    backgroundColor: colors.warningSoft,
    color: colors.warning,
    borderRadius: radius.sm,
    padding: spacing.sm,
    lineHeight: 19,
    fontSize: 12,
    fontWeight: "700",
  },
  successWrap: { justifyContent: "center" },
  successCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  successMark: { color: colors.positive, fontSize: 42, fontWeight: "900" },
  reference: { color: colors.muted, fontSize: 12 },
});
