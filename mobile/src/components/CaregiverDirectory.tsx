import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { CaregiverCard } from "@/components/CaregiverCard";
import { listCaregivers } from "@/api/sewak";
import { Caregiver } from "@/types";
import { colors, radius, spacing } from "@/theme";

function SkeletonCard() {
  return (
    <View style={styles.skeletonCard}>
      <View style={styles.skeletonAvatar} />
      <View style={styles.skeletonBody}>
        <View style={[styles.skeletonLine, { width: "58%" }]} />
        <View style={[styles.skeletonLine, { width: "78%" }]} />
        <View style={[styles.skeletonLine, { width: "44%" }]} />
      </View>
    </View>
  );
}

export function CaregiverDirectory({ title = "Available caregivers" }: { title?: string }) {
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

  useEffect(() => { load(); }, [load]);

  return (
    <View style={styles.wrap}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>Compare services, location, experience and hourly rate.</Text>
        </View>
        {!loading ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh caregiver list"
            onPress={() => { setRefreshing(true); load(); }}
            disabled={refreshing}
            style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed, refreshing && styles.disabled]}
          >
            <Text style={styles.refreshText}>{refreshing ? "Refreshing…" : "Refresh"}</Text>
          </Pressable>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.list}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : null}

      {!loading && error ? (
        <View style={styles.error}>
          <Text style={styles.errorTitle}>Couldn't load caregivers</Text>
          <Text style={styles.muted}>{error}</Text>
          <Pressable onPress={() => { setLoading(true); load(); }}><Text style={styles.link}>Try again</Text></Pressable>
        </View>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}><Text style={styles.emptyIconText}>♡</Text></View>
          <Text style={styles.emptyTitle}>No approved caregivers available right now</Text>
          <Text style={styles.muted}>New caregiver availability will appear here automatically. You can refresh to check again.</Text>
          <Pressable onPress={() => { setRefreshing(true); load(); }} style={styles.emptyRefresh}>
            <Text style={styles.refreshText}>Refresh caregivers</Text>
          </Pressable>
        </View>
      ) : null}

      {!loading && !error ? (
        <View style={styles.list}>
          {items.map((caregiver) => (
            <CaregiverCard
              key={caregiver.id}
              caregiver={caregiver}
              onPress={() => router.push({ pathname: "/caregiver/[id]", params: { id: caregiver.id } })}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  list: { gap: spacing.sm },
  headingRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  headingCopy: { flex: 1, gap: 4 },
  title: { color: colors.text, fontSize: 23, lineHeight: 29, fontWeight: "900", letterSpacing: -0.25 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  refreshButton: {
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  refreshText: { color: colors.accentStrong, fontWeight: "800", fontSize: 12 },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.55 },
  error: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: "#E5A8A4",
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    gap: 7,
  },
  errorTitle: { color: colors.danger, fontWeight: "900", fontSize: 16 },
  link: { color: colors.help, fontWeight: "800", marginTop: 4 },
  empty: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 8,
  },
  emptyIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.accentLight, alignItems: "center", justifyContent: "center" },
  emptyIconText: { color: colors.accentStrong, fontSize: 24, fontWeight: "800" },
  emptyTitle: { color: colors.text, fontWeight: "900", fontSize: 16, lineHeight: 21, textAlign: "center" },
  emptyRefresh: { marginTop: 5, minHeight: 40, justifyContent: "center", paddingHorizontal: 14, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  skeletonCard: { flexDirection: "row", gap: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderMuted, backgroundColor: colors.surface },
  skeletonAvatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.backgroundAccent },
  skeletonBody: { flex: 1, justifyContent: "center", gap: 9 },
  skeletonLine: { height: 10, borderRadius: 5, backgroundColor: colors.backgroundAccent },
});
