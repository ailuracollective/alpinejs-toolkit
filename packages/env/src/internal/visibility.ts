import { safeDocument } from "@ailura/alpinejs-core/env";

import type { VisibilityState } from "../types";

export function readVisibilityState(): VisibilityState {
  const doc = safeDocument();
  if (!doc) return { visible: true, hidden: false, state: "visible" as DocumentVisibilityState };
  const state = doc.visibilityState ?? ("visible" as DocumentVisibilityState);
  return {
    visible: state === "visible",
    hidden: doc.hidden ?? state === "hidden",
    state,
  };
}
