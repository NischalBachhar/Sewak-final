import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { listBookings } from "@/api/sewak";
import { useAuth } from "@/auth/AuthProvider";
import { Booking } from "@/types";
import { formatNpr } from "@/domain/booking";
import { colors, radius, spacing } from "@/theme";

export default function EarningsScreen() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    listBookings(user)
      .then(setBookings)
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load earnings."))
      .finally(() => setLoading(false));
  }, [user]);

  const completed = useMemo(() => bookings.filter((booking) => booking.status === "completed"), [bookings]);
  const totals = useMemo(() => ({
    net: completed.reduce((sum, item) => sum + Number(item.vendorEarnings || 0), 0),
    gross: completed.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0),
    platform: completed.reduce((sum, item) => sum + Number(item.platformCommission || 0), 0),
  }), [completed]);

  return (
    <Screen>
      <Text style={styles.title}>Earnings</Text>
      <Text style={styles.subtitle}>Completed-care earnings based on the booking snapshots stored by Sewak.</Text>
      {loading ? <ActivityIndicator color={colors.accent} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.grid}>
        <Stat label="Your completed earnings" value={formatNpr(totals.net)} />
        <Stat label="Completed jobs" value={String(completed.length)} />
        <Stat label="Gross care value" value={formatNpr(totals.gross)} />
        <Stat label="Platform commission" value={formatNpr(totals.platform)} />
      </View>

      <Text style={styles.sectionTitle}>Completed jobs</Text>
      {!loading && !completed.length ? <View style={styles.empty}><Text style={styles.subtitle}>No completed-care earnings yet.</Text></View> : null}
      {completed.map((booking) => (
        <View key={booking.id} style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.name}>{booking.userName || "Customer"}</Text>
            <Text style={styles.amount}>{formatNpr(booking.vendorEarnings)}</Text>
          </View>
          <Text style={styles.subtitle}>{[booking.date, booking.serviceLabel, booking.durationHours ? `${booking.durationHours}h` : ""].filter(Boolean).join(" · ")}</Text>
          <View style={styles.row}>
            <Text style={styles.muted}>Gross {formatNpr(booking.totalAmount)}</Text>
            <Text style={styles.muted}>Commission {formatNpr(booking.platformCommission)}</Text>
          </View>
        </View>
      ))}
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}
const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 28, fontWeight: "900" },
  subtitle: { color: colors.muted, lineHeight: 20 },
  error: { color: colors.danger, fontWeight: "800" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stat: { width: "48%", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, gap: 5 },
  statValue: { color: colors.accentStrong, fontSize: 18, fontWeight: "900" },
  statLabel: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
  empty: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.lg },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, gap: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  name: { color: colors.text, fontWeight: "900" },
  amount: { color: colors.positive, fontWeight: "900" },
  muted: { color: colors.muted, fontSize: 11 },
});
