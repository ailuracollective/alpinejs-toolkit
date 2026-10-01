import { safeMatchMedia, safeWindow } from "@ailura/alpinejs-core/env";
export function readMediaSnapshotBase(): {
  width: number;
  height: number;
  prefersReducedMotion: boolean;
  isDark: boolean;
} {
  const win = safeWindow();
  if (!win) return { width: 1024, height: 768, prefersReducedMotion: false, isDark: false };
  const width = win.innerWidth ?? 1024;
  const height = win.innerHeight ?? 768;
  const prefersReducedMotion = safeMatchMedia("(prefers-reduced-motion: reduce)")?.matches ?? false;
  const isDark = safeMatchMedia("(prefers-color-scheme: dark)")?.matches ?? false;
  return { width, height, prefersReducedMotion, isDark };
}
