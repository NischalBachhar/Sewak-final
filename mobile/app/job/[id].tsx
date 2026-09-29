import React, { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Screen } from "@/components/Screen";
import { PrimaryButton } from "@/components/PrimaryButton";
import {
  addCareTask,
  addCareUpdate,
  finishCareSession,
  getBooking,
  getCareSession,
  listCareTasks,
  listCareUpdates,
  startCareSession,
  submitBookingReport,
  toggleCareTask,
  updateBookingStatus,
} from "@/api/sewak";
import { useAuth } from "@/auth/AuthProvider";
import { Booking, CareSession, CareTask, CareUpdate } from "@/types";
import { formatNpr } from "@/domain/booking";
import { colors, radius, spacing } from "@/theme";

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [session, setSession] = useState<CareSession | null>(null);
  const [tasks, setTasks] = useState<CareTask[]>([]);
  const [updates, setUpdates] = useState<CareUpdate[]>([]);
  const [taskText, setTaskText] = useState("");
  const [updateText, setUpdateText] = useState("");
  const [reportReason, setReportReason] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [showReport, setShowReport] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    setError("");
    try {
      const current = await getBooking(id);
      setBooking(current);
      if (["accepted", "in_progress", "completed"].includes(current.status)) {
        const [s, t, u] = await Promise.all([
          getCareSession(id).catch(() => null),
          listCareTasks(id).catch(() => []),
          listCareUpdates(id).catch(() => []),
        ]);
        setSession(s); setTasks(t); setUpdates(u);
      } else {
        setSession(null); setTasks([]); setUpdates([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load job.");
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const run = async (task: () => Promise<unknown>, success?: string) => {
    setWorking(true); setError(""); setNotice("");
    try {
      await task();
      if (success) setNotice(success);
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "We could not update this job."); }
    finally { setWorking(false); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>;
  if (!booking) return <Screen><Text style={styles.error}>{error || "Job not found."}</Text></Screen>;
  if (!user) return <Screen><Text style={styles.error}>Sign in again to manage this job.</Text></Screen>;

  return (
    <Screen>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>CARE JOB</Text>
          <Text style={styles.title}>{booking.userName || "Customer"}</Text>
          <Text style={styles.status}>{booking.status.replaceAll("_", " ")}</Text>
        </View>
        <Pressable onPress={load} style={styles.refresh}><Text style={styles.refreshText}>Refresh</Text></Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.noticeGood}>{notice}</Text> : null}

      <View style={styles.card}>
        <Row label="Service" value={booking.serviceLabel || "Care support"} />
        <Row label="Care for" value={booking.careRecipient || "—"} />
        <Row label="Schedule" value={[booking.date, booking.time || booking.requestedTimeWindows?.join(", ")].filter(Boolean).join(" · ") || "—"} />
        <Row label="Duration" value={booking.durationHours ? `${booking.durationHours} hours` : "—"} />
        <Row label="Address" value={[booking.address, booking.city].filter(Boolean).join(", ") || "—"} />
        <Row label="Customer phone" value={booking.userPhone || "—"} />
        <Row label="Your earnings" value={formatNpr(booking.vendorEarnings)} />
        {booking.careNeeds ? <Row label="Care needs" value={booking.careNeeds} /> : null}
        {booking.notes ? <Row label="Instructions" value={booking.notes} /> : null}
      </View>

      {booking.status === "pending" ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Respond to request</Text>
          <Text style={styles.body}>Review the care needs, address and schedule before accepting.</Text>
          <PrimaryButton label="Accept booking" loading={working} onPress={() => run(() => updateBookingStatus(booking.id, "accepted"), "Booking accepted.")} />
          <PrimaryButton label="Decline request" variant="secondary" disabled={working} onPress={() => run(() => updateBookingStatus(booking.id, "cancelled"), "Booking declined.")} />
        </View>
      ) : null}

      {booking.status === "accepted" && !session ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Start care when you arrive</Text>
          <Text style={styles.body}>Check in only after reaching the care location. Sewak records the arrival time automatically.</Text>
          <PrimaryButton label="I've arrived / Check in" loading={working} onPress={() => run(() => startCareSession(booking, user.uid), "Care session started.")} />
        </View>
      ) : null}

      {booking.status === "in_progress" && session ? (
        <>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Active care session</Text>
            {session.actualCheckIn ? <Row label="Checked in" value={new Date(session.actualCheckIn).toLocaleString()} /> : null}

            <Text style={styles.subheading}>Care tasks</Text>
            {tasks.length ? tasks.map((task) => (
              <Pressable key={task.id} onPress={() => run(() => toggleCareTask(booking.id, task, user.uid))} style={styles.task}>
                <Text style={task.status === "completed" ? styles.done : styles.body}>{task.status === "completed" ? "✓ " : "○ "}{task.label}</Text>
              </Pressable>
            )) : <Text style={styles.muted}>No tasks added yet.</Text>}
            <View style={styles.inline}>
              <TextInput value={taskText} onChangeText={setTaskText} maxLength={120} placeholder="Add a care task" placeholderTextColor="#7A8F9A" style={[styles.input, { flex: 1 }]} />
              <Pressable disabled={working || !taskText.trim()} onPress={() => run(async () => { await addCareTask(booking.id, user.uid, taskText); setTaskText(""); })} style={styles.smallButton}><Text style={styles.smallButtonText}>Add</Text></Pressable>
            </View>

            <Text style={styles.subheading}>Updates for family</Text>
            {updates.map((update) => <View key={update.id} style={styles.update}><Text style={styles.body}>{update.message}</Text>{update.createdAt ? <Text style={styles.muted}>{new Date(update.createdAt).toLocaleString()}</Text> : null}</View>)}
            <TextInput value={updateText} onChangeText={setUpdateText} multiline maxLength={500} placeholder="Share a care update" placeholderTextColor="#7A8F9A" style={[styles.input, styles.multiline]} />
            <PrimaryButton label="Share update" variant="secondary" disabled={working || !updateText.trim()} onPress={() => run(async () => { await addCareUpdate(booking.id, user.uid, updateText); setUpdateText(""); })} />

            <PrimaryButton label="Finish shift / Check out" loading={working} onPress={() => run(() => finishCareSession(booking.id), "Care session completed.")} />
          </View>
        </>
      ) : null}

      {booking.status === "completed" ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Care completed</Text>
          <Text style={styles.body}>This care session is complete. Completed earnings are included in your Earnings tab.</Text>
          {session?.actualCheckOut ? <Row label="Checked out" value={new Date(session.actualCheckOut).toLocaleString()} /> : null}
        </View>
      ) : null}

      {!["cancelled"].includes(booking.status) ? (
        <View style={styles.card}>
          <Pressable onPress={() => setShowReport((value) => !value)}><Text style={styles.reportLink}>{showReport ? "Hide conduct report" : "Report a serious customer issue"}</Text></Pressable>
          {showReport ? (
            <>
              <Text style={styles.muted}>Use reporting only for serious conduct or safety concerns linked to this assigned booking.</Text>
              <TextInput value={reportReason} onChangeText={setReportReason} maxLength={160} placeholder="Reason" placeholderTextColor="#7A8F9A" style={styles.input} />
              <TextInput value={reportDescription} onChangeText={setReportDescription} multiline maxLength={1000} placeholder="What happened?" placeholderTextColor="#7A8F9A" style={[styles.input, styles.multiline]} />
              <PrimaryButton
                label="Submit report"
                variant="secondary"
                disabled={!reportReason.trim() || !reportDescription.trim() || working}
                onPress={() => run(async () => {
                  const result = await submitBookingReport({ booking, caregiverId: user.uid, caregiverName: user.displayName || "Caregiver", reason: reportReason, description: reportDescription });
                  setNotice(result.duplicate ? "A report already exists for this booking." : "Report submitted for review.");
                  setShowReport(false); setReportReason(""); setReportDescription("");
                })}
              />
            </>
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <View style={styles.row}><Text style={styles.rowLabel}>{label}</Text><Text style={styles.rowValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  eyebrow: { color: colors.accent, fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  title: { color: colors.text, fontSize: 27, fontWeight: "900" },
  status: { color: colors.accent, fontWeight: "900", textTransform: "capitalize" },
  refresh: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, backgroundColor: colors.surface, paddingHorizontal: 10, paddingVertical: 8 },
  refreshText: { color: colors.accent, fontWeight: "900", fontSize: 12 },
  error: { color: colors.danger, fontWeight: "800" },
  noticeGood: { color: colors.positive, backgroundColor: colors.positiveSoft, padding: spacing.sm, borderRadius: radius.sm, fontWeight: "800" },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
  subheading: { color: colors.text, fontWeight: "900", marginTop: 8 },
  body: { color: colors.textSecondary, lineHeight: 21 },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  row: { gap: 3, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderMuted, paddingBottom: 7 },
  rowLabel: { color: colors.muted, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  rowValue: { color: colors.text, lineHeight: 20, fontWeight: "700" },
  task: { paddingVertical: 7 },
  done: { color: colors.positive, fontWeight: "800", lineHeight: 21 },
  inline: { flexDirection: "row", gap: 8, alignItems: "center" },
  input: { minHeight: 46, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, paddingHorizontal: 12, color: colors.text },
  multiline: { minHeight: 90, paddingTop: 10, textAlignVertical: "top" },
  smallButton: { backgroundColor: colors.accentStrong, borderRadius: radius.md, minHeight: 46, paddingHorizontal: 14, alignItems: "center", justifyContent: "center" },
  smallButtonText: { color: "#FFF", fontWeight: "900" },
  update: { paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderMuted, gap: 3 },
  reportLink: { color: colors.danger, fontWeight: "900" },
});
