import React, { useState } from "react";
import { Redirect, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Screen } from "@/components/Screen";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useAuth } from "@/auth/AuthProvider";
import { ApiError } from "@/api/client";
import { colors, radius, spacing } from "@/theme";

export default function RegisterScreen() {
  const router = useRouter();
  const { user, register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState<"user" | "orgadmin">("user");
  const [organizationName, setOrganizationName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (user) return <Redirect href="/(tabs)/home" />;

  const submit = async () => {
    setError("");
    if (name.trim().length < 2) return setError("Enter your full name.");
    if (!email.trim()) return setError("Enter your email.");
    if (password.length < 12) return setError("Password must be at least 12 characters.");
    if (selectedRole === "orgadmin" && organizationName.trim().length < 2) return setError("Enter your organization name.");
    setBusy(true);
    try {
      await register({ name, email, password, selectedRole, organizationName });
      router.replace("/(tabs)/home");
    } catch (err) {
      if (err instanceof ApiError && err.code === "account-exists") setError("This email is already registered. Please sign in.");
      else if (err instanceof ApiError && err.status === 429) setError("Too many registrations from this network. Please try again later.");
      else setError(err instanceof Error ? err.message : "We couldn't create your account.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={styles.intro}>
        <Text style={styles.eyebrow}>JOIN SEWAK</Text>
        <Text style={styles.introTitle}>Care starts with a trusted account.</Text>
        <Text style={styles.subtitle}>Customers can start immediately. Organization applications require Sewak approval.</Text>
      </View>

      <View style={styles.card}>
        <Field label="Full name" value={name} onChangeText={setName} placeholder="Your full name" textContentType="name" />
        <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" textContentType="emailAddress" />
        <Field label="Password" value={password} onChangeText={setPassword} placeholder="At least 12 characters" secureTextEntry textContentType="newPassword" />

        <Text style={styles.label}>Register as</Text>
        <View style={styles.roleRow}>
          <RoleChoice label="Customer" active={selectedRole === "user"} onPress={() => setSelectedRole("user")} />
          <RoleChoice label="Organization" active={selectedRole === "orgadmin"} onPress={() => setSelectedRole("orgadmin")} />
        </View>

        {selectedRole === "orgadmin" ? (
          <Field label="Organization / company name" value={organizationName} onChangeText={setOrganizationName} placeholder="ABC Care Services Pvt. Ltd." />
        ) : null}

        {error ? <View style={styles.errorBox}><Text style={styles.error}>{error}</Text></View> : null}
        <PrimaryButton label="Create account" loading={busy} onPress={submit} />
        <Text style={styles.helper}>Already registered? <Text style={styles.link} onPress={() => router.push("/sign-in")}>Sign in</Text></Text>
      </View>
    </Screen>
  );
}

type FieldProps = React.ComponentProps<typeof TextInput> & { label: string };
function Field({ label, ...props }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        autoCapitalize={props.keyboardType === "email-address" ? "none" : props.autoCapitalize}
        style={styles.input}
        placeholderTextColor="#7A8F9A"
      />
    </View>
  );
}

function RoleChoice({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.role, active && styles.roleActive]}>
      <Text style={[styles.roleText, active && styles.roleTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  intro: { gap: 5 },
  eyebrow: { color: colors.accent, fontWeight: "900", letterSpacing: 1, fontSize: 11 },
  introTitle: { color: colors.text, fontSize: 22, lineHeight: 28, fontWeight: "900" },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: 14 },
  field: { gap: 6 },
  label: { color: colors.textSecondary, fontWeight: "800", fontSize: 13 },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 13, backgroundColor: colors.surfaceAlt, color: colors.text, fontSize: 15 },
  roleRow: { flexDirection: "row", gap: 10 },
  role: { flex: 1, minHeight: 46, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceAlt },
  roleActive: { borderColor: colors.accentStrong, backgroundColor: colors.accentLight },
  roleText: { color: colors.textSecondary, fontWeight: "800", fontSize: 13 },
  roleTextActive: { color: colors.accentStrong },
  errorBox: { backgroundColor: colors.dangerSoft, borderRadius: radius.sm, padding: spacing.sm },
  error: { color: colors.danger, fontWeight: "700", fontSize: 13, lineHeight: 19 },
  helper: { textAlign: "center", color: colors.muted, fontSize: 13 },
  link: { color: colors.help, fontWeight: "900" },
});
