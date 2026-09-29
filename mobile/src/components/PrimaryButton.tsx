import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
} from "react-native";
import { colors, radius } from "@/theme";

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary";
  style?: ViewStyle;
};

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  variant = "primary",
  style,
}: Props) {
  const secondary = variant === "secondary";
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        secondary ? styles.secondary : styles.primary,
        pressed && styles.pressed,
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={secondary ? colors.accent : "#FFFFFF"} />
      ) : (
        <Text style={[styles.label, secondary && styles.secondaryLabel]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    borderWidth: 1,
  },
  primary: {
    backgroundColor: colors.accentStrong,
    borderColor: colors.accentStrong,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  label: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  secondaryLabel: { color: colors.accent, fontWeight: "800" },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.5 },
});
