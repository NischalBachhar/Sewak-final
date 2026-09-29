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
    if (["invalid-credentials", "unauthenticated"].includes(error.code)) return "The email or password is incorrect. Please try again.";
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
      <View style={styles.intro}>
        <Text style={styles.eyebrow}>WELCOME BACK</Text>
        <Text style={styles.title}>Continue to Sewak</Text>
        <Text style={styles.subtitle}>Use the same Cloudflare account as the Sewak web application.</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            keyboardType="email-address"
            returnKeyType="next"
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
            textContentType="password"
            secureTextEntry
            returnKeyType="go"
            onSubmitEditing={submit}
            value={password}
            onChangeText={setPassword}
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#7A8F9A"
          />
        </View>

        {error ? <View style={styles.errorBox}><Text style={styles.error}>{error}</Text></View> : null}
        <PrimaryButton label="Sign in" loading={busy} onPress={submit} />

        <Text style={styles.helper}>New here? <Text style={styles.link} onPress={() => router.push("/register")}>Create an account</Text></Text>
        <Text style={styles.helper}>Have an invitation? <Text style={styles.link} onPress={() => router.push("/activate")}>Activate account</Text></Text>
        <Text style={styles.recovery}>Forgot your password? Sewak currently uses administrator-issued recovery invitations.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { justifyContent: "center" },
  intro: { gap: 5 },
  eyebrow: { color: colors.accent, fontWeight: "900", letterSpacing: 1, fontSize: 11 },
  title: { color: colors.text, fontSize: 23, lineHeight: 29, fontWeight: "900" },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: 14 },
  field: { gap: 6 },
  label: { color: colors.textSecondary, fontWeight: "800", fontSize: 13 },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 13, backgroundColor: colors.surfaceAlt, color: colors.text, fontSize: 15 },
  errorBox: { backgroundColor: colors.dangerSoft, borderRadius: radius.sm, padding: spacing.sm },
  error: { color: colors.danger, fontWeight: "700", fontSize: 13, lineHeight: 19 },
  helper: { textAlign: "center", color: colors.muted, fontSize: 13 },
  link: { color: colors.help, fontWeight: "900" },
  recovery: { color: colors.muted, fontSize: 11, lineHeight: 17, textAlign: "center" },
});
