import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { listBookings } from "@/api/sewak";
import { useAuth } from "@/auth/AuthProvider";
import { Booking } from "@/types";
import { colors, radius, spacing } from "@/theme";

const FILTERS = ["pending", "accepted", "in_progress", "completed", "cancelled"] as const;

export default function JobsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<Booking[]>([]);
  const [filter, setFilter] = useState<string>("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    setError("");
    try { setItems(await listBookings(user)); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to load jobs."); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { load(); }, [load]);
  const filtered = useMemo(() => items.filter((job) => job.status === filter), [items, filter]);

  return (
    <Screen>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Care jobs</Text>
          <Text style={styles.subtitle}>Review requests and manage confirmed care.</Text>
        </View>
        <Pressable onPress={load} style={styles.refresh}><Text style={styles.refreshText}>Refresh</Text></Pressable>
      </View>

      <View style={styles.filters}>
        {FILTERS.map((item) => (
          <Pressable key={item} onPress={() => setFilter(item)} style={[styles.filter, filter === item && styles.filterActive]}>
            <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{item.replaceAll("_", " ")}</Text>
            <Text style={[styles.count, filter === item && styles.filterTextActive]}>{items.filter((job) => job.status === item).length}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? <ActivityIndicator color={colors.accent} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && !filtered.length ? (
        <View style={styles.empty}><Text style={styles.emptyTitle}>No {filter.replaceAll("_", " ")} jobs</Text><Text style={styles.subtitle}>Jobs in this status will appear here.</Text></View>
      ) : null}

      {filtered.map((job) => (
        <Pressable
          key={job.id}
          onPress={() => router.push({ pathname: "/job/[id]", params: { id: job.id } })}
          style={({ pressed }) => [styles.card, pressed && { opacity: 0.84 }]}
        >
          <View style={styles.row}>
            <Text style={styles.name}>{job.userName || "Customer"}</Text>
            <Text style={styles.status}>{job.status.replaceAll("_", " ")}</Text>
          </View>
          <Text style={styles.detail}>{job.serviceLabel || "Care support"} · {job.careRecipient || "Care recipient"}</Text>
          <Text style={styles.subtitle}>{[job.date, job.time || job.requestedTimeWindows?.join(", "), job.durationHours ? `${job.durationHours}h` : ""].filter(Boolean).join(" · ")}</Text>
          <Text style={styles.open}>Open job ›</Text>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  title: { color: colors.text, fontSize: 28, fontWeight: "900" },
  subtitle: { color: colors.muted, lineHeight: 20 },
  refresh: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, backgroundColor: colors.surface, paddingHorizontal: 10, paddingVertical: 8 },
  refreshText: { color: colors.accent, fontWeight: "900", fontSize: 12 },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  filter: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: colors.surface },
  filterActive: { backgroundColor: colors.accentStrong, borderColor: colors.accentStrong },
  filterText: { color: colors.textSecondary, fontWeight: "800", fontSize: 11, textTransform: "capitalize" },
  filterTextActive: { color: "#FFF" },
  count: { color: colors.muted, fontWeight: "900", fontSize: 11 },
  error: { color: colors.danger, fontWeight: "800" },
  empty: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.lg, gap: 5 },
  emptyTitle: { color: colors.text, fontWeight: "900", fontSize: 18, textTransform: "capitalize" },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, gap: 7 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  name: { color: colors.text, fontWeight: "900", fontSize: 17 },
  status: { color: colors.accent, backgroundColor: colors.accentLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill, fontWeight: "900", fontSize: 11, textTransform: "capitalize" },
  detail: { color: colors.textSecondary, fontWeight: "700" },
  open: { color: colors.help, fontWeight: "900", fontSize: 12, alignSelf: "flex-end" },
});
