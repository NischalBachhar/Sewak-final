import React from "react";
import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, Platform, StyleSheet, View } from "react-native";
import { SymbolView } from "expo-symbols";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/auth/AuthProvider";
import { colors } from "@/theme";

type TabIconProps = {
  ios: any;
  android: any;
  active: boolean;
};

function TabIcon({ ios, android, active }: TabIconProps) {
  return (
    <SymbolView
      name={{ ios, android, web: android }}
      size={21}
      tintColor={active ? colors.accentStrong : colors.muted}
    />
  );
}

export default function TabsLayout() {
  const { user, role, loading } = useAuth();
  const insets = useSafeAreaInsets();

  if (loading) {
    return <View style={styles.loading}><ActivityIndicator color={colors.accent} /></View>;
  }
  if (!user) return <Redirect href="/sign-in" />;

  const customer = role === "user";
  const caregiver = role === "caregiver";
  const organization = role === "orgadmin";
  const bottomInset = Math.max(insets.bottom, 8);

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleAlign: "center",
        headerTitleStyle: { fontWeight: "800", fontSize: 17 },
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.accentStrong,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700", marginTop: 2 },
        tabBarItemStyle: { paddingTop: 5 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.borderMuted,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 52 + bottomInset,
          paddingBottom: bottomInset,
          paddingTop: 2,
        },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="home" options={{ title: "Home", tabBarIcon: ({ focused }) => <TabIcon ios="house.fill" android="home" active={focused} /> }} />
      <Tabs.Screen
        name="caregivers"
        options={{ title: "Caregivers", href: customer ? undefined : null, tabBarIcon: ({ focused }) => <TabIcon ios="heart.fill" android="favorite" active={focused} /> }}
      />
      <Tabs.Screen
        name="bookings"
        options={{ title: "Bookings", href: customer ? undefined : null, tabBarIcon: ({ focused }) => <TabIcon ios="calendar" android="calendar_month" active={focused} /> }}
      />
      <Tabs.Screen
        name="jobs"
        options={{ title: "Jobs", href: caregiver ? undefined : null, tabBarIcon: ({ focused }) => <TabIcon ios="briefcase.fill" android="work" active={focused} /> }}
      />
      <Tabs.Screen
        name="earnings"
        options={{ title: "Earnings", href: caregiver ? undefined : null, tabBarIcon: ({ focused }) => <TabIcon ios="banknote.fill" android="payments" active={focused} /> }}
      />
      <Tabs.Screen
        name="organization"
        options={{ title: "Manage", href: organization ? undefined : null, tabBarIcon: ({ focused }) => <TabIcon ios="building.2.fill" android="apartment" active={focused} /> }}
      />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ focused }) => <TabIcon ios="person.crop.circle.fill" android="account_circle" active={focused} /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
});
