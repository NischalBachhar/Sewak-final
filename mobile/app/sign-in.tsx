import React, { useState } from "react";
import { Redirect, useRouter } from "expo-router";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Screen } from "@/components/Screen";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useAuth } from "@/auth/AuthProvider";
import { ApiError } from "@/api/client";
import { colors, radius, spacing } from "@/theme";

const messageFor = (error: unknown) => {
  if (error instanceof ApiError) {
    if (["invalid-credentials", "unauthenticated"].includes(error.code)) {
      return "The email or password is incorrect. Please try again.";
    }
    if (error.status === 429) return "Too many attempts. Please wait before trying again.";
    if (error.status === 503) return "Sewak is temporarily unavailable. Please try again shortly.";
    return error.message;
  }
  return error instanceof Error ? error.message : "We couldn't sign you in.";
};

export default function SignInScreen() {
  const router = useRouter();
  const { user, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (user) return <Redirect href="/(tabs)/home" />;

  const submit = async () => {
    setError("");
    if (!email.trim() || !password) return setError("Enter your email and password.");
    setBusy(true);
    try {
      await signIn(email, password);
      router.replace("/(tabs)/home");
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>WELCOME BACK</Text>
        <Text style={styles.title}>Sign in to Sewak</Text>
        <Text style={styles.subtitle}>Use your Cloudflare Sewak account.</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor="#7A8F9A"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#7A8F9A"
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton label="Sign in" loading={busy} onPress={submit} />

        <Text style={styles.helper}>
          New here? <Text style={styles.link} onPress={() => router.push("/register")}>Create an account</Text>
        </Text>
        <Text style={styles.helper}>
          Have an invitation? <Text style={styles.link} onPress={() => router.push("/activate")}>Activate account</Text>
        </Text>
        <Text style={styles.recovery}>
          Forgot your password? Sewak currently uses administrator-issued recovery invitations rather than reset email.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { justifyContent: "center" },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  eyebrow: { color: colors.accent, fontWeight: "900", letterSpacing: 1, fontSize: 12 },
  title: { color: colors.text, fontSize: 28, fontWeight: "900" },
  subtitle: { color: colors.muted, lineHeight: 20 },
  field: { gap: 7 },
  label: { color: colors.textSecondary, fontWeight: "800", fontSize: 13 },
  input: { minHeight: 50, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, backgroundColor: colors.surfaceAlt, color: colors.text, fontSize: 16 },
  error: { color: colors.danger, fontWeight: "700" },
  helper: { textAlign: "center", color: colors.muted },
  link: { color: colors.help, fontWeight: "900" },
  recovery: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: "center" },
});
