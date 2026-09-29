import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { listBookings } from "@/api/sewak";
import { useAuth } from "@/auth/AuthProvider";
import { Booking } from "@/types";
import { formatNpr } from "@/domain/booking";
import { colors, radius, spacing } from "@/theme";

const toneFor = (status: string) => {
  if (status === "completed") return { bg: colors.positiveSoft, fg: colors.positive };
  if (status === "cancelled" || status === "issue_reported") return { bg: colors.dangerSoft, fg: colors.danger };
  if (status === "accepted" || status === "in_progress") return { bg: colors.accentLight, fg: colors.accentStrong };
  return { bg: colors.warningSoft, fg: colors.warning };
};

export default function BookingsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    setError("");
    try { setItems(await listBookings(user)); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to load bookings."); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  return (
    <Screen>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>My bookings</Text>
          <Text style={styles.subtitle}>Requests, confirmed care, active sessions and completed care.</Text>
        </View>
        <Pressable onPress={load} style={styles.refresh}><Text style={styles.refreshText}>Refresh</Text></Pressable>
      </View>

      {loading ? <ActivityIndicator color={colors.accent} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && !error && items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No bookings yet</Text>
          <Text style={styles.subtitle}>Choose a caregiver to request care.</Text>
        </View>
      ) : null}

      {items.map((booking) => {
        const tone = toneFor(booking.status);
        return (
          <Pressable
            key={booking.id}
            onPress={() => router.push({ pathname: "/booking-detail/[id]", params: { id: booking.id } })}
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
          >
            <View style={styles.row}>
              <Text style={styles.name}>{booking.caregiverName || "Caregiver"}</Text>
              <Text style={[styles.status, { backgroundColor: tone.bg, color: tone.fg }]}>{booking.status.replaceAll("_", " ")}</Text>
            </View>
            <Text style={styles.subtitle}>{booking.serviceLabel || "Care support"}</Text>
            <Text style={styles.detail}>
              {[booking.date, booking.time || booking.requestedTimeWindows?.join(", "), booking.durationHours ? `${booking.durationHours}h` : ""].filter(Boolean).join(" · ")}
            </Text>
            <View style={styles.row}>
              <Text style={styles.amount}>{formatNpr(booking.amountDue ?? booking.totalAmount)}</Text>
              <Text style={styles.open}>View details ›</Text>
            </View>
          </Pressable>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  title: { color: colors.text, fontSize: 28, fontWeight: "900" },
  subtitle: { color: colors.muted, lineHeight: 20 },
  refresh: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 8 },
  refreshText: { color: colors.accent, fontWeight: "900", fontSize: 12 },
  error: { color: colors.danger, fontWeight: "700" },
  empty: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.lg, gap: 6 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, gap: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "center" },
  name: { flex: 1, color: colors.text, fontWeight: "900", fontSize: 17 },
  status: { textTransform: "capitalize", borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5, fontSize: 11, fontWeight: "900" },
  detail: { color: colors.textSecondary, fontSize: 13 },
  amount: { color: colors.accentStrong, fontWeight: "900" },
  open: { color: colors.help, fontWeight: "800", fontSize: 12 },
});
