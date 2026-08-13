import { useEffect } from "react";
import { theme } from "./theme";

const setThemeVariables = () => {
  const root = document.documentElement;
  if (!root) return;

  const alias = {
    "--page-bg": `radial-gradient(circle at top, ${theme.colors.background} 0%, ${theme.colors.backgroundAccent} 45%, ${theme.colors.background} 100%)`,
    "--card-bg": theme.colors.surface,
    "--card-border": theme.colors.border,
    "--text": theme.colors.text,
    "--muted": theme.colors.textSecondary,
    "--accent": theme.colors.accent,
    "--accent-soft": theme.colors.accentSoft,
    "--surface": theme.colors.surfaceAlt,
    "--surface-2": theme.colors.surfaceSoft,
    "--button-bg": theme.colors.button,
    "--button-border": theme.colors.buttonBorder,
  };

  Object.entries(theme.colors).forEach(([key, value]) => {
    // The design tokens in theme.js intentionally point at the authored CSS
    // variables in App.css. Writing a variable back onto itself (for example,
    // --theme-help: var(--theme-help)) creates a circular custom-property
    // reference, leaving browsers with no usable computed color.
    if (typeof value === "string" && /^var\(--theme-[\w-]+\)$/.test(value)) {
      return;
    }

    root.style.setProperty(`--theme-${key}`, value);
  });
  Object.entries(alias).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
  Object.entries(theme.gradients).forEach(([key, value]) => {
    root.style.setProperty(`--theme-gradient-${key}`, value);
  });
  root.style.setProperty("--theme-shadow", theme.shadow);
  root.style.setProperty("--theme-radius", theme.radius);
};

export default function ThemeProvider() {
  useEffect(() => {
    setThemeVariables();
  }, []);

  return null;
}
