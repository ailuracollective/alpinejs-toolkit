import type { GestureChangeDetail, GestureRecognizedDetail } from "./types";

export interface GestureEvents extends Record<string, unknown[]> {
  change: [GestureChangeDetail];
  gesture: [GestureRecognizedDetail];
  tap: [GestureRecognizedDetail];
  doubletap: [GestureRecognizedDetail];
  longpress: [GestureRecognizedDetail];
  swipe: [GestureRecognizedDetail];
  pan: [GestureRecognizedDetail];
  pinch: [GestureRecognizedDetail];
}
