import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/auth/AuthProvider";
import { colors } from "@/theme";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: "800" },
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="browse" options={{ title: "Find caregivers" }} />
          <Stack.Screen name="sign-in" options={{ title: "Sign in" }} />
          <Stack.Screen name="register" options={{ title: "Create account" }} />
          <Stack.Screen name="activate" options={{ title: "Activate account" }} />
          <Stack.Screen name="caregiver/[id]" options={{ title: "Caregiver profile" }} />
          <Stack.Screen name="booking/[caregiverId]" options={{ title: "Request care" }} />
          <Stack.Screen name="booking-detail/[id]" options={{ title: "Booking details" }} />
          <Stack.Screen name="job/[id]" options={{ title: "Job details" }} />
          <Stack.Screen name="security" options={{ title: "Account security" }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
