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

/** The pointer events a recognizer needs, and the handler each one drives. */
const POINTER_EVENTS = [
  ["pointerdown", "handleDown"],
  ["pointermove", "handleMove"],
  ["pointerup", "handleUp"],
  ["pointercancel", "handleCancel"],
] as const;

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

/** Pixels per `WheelEvent` line, for the `deltaMode === 1` case. */
const WHEEL_LINE_HEIGHT = 16;
/** Pixels per `WheelEvent` page, for the `deltaMode === 2` case. */
const WHEEL_PAGE_HEIGHT = 100;
/**
 * Floor for the accumulated wheel scale.
 *
 * `exp()` never returns `0`, but a long session of hard scrolling drives the
 * exponent down far enough for the scale to stop being a usable transform.
 * Clamping keeps a runaway session inside a range a consumer can render.
 */
const WHEEL_MIN_SCALE = 0.001;

/**
 * The idle state every controller starts from, with an optional patch on top.
 *
 * The store mirror in `plugin.ts` reads its key list from this one literal, so
 * a new state key only has to be added here to be mirrored as well. A caller
 * that wants to start from idle and override a few fields says so with
 * `patch`, rather than spreading the result and restating the keys.
 */
export function emptyState(patch?: Partial<GestureState>): GestureState {
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
    deltaX: 0,
    deltaY: 0,
    ...patch,
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

/**
 * The fields every gesture detail carries, whatever the input device.
 *
 * A `WheelEvent` is not a `PointerEvent`: it has no `pointerType` and no id,
 * and no button is held while one is delivered. So the wheel reports
 * `pointerType: "mouse"` with `button` and `buttons` at `0`, which is what
 * keeps a consumer that switches on `pointerType` working unchanged.
 */
function baseFields(e: PointerEvent | WheelEvent, state: GestureState) {
  const isPointer = "pointerType" in e;
  return {
    x: e.clientX,
    y: e.clientY,
    target: e.target,
    button: (isPointer ? e.button : 0) as 0,
    buttons: isPointer ? e.buttons : 0,
    pointerType: isPointer ? e.pointerType : "mouse",
    state,
    originalEvent: e,
  };
}

/**
 * Pixels per unit for a wheel `deltaMode`.
 *
 * A mouse wheel reports pixels, a legacy line-based device reports lines and a
 * page-based one reports pages; comparing them raw would make the zoom speed
 * depend on the hardware. An unknown mode falls back to pixels (x1), which is
 * what every current browser sends.
 */
function wheelUnit(mode: number): number {
  if (mode === 1) return WHEEL_LINE_HEIGHT;
  if (mode === 2) return WHEEL_PAGE_HEIGHT;
  return 1;
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
  /** Kinds turned on at runtime through `enableGestures`, unioned over the options. */
  #extraKinds = new Set<GestureKind>();
  /** Σ`deltaY` of the running wheel session; the scale is derived from it. */
  #wheelAccumulator = 0;
  #wheelTimer: ReturnType<typeof setTimeout> | null = null;
  #onWheel: ((e: WheelEvent) => void) | null = null;

  /** The live `pointer*` listeners, so `detach()` removes exactly what `attach()` added. */
  #listeners = new Map<string, EventListener>();

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
    return this.#state.active;
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
    return (this.#options.gestures ?? ALL_GESTURES).includes(kind) || this.#extraKinds.has(kind);
  }

  /**
   * Turn more gesture kinds on for an already-attached controller.
   *
   * The set is a union, never a replacement: the directive calls this with the
   * modifier it was written with, and narrowing `options.gestures` for the
   * programmatic path must keep working. Idempotent, so a second
   * `x-gesture.*` on the same element re-attaching nothing is harmless.
   */
  enableGestures(kinds: Iterable<GestureKind>): void {
    for (const kind of kinds) {
      if (this.enabled(kind)) continue;
      this.#extraKinds.add(kind);
      // Only the wheel listener is per-kind, so only it needs the late attach;
      // every other kind was already listening from `attach()`. `attachWheel()`
      // is idempotent, so it does not need deferring to the end of the loop.
      if (kind === "wheel" && this.#element) this.attachWheel();
    }
  }

  private clearWheel(): void {
    if (!this.#wheelTimer) return;
    clearTimeout(this.#wheelTimer);
    this.#wheelTimer = null;
  }

  /**
   * Attach the opt-in wheel listener.
   *
   * Non-passive only when `options.preventDefault` is set: a passive listener
   * is required by the browser for `wheel` on the document and cannot cancel
   * the scroll, so making it cancellable has to be declared up front.
   */
  private attachWheel(): void {
    if (!this.#element || this.#onWheel) return;
    this.#onWheel = (e: WheelEvent) => this.handleWheel(e);
    // Only `capture` is passed on removal: the spec matches a listener by type,
    // callback and capture alone, and the options object is a different
    // identity every call.
    this.#element.addEventListener("wheel", this.#onWheel as EventListener, {
      passive: !this.#options.preventDefault,
    });
  }

  private detachWheel(): void {
    if (!this.#element || !this.#onWheel) return;
    this.#element.removeEventListener("wheel", this.#onWheel as EventListener);
    this.#onWheel = null;
    this.clearWheel();
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
    for (const [type, handler] of POINTER_EVENTS) {
      const listener = ((e: PointerEvent) => this[handler](e)) as EventListener;
      this.#listeners.set(type, listener);
      element.addEventListener(type, listener);
    }
    if (this.enabled("wheel")) this.attachWheel();
    this.onCleanup(() => this.detach());
  }

  detach(): void {
    const el = this.#element;
    if (el) {
      for (const [type, listener] of this.#listeners) {
        el.removeEventListener(type, listener);
      }
    }
    this.detachWheel();
    this.#element = null;
    this.#listeners.clear();
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
    // The wheel session is a session like any other: cancelling mid-scroll
    // drops the accumulated zoom back to 1 so the surface does not stay
    // zoomed in from a gesture nobody finished.
    this.clearWheel();
    this.#wheelAccumulator = 0;
    this.#pointers.clear();
    this.#pinching = false;
    this.#multiTouch = false;
    this.#panning = false;
    this.setState({
      active: false,
      kind: null,
      pointerCount: 0,
      scale: 1,
      rotation: 0,
      deltaX: 0,
      deltaY: 0,
    });
  }

  /**
   * Keep receiving moves after the pointer leaves the element. Touch pointers
   * get implicit capture from the browser; a mouse drag that wanders off the
   * surface would otherwise stop feeding the recognizer mid-gesture.
   */
  private capture(pointerId: number): void {
    try {
      // Capture is a nicety: an environment without it, or a browser that
      // refuses the id, still delivers the events.
      this.#element?.setPointerCapture?.(pointerId);
    } catch {}
  }

  /**
   * The displacement between the two leading pointers, as `[dx, dy]`.
   *
   * A zero displacement when fewer than two pointers are down, so a caller
   * never has to re-ask whether the pair it wants exists.
   */
  private pointerDelta(): [number, number] {
    const [a, b] = [...this.#pointers.values()];
    return b ? [b.x - a.x, b.y - a.y] : [0, 0];
  }

  /** Current spread/angle of the two leading pointers, relative to the baseline. */
  private pinchMetrics(): { scale: number; rotation: number } {
    const [dx, dy] = this.pointerDelta();
    const distance = Math.hypot(dx, dy);
    return {
      scale: this.#pinchDistance < PINCH_MIN_DISTANCE ? 1 : distance / this.#pinchDistance,
      rotation: angleFor(dx, dy) - this.#pinchAngle,
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
      this.#multiTouch = false;
      this.#panning = false;
      this.#startX = e.clientX;
      this.#startY = e.clientY;
      this.#startTime = Date.now();
      this.setState(
        // The idle state, with the pose of the pointer that just went down on
        // top of it: everything the interaction is not carrying yet is reset.
        emptyState({
          active: true,
          x: e.clientX,
          y: e.clientY,
          pointerCount: this.#pointers.size,
          button: e.button as 0,
          buttons: e.buttons,
          pointerType: e.pointerType,
        })
      );
    } else {
      this.setState({ pointerCount: this.#pointers.size, x: e.clientX, y: e.clientY });
    }

    if (this.#pointers.size === 2) {
      // A second finger turns the interaction into a pinch: drop the
      // single-pointer long press and take the baseline to measure against.
      this.clearLongPress();
      const [dx, dy] = this.pointerDelta();
      this.#pinchDistance = Math.hypot(dx, dy);
      this.#pinchAngle = angleFor(dx, dy);
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
    this.#longPressTimer = setTimeout(() => {
      this.#longPressTimer = null;
      if (!this.#state.active || this.#multiTouch || this.#state.kind === "longpress") return;
      this.setState({ kind: "longpress" });
      this.emitBoth("longpress", { kind: "longpress", ...baseFields(e, this.#state) } as never);
    }, this.#options.longPressDelay ?? 500);
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

    if (total > (this.#options.panThreshold ?? 10) && !this.#multiTouch && this.enabled("pan")) {
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
    // `#cancelled` is false here and `release()` never sets it, so the only
    // thing that can stop recognition is another pointer still being down. A
    // cancellation arrives on `pointercancel`, which never gets this far.
    if (this.#pointers.size > 0) return;
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
    const [dx, dy] = this.pointerDelta();
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
      distanceX: dx,
      distanceY: dy,
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

    if (total <= (this.#options.tapThreshold ?? 10)) {
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
    } else if (
      total >= (this.#options.swipeThreshold ?? 50) &&
      Math.hypot(vx, vy) >= (this.#options.swipeVelocity ?? 0.3) &&
      this.enabled("swipe")
    ) {
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

  /**
   * One wheel tick: normalize, accumulate, report, and (re)arm the idle timer.
   */
  private handleWheel(e: WheelEvent): void {
    // A wheel turn while a finger or the mouse button is down belongs to the
    // interaction already running. Feeding it in would corrupt the pinch
    // baseline and, worse, jump the reported `scale` out from under a drag.
    if (!this.enabled("wheel") || this.#pointers.size > 0) return;

    const unit = wheelUnit(e.deltaMode);
    const deltaX = e.deltaX * unit;
    const deltaY = e.deltaY * unit;
    // The tilt axis rides the detail only: nothing in the recognizer computes
    // from it, so it does not belong in the continuously-mirrored state.
    const deltaZ = e.deltaZ * unit;

    // Cancelled before the emit so a consumer that throws cannot leave the
    // page scrolling: once we are going to zoom, the scroll must not happen.
    if (this.#options.preventDefault) e.preventDefault();

    // Only Y drives the scale. Wheel down (deltaY > 0) zooms out, which is
    // why the exponent is negated; X is a scroll, not a zoom, and Z is
    // ignored because nothing on a trackpad reports it.
    this.#wheelAccumulator += deltaY;
    const scale = Math.max(
      Math.exp(-this.#wheelAccumulator * (this.#options.wheelScaleFactor ?? 0.002)),
      WHEEL_MIN_SCALE
    );

    this.setState({
      active: true,
      kind: "wheel",
      x: e.clientX,
      y: e.clientY,
      button: 0,
      buttons: 0,
      // A wheel has no pointer id and no button state; reporting the mouse
      // keeps a consumer that switches on `pointerType` working unchanged.
      pointerType: "mouse",
      scale,
      deltaX,
      deltaY,
    });
    this.emitBoth("wheel", {
      kind: "wheel",
      ...baseFields(e, this.#state),
      phase: "move",
      deltaX,
      deltaY,
      deltaZ,
      deltaMode: e.deltaMode,
      ctrlKey: e.ctrlKey,
      scale,
    } as never);

    this.clearWheel();
    // Every tick restarts the clock: a session is the burst of ticks, and
    // idling out is what closes it.
    this.#wheelTimer = setTimeout(
      () => this.endWheelSession(),
      this.#options.wheelIdleDelay ?? 160
    );
  }

  /**
   * Close the wheel session after `wheelIdleDelay` of silence.
   *
   * No event is emitted: the end of a wheel is an absence of input, not a
   * gesture, and a `wheel` detail carrying a reset scale would be a second
   * meaning for the same event. Consumers read the state instead.
   */
  private endWheelSession(): void {
    this.#wheelTimer = null;
    this.#wheelAccumulator = 0;
    // `active` stays true for the whole session so the store mirror keeps
    // streaming the cursor position, which is the anchor point of the zoom.
    this.setState({ active: false, kind: null, scale: 1, deltaX: 0, deltaY: 0 });
  }

  protected teardown(): void {
    this.detach();
    this.clearLongPress();
    this.clearWheel();
  }
}

export function createGestureController(options?: GestureOptions): GestureController {
  return new GestureController(options);
}
