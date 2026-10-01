import type {
  ScrollChangeDetail,
  ScrollLockChangeDetail,
  ScrollNavigationDetail,
  ScrollPositionDetail,
  ScrollReachDetail,
  ScrollSectionChangeDetail,
} from "./types";

export interface ScrollEvents extends Record<string, unknown[]> {
  change: [detail: ScrollChangeDetail];
  lock: [detail: ScrollLockChangeDetail];
  section: [detail: ScrollSectionChangeDetail];
  scroll: [detail: ScrollPositionDetail];
  reach: [detail: ScrollReachDetail];
  navigation: [detail: ScrollNavigationDetail];
}
