import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useAuth } from "@/auth/AuthProvider";
import { listBookings } from "@/api/sewak";
import { Booking } from "@/types";
import { colors, radius, spacing } from "@/theme";

const todayNepal = () => {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kathmandu", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
};

export default function HomeScreen() {
  const router = useRouter();
  const { user, role } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(role === "user" || role === "caregiver");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user || !["user", "caregiver"].includes(user.role)) {
      setLoading(false);
      return;
    }
    let active = true;
    listBookings(user)
      .then((items) => active && setBookings(items))
      .catch((err) => active && setError(err instanceof Error ? err.message : "Unable to load your dashboard."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [user]);

  const firstName = (user?.displayName || String(user?.profile?.name || "") || "there").trim().split(/\s+/)[0];
  const activeBookings = useMemo(() => bookings.filter((item) => ["pending", "accepted", "in_progress"].includes(item.status)), [bookings]);

  if (loading) {
    return <View style={styles.loading}><ActivityIndicator color={colors.accent} /></View>;
  }

  if (role === "caregiver" && user) {
    const today = todayNepal();
    const todaysJobs = bookings.filter((booking) => booking.date === today && booking.status !== "cancelled");
    const pending = bookings.filter((booking) => booking.status === "pending").length;
    const completed = bookings.filter((booking) => booking.status === "completed").length;
    const nextJob = activeBookings
      .filter((booking) => booking.date && booking.date >= today)
      .sort((a, b) => `${a.date}T${a.time || "23:59"}`.localeCompare(`${b.date}T${b.time || "23:59"}`))[0];

    return (
      <Screen>
        <Text style={styles.eyebrow}>CAREGIVER WORKSPACE</Text>
        <Text style={styles.title}>Good day, {firstName}</Text>
        <Text style={styles.body}>Manage requests, scheduled care and your active shift.</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.statGrid}>
          <Stat label="Today's jobs" value={todaysJobs.length} />
          <Stat label="Pending" value={pending} />
          <Stat label="Completed" value={completed} />
          <Stat label="Active" value={bookings.filter((b) => b.status === "in_progress").length} />
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.cardEyebrow}>NEXT JOB</Text>
          <Text style={styles.cardTitle}>{nextJob ? nextJob.userName || "Customer" : "No upcoming care"}</Text>
          <Text style={styles.body}>
            {nextJob ? [nextJob.date, nextJob.time, nextJob.serviceLabel].filter(Boolean).join(" · ") : "New requests will appear in Jobs."}
          </Text>
          <PrimaryButton label="Open jobs" onPress={() => router.push("/(tabs)/jobs")} />
        </View>
      </Screen>
    );
  }

  if (role === "orgadmin" || role === "superadmin") {
    return (
      <Screen>
        <Text style={styles.eyebrow}>{role === "superadmin" ? "SEWAK ADMIN" : "ORGANIZATION"}</Text>
        <Text style={styles.title}>Welcome, {firstName}</Text>
        <View style={styles.heroCard}>
          <Text style={styles.cardTitle}>Your account is connected to Cloudflare D1</Text>
          <Text style={styles.body}>
            Customer and caregiver operations are now available natively. High-risk organization and superadmin controls remain on Sewak's web dashboard while the dedicated mobile admin module is completed.
          </Text>
        </View>
        <PrimaryButton label="Account profile" variant="secondary" onPress={() => router.push("/(tabs)/profile")} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={styles.eyebrow}>FAMILY CARE</Text>
      <Text style={styles.title}>Welcome back, {firstName}</Text>
      <Text style={styles.body}>Find care, book by exact hours or time windows, and follow each care session in one place.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.heroCard}>
        <Text style={styles.cardTitle}>Who needs care today?</Text>
        <Text style={styles.body}>Compare caregiver skills, verification, experience, reviews and hourly rates.</Text>
        <PrimaryButton label="Find a caregiver" onPress={() => router.push("/(tabs)/caregivers")} />
      </View>

      {activeBookings.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active bookings</Text>
          {activeBookings.slice(0, 3).map((booking) => (
            <View key={booking.id} style={styles.bookingCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.bookingName}>{booking.caregiverName || "Caregiver"}</Text>
                <Text style={styles.bookingMeta}>{[booking.date, booking.time || booking.requestedTimeWindows?.join(", "), booking.status.replaceAll("_", " ")].filter(Boolean).join(" · ")}</Text>
              </View>
              <Text style={styles.open} onPress={() => router.push({ pathname: "/booking-detail/[id]", params: { id: booking.id } })}>Open</Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.empty}><Text style={styles.emptyTitle}>No active bookings</Text><Text style={styles.body}>Your pending and confirmed care will appear here.</Text></View>
      )}
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  eyebrow: { color: colors.accent, fontWeight: "900", fontSize: 12, letterSpacing: 1 },
  title: { color: colors.text, fontSize: 28, fontWeight: "900" },
  body: { color: colors.muted, lineHeight: 21 },
  error: { color: colors.danger, fontWeight: "700" },
  heroCard: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.md },
  cardEyebrow: { color: colors.accent, fontSize: 11, letterSpacing: 1, fontWeight: "900" },
  cardTitle: { color: colors.text, fontSize: 20, fontWeight: "900" },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stat: { width: "48%", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderMuted, borderRadius: radius.md, padding: spacing.md },
  statValue: { color: colors.accentStrong, fontSize: 26, fontWeight: "900" },
  statLabel: { color: colors.muted, fontSize: 12, marginTop: 3 },
  section: { gap: spacing.sm },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
  bookingCard: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, gap: 12 },
  bookingName: { color: colors.text, fontWeight: "900" },
  bookingMeta: { color: colors.muted, fontSize: 12, marginTop: 4, textTransform: "capitalize" },
  open: { color: colors.help, fontWeight: "900" },
  empty: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.lg, gap: 6 },
  emptyTitle: { color: colors.text, fontWeight: "900", fontSize: 17 },
});
