import React from "react";
import { Redirect, useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useAuth } from "@/auth/AuthProvider";
import { colors, radius, spacing } from "@/theme";
import { usingMockData } from "@/api/client";

export default function LandingScreen() {
  const router = useRouter();
  const { user, loading } = useAuth();

  if (!loading && user) return <Redirect href="/(tabs)/home" />;

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.brandRow}>
        <View style={styles.mark}><Text style={styles.markText}>S</Text></View>
        <Text style={styles.brand}>Sewak</Text>
      </View>

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>CARE, CLOSE TO HOME</Text>
        <Text style={styles.title}>Trusted care for every stage of family life.</Text>
        <Text style={styles.body}>
          Find caregivers for elderly care, child care, patient support and everyday home care.
        </Text>
      </View>

      <View style={styles.categoryRow}>
        {["Elderly care", "Child care", "Patient care", "Home support"].map((item) => (
          <View key={item} style={styles.chip}><Text style={styles.chipText}>{item}</Text></View>
        ))}
      </View>

      {usingMockData ? (
        <View style={styles.devNotice}>
          <Text style={styles.devTitle}>Mobile development mode</Text>
          <Text style={styles.devText}>
            Caregiver listings are sample data until the Cloudflare Worker API is connected.
          </Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <PrimaryButton label="Browse caregivers" onPress={() => router.push("/browse")} />
        <PrimaryButton
          label="Sign in to Sewak"
          variant="secondary"
          onPress={() => router.push("/sign-in")}
        />
      </View>

      <Text style={styles.footer}>
        Clear profiles · Safer booking flow · Care updates in one place
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { justifyContent: "center", paddingVertical: 28 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  mark: {
    width: 42, height: 42, borderRadius: 14, backgroundColor: colors.accentStrong,
    alignItems: "center", justifyContent: "center",
  },
  markText: { color: "#FFF", fontSize: 22, fontWeight: "900" },
  brand: { color: colors.text, fontSize: 22, fontWeight: "900" },
  hero: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  eyebrow: { color: colors.accent, fontSize: 12, fontWeight: "900", letterSpacing: 1.2 },
  title: { color: colors.text, fontSize: 34, lineHeight: 40, fontWeight: "900" },
  body: { color: colors.textSecondary, fontSize: 16, lineHeight: 24 },
  categoryRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    backgroundColor: colors.accentLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  chipText: { color: colors.accentStrong, fontSize: 13, fontWeight: "800" },
  devNotice: {
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 4,
  },
  devTitle: { color: colors.warning, fontWeight: "900" },
  devText: { color: colors.textSecondary, lineHeight: 20 },
  actions: { gap: 10 },
  footer: { textAlign: "center", color: colors.muted, fontSize: 12, lineHeight: 18 },
});
