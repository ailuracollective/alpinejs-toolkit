import { safeWindow } from "@ailura/alpinejs-core/env";

import type { NetworkState } from "../types";

export function readNetworkState(): NetworkState {
  const win = safeWindow() as
    | (Window & { navigator: Navigator & { connection?: NetworkInformationLike } })
    | undefined;
  if (!win) return { online: true };
  const online = typeof win.navigator.onLine === "boolean" ? win.navigator.onLine : true;
  const conn = (win.navigator as unknown as { connection?: NetworkInformationLike }).connection;
  if (!conn) return { online };
  return {
    online,
    effectiveType: conn.effectiveType,
    saveData: conn.saveData,
    downlink: conn.downlink,
    rtt: conn.rtt,
  };
}

interface NetworkInformationLike {
  effectiveType?: string;
  saveData?: boolean;
  downlink?: number;
  rtt?: number;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
}

export type { NetworkInformationLike };
