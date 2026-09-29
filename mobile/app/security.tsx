import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Screen } from "@/components/Screen";
import { PrimaryButton } from "@/components/PrimaryButton";
import { changePassword, listSessions, revokeSessions } from "@/auth/authApi";
import { useAuth } from "@/auth/AuthProvider";
import { SessionMetadata } from "@/types";
import { colors, radius, spacing } from "@/theme";

export default function SecurityScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [sessions, setSessions] = useState<SessionMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setError("");
    try { setSessions(await listSessions()); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to load sessions."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const change = async () => {
    setError(""); setNotice("");
    if (!currentPassword) return setError("Enter your current password.");
    if (newPassword.length < 12) return setError("New password must be at least 12 characters.");
    if (newPassword !== confirm) return setError("New passwords do not match.");
    setWorking(true);
    try {
      await changePassword(currentPassword, newPassword);
      setNotice("Password changed. All sessions were revoked; sign in again.");
      await signOut().catch(() => {});
      router.replace("/sign-in");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not change password."); }
    finally { setWorking(false); }
  };

  const revokeOne = async (sessionId: string) => {
    setWorking(true); setError("");
    try {
      const result = await revokeSessions({ sessionId });
      if (result.signedOut) {
        router.replace("/sign-in");
        return;
      }
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not revoke session."); }
    finally { setWorking(false); }
  };

  const revokeAll = async () => {
    setWorking(true); setError("");
    try {
      await revokeSessions({ all: true });
      router.replace("/sign-in");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not revoke sessions."); }
    finally { setWorking(false); }
  };

  return (
    <Screen>
      <Text style={styles.title}>Account security</Text>
      <Text style={styles.body}>Mobile sessions use an opaque bearer token stored in your device's secure keychain/keystore.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Active sessions</Text>
        {loading ? <ActivityIndicator color={colors.accent} /> : null}
        {!loading && !sessions.length ? <Text style={styles.muted}>No session metadata available.</Text> : null}
        {sessions.map((session) => (
          <View key={session.id} style={styles.session}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sessionTitle}>{session.current ? "This device" : "Sewak session"}</Text>
              <Text style={styles.muted}>{session.expiresAt ? `Expires ${new Date(session.expiresAt).toLocaleString()}` : session.id}</Text>
            </View>
            <Pressable disabled={working} onPress={() => revokeOne(session.id)}><Text style={styles.revoke}>Revoke</Text></Pressable>
          </View>
        ))}
        <PrimaryButton label="Sign out all devices" variant="secondary" disabled={working} onPress={revokeAll} />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Change password</Text>
        <Text style={styles.muted}>Changing the password revokes every Sewak session.</Text>
        <Field label="Current password" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry />
        <Field label="New password" value={newPassword} onChangeText={setNewPassword} secureTextEntry />
        <Field label="Confirm new password" value={confirm} onChangeText={setConfirm} secureTextEntry />
        <PrimaryButton label="Change password" loading={working} onPress={change} />
      </View>
    </Screen>
  );
}

function Field({ label, ...props }: React.ComponentProps<typeof TextInput> & { label: string }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...props} style={styles.input} placeholderTextColor="#7A8F9A" /></View>;
}
const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 28, fontWeight: "900" },
  body: { color: colors.textSecondary, lineHeight: 21 },
  error: { color: colors.danger, fontWeight: "800" },
  notice: { color: colors.positive, backgroundColor: colors.positiveSoft, padding: spacing.sm, borderRadius: radius.sm, fontWeight: "800" },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, gap: spacing.md },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  session: { flexDirection: "row", gap: 10, alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderMuted, paddingTop: 10 },
  sessionTitle: { color: colors.text, fontWeight: "800" },
  revoke: { color: colors.danger, fontWeight: "900" },
  field: { gap: 6 },
  label: { color: colors.textSecondary, fontWeight: "800", fontSize: 13 },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, paddingHorizontal: 12, color: colors.text },
});
