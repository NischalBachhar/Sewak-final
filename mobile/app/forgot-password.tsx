import React from "react";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { PrimaryButton } from "@/components/PrimaryButton";
import { colors, radius, spacing } from "@/theme";

export default function ForgotPasswordScreen() {
  const router = useRouter();

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>ACCOUNT RECOVERY</Text>
        <Text style={styles.title}>Forgot your password?</Text>
        <Text style={styles.body}>
          For your security, Sewak uses a one-time recovery token after account ownership is verified.
        </Text>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>How recovery works</Text>
          <Text style={styles.step}>1. Ask a verified Sewak administrator for an account recovery token.</Text>
          <Text style={styles.step}>2. Open the recovery form and enter the token.</Text>
          <Text style={styles.step}>3. Choose a new password. Your previous sessions will be signed out automatically.</Text>
        </View>

        <Text style={styles.caption}>
          Recovery tokens expire after 24 hours and can only be used once.
        </Text>

        <PrimaryButton label="I have a recovery token" onPress={() => router.push("/activate")} />
        <Text style={styles.back} onPress={() => router.replace("/sign-in")}>Back to sign in</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { justifyContent: "center" },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  eyebrow: { color: colors.accent, fontWeight: "900", letterSpacing: 1, fontSize: 11 },
  title: { color: colors.text, fontSize: 25, lineHeight: 31, fontWeight: "900" },
  body: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  notice: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 9,
  },
  noticeTitle: { color: colors.textSecondary, fontSize: 14, fontWeight: "900" },
  step: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  caption: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  back: { textAlign: "center", color: colors.help, fontWeight: "900", fontSize: 13 },
});
