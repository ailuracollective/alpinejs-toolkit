import { BaseController } from "@ailura/alpinejs-core/controller";
import { generateId } from "@ailura/alpinejs-core/ids";

import type { GestureEvents } from "./events";
import type {
  GestureKind,
  GestureOptions,
  GesturePhase,
  GestureState,
  GestureDirection,
} from "./types";

/** Every gesture recognized unless `options.gestures` narrows the list. */
const ALL_GESTURES: readonly GestureKind[] = [
  "tap",
  "doubletap",
  "longpress",
  "swipe",
  "pan",
  "pinch",
];

/** Below this spread two pointers are treated as a single point (no scale jump). */
const PINCH_MIN_DISTANCE = 1;

function emptyState(): GestureState {
  return {
    active: false,
    kind: null,
    x: 0,
    y: 0,
    distanceX: 0,
    distanceY: 0,
    totalDistance: 0,
    velocityX: 0,
    velocityY: 0,
    pointerCount: 0,
    scale: 1,
    rotation: 0,
    direction: "none",
    button: 0,
    buttons: 0,
    pointerType: "",
  };
}

/**
 * One of four directions from a displacement.
 *
 * The dominant axis wins, with an exact `>` tie going vertical — a diagonal
 * swipe of 30/30 resolves to `down`. There is no dead zone: any non-zero
 * movement reports a direction, so a 1px drift before a tap is `"left"` or
 * `"up"`, not `"none"`. `"none"` means the pointer has not moved.
 */
function directionFor(dx: number, dy: number): GestureDirection {
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
  if (Math.abs(dy) > 0) return dy > 0 ? "down" : "up";
  return "none";
}

function angleFor(dx: number, dy: number): number {
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

function baseFields(e: PointerEvent, state: GestureState) {
  return {
    x: e.clientX,
    y: e.clientY,
    target: e.target,
    button: e.button as 0,
    buttons: e.buttons,
    pointerType: e.pointerType,
    state,
    originalEvent: e,
  };
}

export class GestureController extends BaseController<GestureEvents> {
  readonly id: string;
  #options: GestureOptions;
  #element: Element | null = null;
  #state: GestureState = emptyState();
  #startX = 0;
  #startY = 0;
  #startTime = 0;
  #lastTap = 0;
  #longPressTimer: ReturnType<typeof setTimeout> | null = null;
  #active = false;
  /** Every pointer currently down on the element, keyed by `pointerId`. */
  #pointers = new Map<number, { x: number; y: number }>();
  /** Pinch baseline: spread and angle of the first two pointers to go down. */
  #pinchDistance = 0;
  #pinchAngle = 0;
  /** True while a pinch is being measured (two or more pointers down). */
  #pinching = false;
  /** True once the interaction has been multi-touch, so the tail is not a tap. */
  #multiTouch = false;
  /** True once `pan` was recognised, so only the first move reports `"start"`. */
  #panning = false;
  /** Set by `handleCancel`, consumed by the `release` it drives. */
  #cancelled = false;

  #onPointerDown: ((e: PointerEvent) => void) | null = null;
  #onPointerMove: ((e: PointerEvent) => void) | null = null;
  #onPointerUp: ((e: PointerEvent) => void) | null = null;
  #onPointerCancel: ((e: PointerEvent) => void) | null = null;

  constructor(options: GestureOptions = {}) {
    super();
    this.id = options.id ?? generateId("gesture");
    this.#options = options;
    this.#element = options.element ?? null;
  }

  get state(): GestureState {
    return this.#state;
  }
  get isTracking(): boolean {
    return this.#active;
  }

  private setState(patch: Partial<GestureState>): void {
    const prev = this.#state;
    this.#state = { ...prev, ...patch };
    this.emit("change", { state: this.#state, previous: prev });
  }

  /**
   * Every recognized gesture goes out on the shared `gesture` channel and, only
   * if something is listening, on its own named channel. The listener-count
   * guard keeps the six per-kind events free for consumers who want them
   * without paying for seven emits per gesture.
   */
  private emitBoth(kind: GestureKind, detail: unknown): void {
    this.emit("gesture", detail as never);
    if (this.events.listenerCount(kind) > 0) this.emit(kind, detail as never);
  }

  private enabled(kind: GestureKind): boolean {
    return (this.#options.gestures ?? ALL_GESTURES).includes(kind);
  }

  private clearLongPress(): void {
    if (!this.#longPressTimer) return;
    clearTimeout(this.#longPressTimer);
    this.#longPressTimer = null;
  }

  mount(): void {
    if (this.lifecycle !== "idle") return;
    super.mount();
    if (this.#element) this.attach(this.#element);
  }

  /**
   * Listen on `element` for the four pointer events a recogniser needs.
   *
   * Attaching detaches from whatever was attached before, so a controller
   * follows exactly one element at a time. That is why the plugin creates one
   * controller per element rather than sharing one across a page.
   */
  attach(element: Element): void {
    this.detach();
    this.#element = element;
    this.#onPointerDown = (e: PointerEvent) => this.handleDown(e);
    this.#onPointerMove = (e: PointerEvent) => this.handleMove(e);
    this.#onPointerUp = (e: PointerEvent) => this.handleUp(e);
    this.#onPointerCancel = (e: PointerEvent) => this.handleCancel(e);
    element.addEventListener("pointerdown", this.#onPointerDown as EventListener);
    element.addEventListener("pointermove", this.#onPointerMove as EventListener);
    element.addEventListener("pointerup", this.#onPointerUp as EventListener);
    element.addEventListener("pointercancel", this.#onPointerCancel as EventListener);
    this.onCleanup(() => this.detach());
  }

  detach(): void {
    if (!this.#element) return;
    const el = this.#element;
    if (this.#onPointerDown)
      el.removeEventListener("pointerdown", this.#onPointerDown as EventListener);
    if (this.#onPointerMove)
      el.removeEventListener("pointermove", this.#onPointerMove as EventListener);
    if (this.#onPointerUp) el.removeEventListener("pointerup", this.#onPointerUp as EventListener);
    if (this.#onPointerCancel)
      el.removeEventListener("pointercancel", this.#onPointerCancel as EventListener);
    this.#element = null;
    this.#onPointerDown = this.#onPointerMove = this.#onPointerUp = null;
    this.#onPointerCancel = null;
  }

  /**
   * Abandon the interaction in progress and return to the idle state.
   *
   * No gesture is emitted — this is the "stop tracking" escape hatch, not a
   * recogniser. The long-press timer is cleared, every pointer is forgotten,
   * and the reported state is reset; `lastTap` is deliberately kept, so a
   * cancel does not break an in-flight double-tap window.
   */
  cancel(): void {
    this.clearLongPress();
    this.#active = false;
    this.#pointers.clear();
    this.#pinching = false;
    this.#multiTouch = false;
    this.#panning = false;
    this.setState({ active: false, kind: null, pointerCount: 0, scale: 1, rotation: 0 });
  }

  /**
   * Keep receiving moves after the pointer leaves the element. Touch pointers
   * get implicit capture from the browser; a mouse drag that wanders off the
   * surface would otherwise stop feeding the recognizer mid-gesture.
   */
  private capture(pointerId: number): void {
    const el = this.#element as (Element & { setPointerCapture?: (id: number) => void }) | null;
    if (typeof el?.setPointerCapture !== "function") return;
    try {
      el.setPointerCapture(pointerId);
    } catch {
      // Capture is a nicety: a browser that refuses it still delivers events.
    }
  }

  /** Current spread/angle of the two leading pointers, relative to the baseline. */
  private pinchMetrics(): { scale: number; rotation: number } {
    const [a, b] = [...this.#pointers.values()];
    const distance = Math.hypot(b.x - a.x, b.y - a.y);
    return {
      scale: this.#pinchDistance < PINCH_MIN_DISTANCE ? 1 : distance / this.#pinchDistance,
      rotation: angleFor(b.x - a.x, b.y - a.y) - this.#pinchAngle,
    };
  }

  private handleDown(e: PointerEvent): void {
    const mouseButtons = this.#options.mouseButtons ?? [0];
    // mouse: check button allowlist; touch/pen always 0 so allow
    if (e.pointerType === "mouse" && !mouseButtons.includes(e.button as 0 | 1 | 2 | 3 | 4)) return;
    this.#cancelled = false;
    this.capture(e.pointerId);

    const first = this.#pointers.size === 0;
    this.#pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (first) {
      this.#active = true;
      this.#multiTouch = false;
      this.#panning = false;
      this.#startX = e.clientX;
      this.#startY = e.clientY;
      this.#startTime = Date.now();
      this.setState({
        active: true,
        kind: null,
        x: e.clientX,
        y: e.clientY,
        distanceX: 0,
        distanceY: 0,
        totalDistance: 0,
        velocityX: 0,
        velocityY: 0,
        pointerCount: this.#pointers.size,
        scale: 1,
        rotation: 0,
        button: e.button as 0,
        buttons: e.buttons,
        pointerType: e.pointerType,
        direction: "none",
      });
    } else {
      this.setState({ pointerCount: this.#pointers.size, x: e.clientX, y: e.clientY });
    }

    if (this.#pointers.size === 2) {
      // A second finger turns the interaction into a pinch: drop the
      // single-pointer long press and take the baseline to measure against.
      this.clearLongPress();
      const [a, b] = [...this.#pointers.values()];
      this.#pinchDistance = Math.hypot(b.x - a.x, b.y - a.y);
      this.#pinchAngle = angleFor(b.x - a.x, b.y - a.y);
      this.#pinching = true;
      this.#multiTouch = true;
      this.#panning = false;
      this.emitPinch(e, "start", { scale: 1, rotation: 0 });
    } else if (first) {
      this.armLongPress(e);
    }
  }

  /**
   * A long press fires on the timer while the finger is still down — it is not
   * released on `pointerup`, so a long press followed by a lift reports
   * `longpress` and then nothing else. Moving past the tap threshold, adding a
   * second finger, or lifting first all cancel it.
   */
  private armLongPress(e: PointerEvent): void {
    if (!this.enabled("longpress")) return;
    const delay = this.#options.longPressDelay ?? 500;
    this.#longPressTimer = setTimeout(() => {
      this.#longPressTimer = null;
      if (!this.#active || this.#multiTouch || this.#state.kind === "longpress") return;
      this.setState({ kind: "longpress" });
      this.emitBoth("longpress", { kind: "longpress", ...baseFields(e, this.#state) } as never);
    }, delay);
  }

  private handleMove(e: PointerEvent): void {
    const tracked = this.#pointers.get(e.pointerId);
    // A pointer the element never saw (hover, or down on an ancestor) is not ours.
    if (!tracked) return;
    tracked.x = e.clientX;
    tracked.y = e.clientY;

    // Two or more pointers is unambiguously a pinch: a single-pointer move
    // after a second finger has been down would jump the scale, so the
    // single-pointer branch is skipped entirely.
    if (this.#pointers.size >= 2) {
      this.emitPinch(e, "move", this.pinchMetrics());
      return;
    }

    const dx = e.clientX - this.#startX;
    const dy = e.clientY - this.#startY;
    const dt = Math.max(1, Date.now() - this.#startTime);
    const vx = dx / dt;
    const vy = dy / dt;
    const threshPan = this.#options.panThreshold ?? 10;
    const total = Math.hypot(dx, dy);
    // Moving past the tap threshold means this is not a press-and-hold, so the
    // pending long press is abandoned. It uses `tapThreshold`, not
    // `panThreshold`: a long press should die as soon as the gesture can no
    // longer be a tap, which is the stricter of the two at their defaults.
    const tapThresh = this.#options.tapThreshold ?? 10;
    if (total > tapThresh) this.clearLongPress();

    const dir = directionFor(dx, dy);
    this.setState({
      x: e.clientX,
      y: e.clientY,
      distanceX: dx,
      distanceY: dy,
      totalDistance: total,
      velocityX: vx,
      velocityY: vy,
      direction: dir,
    });

    if (total > threshPan && !this.#multiTouch && this.enabled("pan")) {
      const phase: GesturePhase = this.#panning ? "move" : "start";
      this.#panning = true;
      this.setState({ kind: "pan" });
      this.emitBoth("pan", {
        kind: "pan",
        ...baseFields(e, this.#state),
        phase,
        distanceX: dx,
        distanceY: dy,
        velocityX: vx,
        velocityY: vy,
        direction: dir,
      } as never);
    }
  }

  private handleUp(e: PointerEvent): void {
    if (!this.#pointers.has(e.pointerId)) return;
    this.#cancelled = false;
    this.release(e);
    if (this.#pointers.size > 0 || this.#cancelled) return;
    this.recognize(e);
  }

  private handleCancel(e: PointerEvent): void {
    if (!this.#pointers.has(e.pointerId)) return;
    this.#cancelled = true;
    this.release(e);
    this.#cancelled = false;
  }

  /** Drops one pointer, emitting the `end` of whatever it was the last part of. */
  private release(e: PointerEvent): void {
    this.clearLongPress();
    // Read the metrics while both pointers are still on the map: the `end`
    // detail has to carry the final scale, not the reset one.
    const finalPinch = this.#pinching ? this.pinchMetrics() : null;
    this.#pointers.delete(e.pointerId);

    if (this.#pinching) {
      if (this.#pointers.size >= 2) {
        this.setState({ pointerCount: this.#pointers.size });
        return;
      }
      this.#pinching = false;
      if (this.enabled("pinch")) this.emitPinch(e, "end", finalPinch ?? { scale: 1, rotation: 0 });
      this.setState({ scale: 1, rotation: 0, pointerCount: this.#pointers.size });
      if (this.#pointers.size > 0) return;
    } else {
      this.setState({ pointerCount: this.#pointers.size });
      if (this.#pointers.size > 0) return;
    }

    // Last pointer of the interaction: the gesture itself is over.
    const wasPan = this.#panning;
    this.#panning = false;
    this.#active = false;
    const discardKind = this.#cancelled || this.#multiTouch;
    this.setState({
      active: false,
      pointerCount: 0,
      scale: 1,
      rotation: 0,
      kind: discardKind ? null : this.#state.kind,
    });
    if (!discardKind && wasPan) {
      const dx = e.clientX - this.#startX;
      const dy = e.clientY - this.#startY;
      this.emitBoth("pan", {
        kind: "pan",
        ...baseFields(e, this.#state),
        phase: "end",
        distanceX: dx,
        distanceY: dy,
        velocityX: 0,
        velocityY: 0,
        direction: directionFor(dx, dy),
      } as never);
    }
    this.#multiTouch = false;
  }

  private emitPinch(
    e: PointerEvent,
    phase: GesturePhase,
    metrics: { scale: number; rotation: number }
  ) {
    if (!this.enabled("pinch")) return;
    const [a, b] = [...this.#pointers.values()];
    this.setState({
      kind: "pinch",
      x: e.clientX,
      y: e.clientY,
      scale: metrics.scale,
      rotation: metrics.rotation,
      pointerCount: this.#pointers.size,
    });
    this.emitBoth("pinch", {
      kind: "pinch",
      ...baseFields(e, this.#state),
      phase,
      scale: metrics.scale,
      rotation: metrics.rotation,
      distanceX: a && b ? b.x - a.x : 0,
      distanceY: a && b ? b.y - a.y : 0,
    } as never);
  }

  /**
   * Single-pointer recognition, once the last pointer of the interaction lifts.
   *
   * A second tap is reported as `doubletap` and *not* as a second `tap` — the
   * two are alternatives on the same press, not a tap that is later upgraded.
   * A handler bound to `.tap` therefore fires once for a double-tap gesture.
   */
  private recognize(e: PointerEvent): void {
    // A pinch ends with a finger still down: that leftover is not a tap or a
    // swipe, and the long press it may have replaced has already been emitted.
    if (this.#multiTouch || this.#state.kind === "longpress") return;

    const dx = e.clientX - this.#startX;
    const dy = e.clientY - this.#startY;
    const dt = Math.max(1, Date.now() - this.#startTime);
    const vx = dx / dt;
    const vy = dy / dt;
    const total = Math.hypot(dx, dy);
    const tapThresh = this.#options.tapThreshold ?? 10;
    const swipeThresh = this.#options.swipeThreshold ?? 50;
    const swipeVel = this.#options.swipeVelocity ?? 0.3;

    if (total <= tapThresh) {
      const now = Date.now();
      const interval = this.#options.doubleTapInterval ?? 300;
      const isDouble = now - this.#lastTap < interval;
      this.#lastTap = now;
      const kind: GestureKind = isDouble ? "doubletap" : "tap";
      if (this.enabled(kind)) {
        this.setState({ kind });
        this.emitBoth(kind, { kind, ...baseFields(e, this.#state) } as never);
      }
      // A pan already reported the drag, so `kind` is only advanced to `swipe`
      // when a gesture travelled far enough and fast enough to qualify.
    } else if (total >= swipeThresh && Math.hypot(vx, vy) >= swipeVel && this.enabled("swipe")) {
      const dir = directionFor(dx, dy);
      this.setState({ kind: "swipe", direction: dir });
      this.emitBoth("swipe", {
        kind: "swipe",
        ...baseFields(e, this.#state),
        direction: dir,
        velocityX: vx,
        velocityY: vy,
      } as never);
    }
  }

  protected teardown(): void {
    this.detach();
    this.clearLongPress();
  }
}

export function createGestureController(options?: GestureOptions): GestureController {
  return new GestureController(options);
}
