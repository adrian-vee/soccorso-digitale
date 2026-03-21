import { Platform } from "react-native";

export const Colors = {
  light: {
    text: "#212529",
    textSecondary: "#6C757D",
    buttonText: "#FFFFFF",
    tabIconDefault: "#6C757D",
    tabIconSelected: "#0066CC",
    link: "#0066CC",
    primary: "#0066CC",
    primaryLight: "rgba(0, 102, 204, 0.1)",
    success: "#00A651",
    successLight: "rgba(0, 166, 81, 0.1)",
    error: "#DC3545",
    errorLight: "rgba(220, 53, 69, 0.1)",
    warning: "#FFC107",
    warningLight: "rgba(255, 193, 7, 0.1)",
    backgroundRoot: "#FFFFFF",
    backgroundDefault: "#F8F9FA",
    backgroundSecondary: "#E9ECEF",
    backgroundTertiary: "#DEE2E6",
    border: "#E9ECEF",
    borderFocus: "#0066CC",
    inputBackground: "#FFFFFF",
    cardBackground: "#FFFFFF",
  },
  dark: {
    text: "#ECEDEE",
    textSecondary: "#9BA1A6",
    buttonText: "#FFFFFF",
    tabIconDefault: "#9BA1A6",
    tabIconSelected: "#4DA3FF",
    link: "#4DA3FF",
    primary: "#4DA3FF",
    primaryLight: "rgba(77, 163, 255, 0.15)",
    success: "#00C853",
    successLight: "rgba(0, 200, 83, 0.15)",
    error: "#FF5252",
    errorLight: "rgba(255, 82, 82, 0.15)",
    warning: "#FFD740",
    warningLight: "rgba(255, 215, 64, 0.15)",
    backgroundRoot: "#0a1628",
    backgroundDefault: "#0d1f3c",
    backgroundSecondary: "#122a4a",
    backgroundTertiary: "#183358",
    border: "#1a3a5c",
    borderFocus: "#4DA3FF",
    inputBackground: "#0d1f3c",
    cardBackground: "#0d1f3c",
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 40,
  "4xl": 48,
  "5xl": 56,
  inputHeight: 48,
  buttonHeight: 48,
};

export const BorderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  full: 9999,
};

export const Typography = {
  h1: {
    fontSize: 28,
    fontWeight: "700" as const,
  },
  h2: {
    fontSize: 20,
    fontWeight: "600" as const,
  },
  h3: {
    fontSize: 17,
    fontWeight: "600" as const,
  },
  body: {
    fontSize: 15,
    fontWeight: "400" as const,
  },
  small: {
    fontSize: 13,
    fontWeight: "400" as const,
  },
  label: {
    fontSize: 12,
    fontWeight: "500" as const,
  },
  link: {
    fontSize: 15,
    fontWeight: "400" as const,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
