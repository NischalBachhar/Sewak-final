import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { CaregiverCard } from "@/components/CaregiverCard";
import { listCaregivers } from "@/api/sewak";
import { Caregiver } from "@/types";
import { colors, radius, spacing } from "@/theme";

export function CaregiverDirectory({ title = "Find a caregiver" }: { title?: string }) {
  const router = useRouter();
  const [items, setItems] = useState<Caregiver[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setItems(await listCaregivers());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load caregivers.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.muted}>Finding available caregivers…</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>
        Compare care type, location, experience and hourly rate before requesting care.
      </Text>

      {error ? (
        <View style={styles.error}>
          <Text style={styles.errorTitle}>We couldn't load caregivers</Text>
          <Text style={styles.muted}>{error}</Text>
          <Text style={styles.link} onPress={() => { setLoading(true); load(); }}>
            Try again
          </Text>
        </View>
      ) : null}

      {!error && items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No caregivers available right now</Text>
          <Text style={styles.muted}>Please check again later.</Text>
        </View>
      ) : null}

      <View style={styles.list}>
        {items.map((caregiver) => (
          <CaregiverCard
            key={caregiver.id}
            caregiver={caregiver}
            onPress={() =>
              router.push({
                pathname: "/caregiver/[id]",
                params: { id: caregiver.id },
              })
            }
          />
        ))}
      </View>

      <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  list: { gap: spacing.sm },
  center: { alignItems: "center", paddingVertical: 48, gap: 10 },
  title: { color: colors.text, fontSize: 28, fontWeight: "900" },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  muted: { color: colors.muted, lineHeight: 20 },
  error: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: "#E5A8A4",
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    gap: 6,
  },
  errorTitle: { color: colors.danger, fontWeight: "900" },
  link: { color: colors.help, fontWeight: "800", marginTop: 6 },
  empty: {
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 6,
  },
  emptyTitle: { color: colors.text, fontWeight: "900", fontSize: 17 },
});
