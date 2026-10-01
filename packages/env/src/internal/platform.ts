import { safeWindow } from "@ailura/alpinejs-core/env";

import type { PlatformState } from "../types";

export function readPlatformState(): PlatformState {
  const win = safeWindow() as (Window & { navigator: Navigator }) | undefined;
  if (!win) {
    return {
      userAgent: "",
      platform: "",
      vendor: "",
      isIos: false,
      isAndroid: false,
      isMobile: false,
      isMac: false,
      isWindows: false,
    };
  }
  const ua = win.navigator.userAgent ?? "";
  const platform = (win.navigator as Navigator & { platform?: string }).platform ?? "";
  const vendor = win.navigator.vendor ?? "";
  const isIos = isIosDevice(ua, platform);
  const isAndroid = /android/i.test(ua);
  const isMobile = isIos || isAndroid || /mobile|iphone|ipad|ipod/i.test(ua);
  const isMac = /mac/i.test(platform) || /mac/i.test(ua);
  const isWindows = /win/i.test(platform);
  return { userAgent: ua, platform, vendor, isIos, isAndroid, isMobile, isMac, isWindows };
}

export function isIosDevice(userAgent: string, platform: string): boolean {
  return (
    /iPad|iPhone|iPod/.test(userAgent) ||
    (platform === "MacIntel" &&
    typeof (globalThis as unknown as { ontouchend?: unknown }).ontouchend !== "undefined"
      ? false
      : /iPad/.test(userAgent)) ||
    (/Mac/.test(platform) && "ontouchend" in (globalThis as unknown as Record<string, unknown>))
  );
}
