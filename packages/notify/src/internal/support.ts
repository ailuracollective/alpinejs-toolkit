import { safeWindow } from "@ailura/alpinejs-core/env";
export function isNotifySupported(): boolean {
  const win = safeWindow() as (Window & { Notification?: unknown }) | undefined;
  return !!win && typeof win.Notification !== "undefined";
}

export function getNotifyPermission(): NotificationPermission {
  const win = safeWindow() as
    | (Window & { Notification?: { permission?: NotificationPermission } })
    | undefined;
  if (!win?.Notification) return "default";
  return (win.Notification.permission as NotificationPermission) ?? "default";
}

export function isStandaloneDisplayMode(): boolean {
  const win = safeWindow() as
    | (Window & {
        matchMedia?: (q: string) => MediaQueryList;
        navigator: Navigator & { standalone?: boolean };
      })
    | undefined;
  if (!win) return false;
  if (typeof win.matchMedia === "function" && win.matchMedia("(display-mode: standalone)").matches)
    return true;
  return !!(win.navigator as unknown as { standalone?: boolean }).standalone;
}

export function isIosDevice(): boolean {
  const win = safeWindow() as
    | (Window & { navigator: Navigator & { platform?: string; userAgent: string } })
    | undefined;
  if (!win) return false;
  const ua = win.navigator.userAgent ?? "";
  const platform = (win.navigator as unknown as { platform?: string }).platform ?? "";
  return (
    /iPad|iPhone|iPod/.test(ua) || /iPad/.test(ua) || (/Mac/.test(platform) && "ontouchend" in win)
  );
}

export function requiresServiceWorkerNotifications(): boolean {
  // iOS requires PWA install for notifications via SW
  return isIosDevice() && !isStandaloneDisplayMode();
}

/**
 * Whether showing a notification must go through a service worker instead of
 * the `Notification` constructor.
 *
 * Deliberately broader than {@link requiresServiceWorkerNotifications}: that one
 * answers "is the *permission* obtainable yet", which only covers the
 * not-yet-installed case. iOS refuses the constructor outright — "Illegal
 * constructor. Use ServiceWorkerRegistration.showNotification() instead" — even
 * once the web app *is* installed and the permission *is* granted, so delivery
 * has to route through the service worker in both cases.
 */
export function isServiceWorkerDeliveryRequired(): boolean {
  return isIosDevice();
}
