import React from "react";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useAuth } from "@/auth/AuthProvider";
import { colors, radius, spacing } from "@/theme";

export default function HomeScreen() {
  const router = useRouter();
  const { profile, role } = useAuth();
  const firstName = profile?.name?.trim().split(/\s+/)[0] || "there";

  if (role === "caregiver") {
    return (
      <Screen>
        <Text style={styles.eyebrow}>CAREGIVER</Text>
        <Text style={styles.title}>Welcome back, {firstName}</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Caregiver dashboard foundation is ready</Text>
          <Text style={styles.body}>Job requests, active care sessions, availability and earnings are the next mobile milestone.</Text>
        </View>
      </Screen>
    );
  }

  if (role === "orgadmin" || role === "superadmin") {
    return (
      <Screen>
        <Text style={styles.eyebrow}>SEWAK ACCOUNT</Text>
        <Text style={styles.title}>Welcome, {firstName}</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Admin stays on the web for now</Text>
          <Text style={styles.body}>The existing web dashboard remains the administrative control surface while customer and caregiver mobile flows are built.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={styles.eyebrow}>FAMILY CARE</Text>
      <Text style={styles.title}>Welcome back, {firstName}</Text>
      <Text style={styles.body}>Find care, request a visit and keep your bookings together in Sewak.</Text>
      <View style={styles.hero}>
        <Text style={styles.cardTitle}>Who needs care today?</Text>
        <Text style={styles.body}>Browse caregiver profiles by care type, location and experience.</Text>
        <PrimaryButton label="Find a caregiver" onPress={() => router.push("/(tabs)/caregivers")} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow:{ color:colors.accent, fontWeight:"900", fontSize:12, letterSpacing:1 },
  title:{ color:colors.text, fontSize:28, fontWeight:"900" },
  body:{ color:colors.muted, lineHeight:21 },
  hero:{ backgroundColor:colors.surface, borderWidth:1, borderColor:colors.border, borderRadius:radius.lg, padding:spacing.lg, gap:spacing.md },
  card:{ backgroundColor:colors.surface, borderWidth:1, borderColor:colors.border, borderRadius:radius.md, padding:spacing.lg, gap:spacing.sm },
  cardTitle:{ color:colors.text, fontSize:20, fontWeight:"900" }
});
