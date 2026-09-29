import React, { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Screen } from "@/components/Screen";
import { PrimaryButton } from "@/components/PrimaryButton";
import {
  getBooking,
  getCareSession,
  getReview,
  listCareTasks,
  listCareUpdates,
  submitReview,
  updateBookingStatus,
} from "@/api/sewak";
import { useAuth } from "@/auth/AuthProvider";
import { Booking, CareSession, CareTask, CareUpdate, PublicReview } from "@/types";
import { formatNpr } from "@/domain/booking";
import { colors, radius, spacing } from "@/theme";

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [session, setSession] = useState<CareSession | null>(null);
  const [tasks, setTasks] = useState<CareTask[]>([]);
  const [updates, setUpdates] = useState<CareUpdate[]>([]);
  const [review, setReview] = useState<PublicReview | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    setError("");
    try {
      const current = await getBooking(id);
      setBooking(current);
      if (["in_progress", "completed"].includes(current.status)) {
        const [sessionResult, taskResult, updateResult] = await Promise.all([
          getCareSession(id).catch(() => null),
          listCareTasks(id).catch(() => []),
          listCareUpdates(id).catch(() => []),
        ]);
        setSession(sessionResult);
        setTasks(taskResult);
        setUpdates(updateResult);
      } else {
        setSession(null); setTasks([]); setUpdates([]);
      }
      if (current.status === "completed") setReview(await getReview(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load booking.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const cancel = async () => {
    if (!booking || booking.status !== "pending") return;
    setWorking(true); setError("");
    try { await updateBookingStatus(booking.id, "cancelled"); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not cancel booking."); }
    finally { setWorking(false); }
  };

  const saveReview = async () => {
    if (!booking || !user) return;
    setWorking(true); setError("");
    try { await submitReview(booking, user.uid, rating, comment); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not save review."); }
    finally { setWorking(false); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>;
  if (error && !booking) return <Screen><Text style={styles.error}>{error}</Text></Screen>;
  if (!booking) return <Screen><Text style={styles.error}>Booking not found.</Text></Screen>;

  return (
    <Screen>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>BOOKING</Text>
          <Text style={styles.title}>{booking.caregiverName || "Caregiver"}</Text>
          <Text style={styles.status}>{booking.status.replaceAll("_", " ")}</Text>
        </View>
        <Pressable onPress={load} style={styles.refresh}><Text style={styles.refreshText}>Refresh</Text></Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.card}>
        <Row label="Service" value={booking.serviceLabel || "Care support"} />
        <Row label="Care for" value={booking.careRecipient || "—"} />
        <Row label="Schedule" value={[booking.date, booking.time || booking.requestedTimeWindows?.join(", ")].filter(Boolean).join(" · ") || "—"} />
        <Row label="Duration" value={booking.durationHours ? `${booking.durationHours} hours · ${booking.recurrence === "recurring" ? "Recurring" : "One time"}` : "—"} />
        <Row label="Address" value={[booking.address, booking.city].filter(Boolean).join(", ") || "—"} />
        <Row label="Cash total" value={formatNpr(booking.amountDue ?? booking.totalAmount)} />
        <Row label="Payment" value={booking.paymentStatus || "pending"} />
        {booking.careNeeds ? <Row label="Care needs" value={booking.careNeeds} /> : null}
        {booking.notes ? <Row label="Instructions" value={booking.notes} /> : null}
      </View>

      {booking.status === "pending" ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Waiting for caregiver</Text>
          <Text style={styles.body}>The caregiver can accept this request. You can cancel while it is still pending.</Text>
          <PrimaryButton label="Cancel request" variant="secondary" loading={working} onPress={cancel} />
        </View>
      ) : null}

      {booking.status === "accepted" ? (
        <View style={styles.card}><Text style={styles.sectionTitle}>Booking confirmed</Text><Text style={styles.body}>Your caregiver accepted this request. They can check in when the care session begins.</Text></View>
      ) : null}

      {session ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Care session</Text>
          <Row label="Status" value={session.status || booking.status} />
          {session.actualCheckIn ? <Row label="Checked in" value={new Date(session.actualCheckIn).toLocaleString()} /> : null}
          {session.actualCheckOut ? <Row label="Checked out" value={new Date(session.actualCheckOut).toLocaleString()} /> : null}

          <Text style={styles.subheading}>Care tasks</Text>
          {tasks.length ? tasks.map((task) => (
            <View key={task.id} style={styles.logRow}><Text style={task.status === "completed" ? styles.done : styles.body}>{task.status === "completed" ? "✓ " : "○ "}{task.label}</Text></View>
          )) : <Text style={styles.muted}>No care tasks recorded yet.</Text>}

          <Text style={styles.subheading}>Updates from caregiver</Text>
          {updates.length ? updates.map((update) => (
            <View key={update.id} style={styles.update}><Text style={styles.body}>{update.message}</Text>{update.createdAt ? <Text style={styles.muted}>{new Date(update.createdAt).toLocaleString()}</Text> : null}</View>
          )) : <Text style={styles.muted}>No updates shared yet.</Text>}
        </View>
      ) : null}

      {booking.status === "completed" ? (
        review ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Your verified review</Text>
            <Text style={styles.stars}>{"★".repeat(Number(review.rating || 0))}</Text>
            {review.comment ? <Text style={styles.body}>{review.comment}</Text> : null}
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Review completed care</Text>
            <Text style={styles.body}>Only completed bookings can create a verified review.</Text>
            <View style={styles.starRow}>
              {[1,2,3,4,5].map((value) => (
                <Pressable key={value} onPress={() => setRating(value)}><Text style={[styles.starButton, value <= rating && styles.starSelected]}>★</Text></Pressable>
              ))}
            </View>
            <TextInput
              value={comment}
              onChangeText={setComment}
              multiline
              maxLength={600}
              placeholder="Share your experience"
              placeholderTextColor="#7A8F9A"
              style={styles.input}
            />
            <PrimaryButton label="Submit verified review" loading={working} onPress={saveReview} />
          </View>
        )
      ) : null}
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <View style={styles.row}><Text style={styles.rowLabel}>{label}</Text><Text style={styles.rowValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  header: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  eyebrow: { color: colors.accent, fontWeight: "900", fontSize: 11, letterSpacing: 1 },
  title: { color: colors.text, fontSize: 27, fontWeight: "900" },
  status: { color: colors.accentStrong, textTransform: "capitalize", fontWeight: "900", marginTop: 4 },
  refresh: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, backgroundColor: colors.surface, paddingHorizontal: 10, paddingVertical: 8 },
  refreshText: { color: colors.accent, fontWeight: "900", fontSize: 12 },
  error: { color: colors.danger, fontWeight: "800" },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
  subheading: { color: colors.text, fontWeight: "900", marginTop: 8 },
  body: { color: colors.textSecondary, lineHeight: 21 },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  row: { gap: 3, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderMuted, paddingBottom: 8 },
  rowLabel: { color: colors.muted, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  rowValue: { color: colors.text, lineHeight: 20, fontWeight: "700", textTransform: "none" },
  logRow: { paddingVertical: 4 },
  done: { color: colors.positive, lineHeight: 21, fontWeight: "800" },
  update: { gap: 3, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderMuted },
  stars: { color: colors.warning, fontSize: 22, letterSpacing: 2 },
  starRow: { flexDirection: "row", gap: 8 },
  starButton: { fontSize: 34, color: colors.border },
  starSelected: { color: colors.warning },
  input: { minHeight: 100, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, padding: 12, color: colors.text, textAlignVertical: "top" },
});
