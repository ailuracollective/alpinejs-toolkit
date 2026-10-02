import type { Alpine } from "alpinejs";

/** Recognized gesture kind. `wheel` is opt-in and Ctrl-only: see `GestureController.enableGestures`. */
export type GestureKind = "tap" | "doubletap" | "longpress" | "swipe" | "pan" | "pinch" | "wheel";

export type GestureDirection = "up" | "down" | "left" | "right" | "none";
export type GesturePhase = "start" | "move" | "end";
export type GestureMouseButton = 0 | 1 | 2 | 3 | 4;
export type GesturePointerType = "mouse" | "touch" | "pen";
export type GesturePointerTypeName = GesturePointerType | (string & {});

export interface GestureState {
  readonly active: boolean;
  readonly kind: GestureKind | null;
  readonly x: number;
  readonly y: number;
  readonly distanceX: number;
  readonly distanceY: number;
  readonly totalDistance: number;
  readonly velocityX: number;
  readonly velocityY: number;
  readonly pointerCount: number;
  readonly scale: number;
  readonly rotation: number;
  readonly direction: GestureDirection;
  readonly button: GestureMouseButton;
  readonly buttons: number;
  readonly pointerType: GesturePointerTypeName;
  readonly deltaX: number;
  readonly deltaY: number;
}

export interface GestureOptions {
  readonly id?: string;
  readonly element?: Element;
  readonly gestures?: readonly GestureKind[];
  readonly tapThreshold?: number;
  readonly doubleTapInterval?: number;
  readonly longPressDelay?: number;
  readonly swipeThreshold?: number;
  readonly swipeVelocity?: number;
  readonly panThreshold?: number;
  /**
   * `wheel` only: attach the wheel listener non-passive and cancel the
   * browser's own Ctrl+wheel page zoom on every tick, so the surface can zoom
   * instead. Without it the browser zooms the page, because a passive listener
   * cannot cancel anything. No pointer event is ever cancelled. The directive
   * equivalent is the reserved `.prevent` modifier, which is per element.
   */
  readonly preventDefault?: boolean;
  readonly mouseButtons?: readonly GestureMouseButton[];
  readonly wheelScaleFactor?: number;
  readonly wheelIdleDelay?: number;
  readonly storeKey?: string;
  readonly directiveKey?: string;
}

export const DEFAULT_GESTURE_STORE_KEY = "gesture";
export const DEFAULT_GESTURE_DIRECTIVE_KEY = "gesture";

/** Pointer metadata shared by gesture events. */
export interface GesturePointerFields {
  readonly x: number;
  readonly y: number;
  readonly target: EventTarget | null;
  readonly button: GestureMouseButton;
  readonly buttons: number;
  readonly pointerType: GesturePointerTypeName;
}

export type GestureEventBase<K extends GestureKind = GestureKind> = GesturePointerFields & {
  readonly kind: K;
};
export type GestureTapDetail = GestureEventBase<"tap">;
export type GestureDoubleTapDetail = GestureEventBase<"doubletap">;
export type GestureLongPressDetail = GestureEventBase<"longpress">;
export interface GestureSwipeDetail extends GestureEventBase<"swipe"> {
  readonly direction: GestureDirection;
  readonly velocityX: number;
  readonly velocityY: number;
}
export interface GesturePanDetail extends GestureEventBase<"pan"> {
  readonly phase: GesturePhase;
  readonly distanceX: number;
  readonly distanceY: number;
  readonly velocityX: number;
  readonly velocityY: number;
  readonly direction: GestureDirection;
}
export interface GesturePinchDetail extends GestureEventBase<"pinch"> {
  readonly phase: GesturePhase;
  readonly scale: number;
  readonly rotation: number;
  readonly distanceX: number;
  readonly distanceY: number;
}

export interface GestureWheelDetail extends GestureEventBase<"wheel"> {
  readonly phase: GesturePhase;
  readonly deltaX: number;
  readonly deltaY: number;
  readonly deltaZ: number;
  readonly deltaMode: number;
  /**
   * True on every recognized tick — the browser sets it both for an
   * intentional Ctrl+wheel and for a trackpad pinch, which is why the
   * recognizer gates on it. It does not tell the two apart: what separates a
   * pinch is its shape, a burst of small deltas rather than one notch.
   */
  readonly ctrlKey: boolean;
  readonly scale: number;
}

export interface GestureDetailMap {
  readonly tap: GestureTapDetail;
  readonly doubletap: GestureDoubleTapDetail;
  readonly longpress: GestureLongPressDetail;
  readonly swipe: GestureSwipeDetail;
  readonly pan: GesturePanDetail;
  readonly pinch: GesturePinchDetail;
  readonly wheel: GestureWheelDetail;
}

export interface GestureChangeDetail {
  readonly state: GestureState;
  readonly previous: GestureState | null;
}
export type GestureRecognizedDetail = GestureDetailMap[GestureKind] & {
  readonly state: GestureState;
  readonly originalEvent: PointerEvent | WheelEvent | null;
};

export type GestureStore = {
  [K in keyof GestureState]: GestureState[K];
} & { cancel(): void };

export interface GestureManager {
  readonly id: string;
  readonly state: GestureState;
  readonly isTracking: boolean;
  mount(): void;
  destroy(): void;
  cancel(): void;
  attach(element: Element): void;
  detach(): void;
}

export type GestureAlpine = Alpine;
export type GesturePluginCallback = (alpine: Alpine) => void;
