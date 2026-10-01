import type { ResolvedTheme, ThemePreference } from "../types";

export const isThemePreference = (value: unknown): value is ThemePreference =>
  value === "light" || value === "dark" || value === "system";

export const coerceThemePreference = (
  value: unknown,
  fallback: ThemePreference
): ThemePreference =>
  value === "light" || value === "dark" || value === "system"
    ? (value as ThemePreference)
    : fallback;

export const defaultThemePreference = (): ThemePreference => "system";

export const resolveTheme = (current: ThemePreference, system: ResolvedTheme): ResolvedTheme =>
  current === "system" ? system : (current as ResolvedTheme);

export const toThemeEvent = (value: ThemePreference): "SET_LIGHT" | "SET_DARK" | "SET_SYSTEM" =>
  value === "light" ? "SET_LIGHT" : value === "dark" ? "SET_DARK" : "SET_SYSTEM";
