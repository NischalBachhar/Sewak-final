import React from "react";
import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/auth/AuthProvider";
import { colors } from "@/theme";

const Icon = ({ label, active }: { label: string; active: boolean }) => (
  <Text style={{ fontSize: 18, opacity: active ? 1 : 0.55 }}>{label}</Text>
);

export default function TabsLayout() {
  const { user, role, loading } = useAuth();

  if (loading) {
    return <View style={styles.loading}><ActivityIndicator color={colors.accent} /></View>;
  }
  if (!user) return <Redirect href="/sign-in" />;

  const customer = role === "user";
  const caregiver = role === "caregiver";
  const organization = role === "orgadmin";

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: "800" },
        tabBarActiveTintColor: colors.accentStrong,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.borderMuted },
      }}
    >
      <Tabs.Screen name="home" options={{ title: "Home", tabBarIcon: ({ focused }) => <Icon label="⌂" active={focused} /> }} />
      <Tabs.Screen
        name="caregivers"
        options={{ title: "Caregivers", href: customer ? undefined : null, tabBarIcon: ({ focused }) => <Icon label="♡" active={focused} /> }}
      />
      <Tabs.Screen
        name="bookings"
        options={{ title: "Bookings", href: customer ? undefined : null, tabBarIcon: ({ focused }) => <Icon label="▣" active={focused} /> }}
      />
      <Tabs.Screen
        name="jobs"
        options={{ title: "Jobs", href: caregiver ? undefined : null, tabBarIcon: ({ focused }) => <Icon label="▤" active={focused} /> }}
      />
      <Tabs.Screen
        name="earnings"
        options={{ title: "Earnings", href: caregiver ? undefined : null, tabBarIcon: ({ focused }) => <Icon label="₨" active={focused} /> }}
      />
      <Tabs.Screen
        name="organization"
        options={{ title: "Manage", href: organization ? undefined : null, tabBarIcon: ({ focused }) => <Icon label="▦" active={focused} /> }}
      />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ focused }) => <Icon label="◉" active={focused} /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
});
