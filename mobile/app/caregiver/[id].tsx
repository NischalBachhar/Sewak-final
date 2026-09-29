import React, { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { PrimaryButton } from "@/components/PrimaryButton";
import { getCaregiver, listPublicReviews } from "@/api/sewak";
import { useAuth } from "@/auth/AuthProvider";
import { Caregiver, PublicReview } from "@/types";
import { formatNpr } from "@/domain/booking";
import { colors, radius, spacing } from "@/theme";

const verificationRows = (caregiver: Caregiver) => [
  ["Identity", caregiver.identityVerificationStatus || (caregiver.verified ? "verified" : "not verified")],
  ["Phone", caregiver.phoneVerificationStatus || "not verified"],
  ["Training", caregiver.trainingVerificationStatus || (caregiver.isCertified ? "verified" : "not verified")],
  ["Background", caregiver.backgroundVerificationStatus || (caregiver.backgroundChecked ? "verified" : "not verified")],
  ["References", caregiver.referencesVerificationStatus || "not verified"],
];

export default function CaregiverProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, role } = useAuth();
  const [caregiver, setCaregiver] = useState<Caregiver | null>(null);
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!id) return;
    Promise.allSettled([getCaregiver(id), listPublicReviews(id)])
      .then(([caregiverResult, reviewResult]) => {
        if (!active) return;
        if (caregiverResult.status === "rejected") throw caregiverResult.reason;
        setCaregiver(caregiverResult.value);
        if (reviewResult.status === "fulfilled") setReviews(reviewResult.value);
      })
      .catch((err) => active && setError(err instanceof Error ? err.message : "Unable to load caregiver."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [id]);

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>;
  if (error || !caregiver) return <Screen><Text style={styles.error}>{error || "Caregiver not found."}</Text></Screen>;

  const services = caregiver.serviceLabels || caregiver.servicesOffered || [];
  const hasBookableServices = services.length > 0;
  const verifiedReviews = reviews.filter((review) => review.isVerifiedReview !== false && Number(review.rating) >= 1);
  const rating = verifiedReviews.length
    ? verifiedReviews.reduce((sum, review) => sum + Number(review.rating), 0) / verifiedReviews.length
    : Number(caregiver.rating || 0);

  return (
    <Screen>
      <View style={styles.hero}>
        {caregiver.profileImage ? (
          <Image source={{ uri: caregiver.profileImage }} style={styles.photo} />
        ) : (
          <View style={styles.avatar}><Text style={styles.avatarText}>{caregiver.name.slice(0, 1).toUpperCase()}</Text></View>
        )}
        <Text style={styles.name}>{caregiver.name}</Text>
        <Text style={styles.meta}>
          {[caregiver.location, caregiver.experience != null ? `${caregiver.experience} years experience` : ""].filter(Boolean).join(" · ")}
        </Text>
        <Text style={caregiver.isAvailable === false ? styles.unavailable : styles.available}>
          {caregiver.isAvailable === false ? "Currently unavailable" : "Available to discuss care"}
        </Text>
        {rating > 0 ? <Text style={styles.rating}>★ {rating.toFixed(1)} · {caregiver.reviewCount || verifiedReviews.length} verified reviews</Text> : <Text style={styles.muted}>No verified reviews yet</Text>}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>About</Text>
        <Text style={styles.body}>{caregiver.bio || "This caregiver has not added an introduction yet."}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Care & support offered</Text>
        {hasBookableServices ? (
          <View style={styles.chips}>
            {services.map((service) => (
              <View key={service} style={styles.chip}><Text style={styles.chipText}>{service}</Text></View>
            ))}
          </View>
        ) : (
          <View style={styles.serviceEmpty}>
            <Text style={styles.serviceEmptyTitle}>No active booking service is assigned yet.</Text>
            <Text style={styles.muted}>This caregiver cannot receive new care requests until an approved service is assigned.</Text>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Verification</Text>
        {verificationRows(caregiver).map(([label, state]) => {
          const verified = String(state).toLowerCase() === "verified";
          return (
            <View key={label} style={styles.verifyRow}>
              <Text style={styles.body}>{label}</Text>
              <Text style={verified ? styles.verified : styles.notVerified}>{verified ? "✓ Verified" : "Not verified"}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Rate</Text>
        <Text style={styles.rate}>{formatNpr(caregiver.hourlyRate)} / hour</Text>
        {caregiver.organizationName ? <Text style={styles.muted}>Managed by {caregiver.organizationName}</Text> : null}
      </View>

      {verifiedReviews.length ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Verified reviews</Text>
          {verifiedReviews.slice(0, 6).map((review) => (
            <View key={review.id} style={styles.review}>
              <Text style={styles.rating}>{"★".repeat(Math.max(1, Math.min(5, Number(review.rating))))}</Text>
              {review.comment ? <Text style={styles.body}>{review.comment}</Text> : null}
              <Text style={styles.muted}>{review.reviewerName || "Verified customer"}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {role === "user" ? (
        <PrimaryButton
          label={!hasBookableServices ? "No service available" : caregiver.isAvailable === false ? "Currently unavailable" : "Book caregiver"}
          disabled={!hasBookableServices || caregiver.isAvailable === false}
          onPress={() => router.push({ pathname: "/booking/[caregiverId]", params: { caregiverId: caregiver.id } })}
        />
      ) : !user ? (
        <PrimaryButton label="Sign in to book" disabled={!hasBookableServices} onPress={() => router.push("/sign-in")} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  hero: { alignItems: "center", gap: 8, paddingVertical: spacing.md },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.accentLight, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.accentStrong, fontSize: 34, fontWeight: "900" },
  photo: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.accentLight },
  name: { color: colors.text, fontSize: 26, fontWeight: "900", textAlign: "center" },
  meta: { color: colors.muted, textAlign: "center" },
  available: { color: colors.positive, backgroundColor: colors.positiveSoft, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, fontWeight: "800", fontSize: 12 },
  unavailable: { color: colors.danger, backgroundColor: colors.dangerSoft, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, fontWeight: "800", fontSize: 12 },
  rating: { color: colors.warning, fontWeight: "900" },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: "900" },
  body: { color: colors.textSecondary, lineHeight: 21 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  serviceEmpty: { backgroundColor: colors.warningSoft, borderRadius: radius.sm, padding: spacing.sm, gap: 4 },
  serviceEmptyTitle: { color: colors.warning, fontWeight: "900", lineHeight: 19 },
  chip: { backgroundColor: colors.accentLight, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  chipText: { color: colors.accentStrong, fontSize: 12, fontWeight: "800" },
  verifyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderMuted, paddingVertical: 6 },
  verified: { color: colors.positive, fontWeight: "900", fontSize: 12 },
  notVerified: { color: colors.muted, fontWeight: "700", fontSize: 12 },
  rate: { color: colors.accent, fontSize: 20, fontWeight: "900" },
  review: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderMuted, paddingTop: spacing.sm, gap: 5 },
  error: { color: colors.danger, fontWeight: "800" },
});
