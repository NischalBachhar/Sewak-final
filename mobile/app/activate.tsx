import React, { useState } from "react";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Screen } from "@/components/Screen";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useAuth } from "@/auth/AuthProvider";
import { colors, radius, spacing } from "@/theme";

export default function ActivateScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const router = useRouter();
  const { user, activate } = useAuth();
  const [token, setToken] = useState(String(params.token || ""));
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Redirect href="/(tabs)/home" />;

  const submit = async () => {
    setError("");
    if (!token.trim()) return setError("Enter the one-time activation token.");
    if (password.length < 12) return setError("Password must be at least 12 characters.");
    if (password !== confirm) return setError("Passwords do not match.");
    setBusy(true);
    try {
      await activate(token, password);
      router.replace("/(tabs)/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "This invitation could not be activated.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>INVITED ACCOUNT</Text>
        <Text style={styles.title}>Activate Sewak</Text>
        <Text style={styles.body}>Use the one-time invitation or recovery token provided by a verified Sewak administrator.</Text>
        <Field label="Activation token" value={token} onChangeText={setToken} autoCapitalize="none" />
        <Field label="New password" value={password} onChangeText={setPassword} secureTextEntry />
        <Field label="Confirm password" value={confirm} onChangeText={setConfirm} secureTextEntry />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton label="Activate account" loading={busy} onPress={submit} />
      </View>
    </Screen>
  );
}

function Field({ label, ...props }: React.ComponentProps<typeof TextInput> & { label: string }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...props} style={styles.input} placeholderTextColor="#7A8F9A" /></View>;
}
const styles = StyleSheet.create({
  content: { justifyContent: "center" },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  eyebrow: { color: colors.accent, fontWeight: "900", letterSpacing: 1, fontSize: 12 },
  title: { color: colors.text, fontSize: 28, fontWeight: "900" },
  body: { color: colors.muted, lineHeight: 20 },
  field: { gap: 7 },
  label: { color: colors.textSecondary, fontWeight: "800", fontSize: 13 },
  input: { minHeight: 50, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, backgroundColor: colors.surfaceAlt, color: colors.text },
  error: { color: colors.danger, fontWeight: "700" },
});
