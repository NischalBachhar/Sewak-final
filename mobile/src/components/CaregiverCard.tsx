import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Caregiver } from "@/types";
import { colors, radius, spacing } from "@/theme";

const formatRate = (amount?: number | null) =>
  Number.isFinite(amount) ? `NPR ${Number(amount).toLocaleString("en-NP")}/hr` : "Rate on request";

export function CaregiverCard({
  caregiver,
  onPress,
}: {
  caregiver: Caregiver;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${caregiver.name}'s profile`}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{caregiver.name.slice(0, 1).toUpperCase()}</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.row}>
          <Text style={styles.name}>{caregiver.name}</Text>
          {caregiver.isAvailable !== false ? (
            <Text style={styles.available}>Available</Text>
          ) : null}
        </View>
        <Text style={styles.meta}>
          {caregiver.location || "Location not listed"}
          {caregiver.experience != null ? ` · ${caregiver.experience} yrs exp.` : ""}
        </Text>
        <Text style={styles.services} numberOfLines={2}>
          {(caregiver.serviceLabels || caregiver.servicesOffered || []).join(" · ") ||
            "Care support"}
        </Text>
        <View style={styles.row}>
          <Text style={styles.rate}>{formatRate(caregiver.hourlyRate)}</Text>
          {caregiver.rating ? (
            <Text style={styles.rating}>
              ★ {caregiver.rating.toFixed(1)}
              {caregiver.reviewCount ? ` (${caregiver.reviewCount})` : ""}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.accentStrong, fontSize: 22, fontWeight: "900" },
  body: { flex: 1, gap: 6 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  name: { flex: 1, color: colors.text, fontSize: 17, fontWeight: "900" },
  available: {
    color: colors.positive,
    backgroundColor: colors.positiveSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    fontSize: 11,
    fontWeight: "800",
  },
  meta: { color: colors.muted, fontSize: 13 },
  services: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
  rate: { color: colors.accent, fontWeight: "900" },
  rating: { color: colors.warning, fontWeight: "800" },
});
