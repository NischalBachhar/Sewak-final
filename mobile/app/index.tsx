import React from "react";
import { Redirect, useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useAuth } from "@/auth/AuthProvider";
import { colors, radius, spacing } from "@/theme";

export default function LandingScreen() {
  const router = useRouter();
  const { user, loading } = useAuth();

  if (!loading && user) return <Redirect href="/(tabs)/home" />;

  return (
    <Screen safeTop safeBottom contentStyle={styles.content}>
      <View style={styles.brandRow}>
        <View style={styles.mark}><Text style={styles.markText}>S</Text></View>
        <Text style={styles.brand}>Sewak</Text>
      </View>

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>CARE, CLOSE TO HOME</Text>
        <Text style={styles.title}>Trusted care for every stage of family life.</Text>
        <Text style={styles.body}>
          Find caregivers for elderly care, child care, patient support and everyday home care across Nepal.
        </Text>
      </View>

      <View style={styles.categoryRow}>
        {["Elderly care", "Child care", "Patient care", "Home support"].map((item) => (
          <View key={item} style={styles.chip}><Text style={styles.chipText}>{item}</Text></View>
        ))}
      </View>

      <View style={styles.actions}>
        <PrimaryButton label="Browse caregivers" onPress={() => router.push("/browse")} />
        <PrimaryButton label="Sign in" variant="secondary" onPress={() => router.push("/sign-in")} />
        <Text style={styles.register}>
          New to Sewak?{" "}
          <Text style={styles.link} onPress={() => router.push("/register")}>Create an account</Text>
        </Text>
      </View>

      <View style={styles.trust}>
        <Text style={styles.trustTitle}>Built for safer care</Text>
        <Text style={styles.trustText}>Verified profiles · Clear rates · Booking history · Care-session updates</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { justifyContent: "center", paddingTop: spacing.lg, paddingBottom: spacing.xl },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  mark: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.accentStrong, alignItems: "center", justifyContent: "center" },
  markText: { color: "#FFF", fontSize: 22, fontWeight: "900" },
  brand: { color: colors.text, fontSize: 21, fontWeight: "900" },
  hero: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 22, gap: spacing.sm },
  eyebrow: { color: colors.accent, fontSize: 11, fontWeight: "900", letterSpacing: 1.1 },
  title: { color: colors.text, fontSize: 29, lineHeight: 35, fontWeight: "900", letterSpacing: -0.4 },
  body: { color: colors.textSecondary, fontSize: 15, lineHeight: 22 },
  categoryRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { backgroundColor: colors.accentLight, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill },
  chipText: { color: colors.accentStrong, fontSize: 12, fontWeight: "800" },
  actions: { gap: 10 },
  register: { textAlign: "center", color: colors.muted, marginTop: 4, fontSize: 14 },
  link: { color: colors.help, fontWeight: "900" },
  trust: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, alignItems: "center", gap: 4 },
  trustTitle: { color: colors.textSecondary, fontWeight: "900", fontSize: 14 },
  trustText: { color: colors.muted, textAlign: "center", fontSize: 11, lineHeight: 17 },
});
