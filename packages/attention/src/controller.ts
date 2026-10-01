import { BaseController } from "@ailura/alpinejs-core/controller";
import { safeWindow } from "@ailura/alpinejs-core/env";
import { generateId } from "@ailura/alpinejs-core/ids";

import type { AttentionEvents, IdleChangeDetail, WakeLockChangeDetail } from "./events";
import { DEFAULT_IDLE_THRESHOLD, MIN_IDLE_THRESHOLD } from "./types";
import type {
  AttentionControllerOptions,
  IdleDetectorLike,
  IdleScreenState,
  IdleUserState,
} from "./types";

/**
 * Capability probes, not permission checks.
 *
 * Both return `false` on the server, so a page can render the unsupported state
 * in SSR markup instead of only discovering it after hydration.
 */
export function isWakeLockSupported(): boolean {
  const win = safeWindow() as unknown as { navigator?: { wakeLock?: unknown } } | undefined;
  return Boolean(win?.navigator && "wakeLock" in win.navigator);
}

export function isIdleDetectionSupported(): boolean {
  const win = safeWindow() as unknown as { IdleDetector?: unknown } | undefined;
  return typeof win?.IdleDetector !== "undefined";
}

/**
 * Clamp a caller-supplied threshold to something the Idle Detection API will
 * accept. The browser's own minimum is 60 s and it throws below that, so a
 * `threshold: 5_000` from a caller becomes 60 s rather than an exception —
 * sub-minute idle detection is not a thing the API offers, and pretending
 * otherwise would be a lie the page only discovers at `start()`.
 */
export function normalizeIdleThreshold(threshold: number): number {
  if (!Number.isFinite(threshold) || threshold < MIN_IDLE_THRESHOLD) return MIN_IDLE_THRESHOLD;
  return Math.floor(threshold);
}

export class WakeLockController extends BaseController<AttentionEvents> {
  readonly id: string;
  #sentinel: { release(): Promise<void>; released: boolean } | null = null;
  #error: string | null = null;
  #requesting = false;

  constructor(id?: string) {
    super();
    this.id = id ?? generateId("wakelock");
  }

  get isSupported(): boolean {
    return isWakeLockSupported();
  }

  /**
   * Reads `sentinel.released` rather than the reference alone, because the OS
   * revokes a wake lock on its own when the page is hidden and the sentinel
   * stays non-null. Note the consequence: revocation is *detected* on the next
   * read, not *reported* — no `release` listener is attached, so `error` stays
   * `null` and a re-render is the only way to notice.
   */
  get isActive(): boolean {
    return this.#sentinel !== null && !this.#sentinel.released;
  }

  get isRequesting(): boolean {
    return this.#requesting;
  }

  get error(): string | null {
    return this.#error;
  }

  /**
   * Dismiss (or set) the surfaced error. `error` is the only writable member
   * of the `$wakelock` surface: it is an input — dismissing an error is a real
   * operation. Every other exposed field is reported state with no setter.
   */
  setError(error: string | null): void {
    if (this.lifecycle === "destroyed") return;
    this.#error = error;
    this.#emit();
  }

  /**
   * Acquire a screen wake lock. Resolves `true` only when the sentinel is held.
   *
   * Must be called from a user gesture: the browser rejects a request outside
   * one, and the rejection's message is surfaced verbatim in `error`. An
   * unsupported browser is a `false` return with `error` set, never a throw.
   */
  async request(): Promise<boolean> {
    if (this.lifecycle === "destroyed") return false;
    if (!this.isSupported) {
      this.#error = "Wake Lock not supported";
      this.#emit();
      return false;
    }
    const win = safeWindow() as unknown as
      | { navigator: { wakeLock: { request(t: string): Promise<IdleDetectorLike> } } }
      | undefined;
    if (!win) return false;
    this.#requesting = true;
    this.#emit();
    try {
      const wl = win.navigator.wakeLock as unknown as { request(t: string): Promise<unknown> };
      const raw = await wl.request("screen");
      const sentinel = raw as unknown as never;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.#sentinel = sentinel as any;
      this.#error = null;
      this.#requesting = false;
      this.#emit();
      return true;
    } catch (err) {
      this.#error = err instanceof Error ? err.message : String(err);
      this.#requesting = false;
      this.#emit();
      return false;
    }
  }

  /**
   * Release the held sentinel. `false` when nothing is held — including when
   * the OS already revoked it, because the reference is still there.
   */
  async release(): Promise<boolean> {
    if (!this.#sentinel) return false;
    try {
      await this.#sentinel.release();
      this.#sentinel = null;
      this.#error = null;
      this.#emit();
      return true;
    } catch (err) {
      this.#error = err instanceof Error ? err.message : String(err);
      this.#emit();
      return false;
    }
  }

  protected override teardown(): void {
    // Fire-and-forget: the controller is already destroyed, so there is nobody
    // left to report a release failure to, and throwing here would escape
    // `destroy()` into the caller's teardown.
    if (this.#sentinel) {
      void this.#sentinel.release().catch(() => {});
      this.#sentinel = null;
    }
  }

  #emit(): void {
    const detail: WakeLockChangeDetail = {
      isActive: this.isActive,
      isRequesting: this.#requesting,
      error: this.#error,
    };
    this.emit("wakelock:change", detail);
  }
}

export function createWakeLockController(
  options: AttentionControllerOptions = {}
): WakeLockController {
  const c = new WakeLockController(options.id);
  c.mount();
  return c;
}

export class IdleController extends BaseController<AttentionEvents> {
  readonly id: string;
  #userState: IdleUserState | null = null;
  #screenState: IdleScreenState | null = null;
  #permission: PermissionState | null = null;
  #error: string | null = null;
  #threshold: number = DEFAULT_IDLE_THRESHOLD;
  #watching = false;
  #loading = false;
  #timer: ReturnType<typeof setTimeout> | null = null;

  constructor(id?: string) {
    super();
    this.id = id ?? generateId("idle");
  }

  get isSupported(): boolean {
    return isIdleDetectionSupported();
  }

  get isActive(): boolean {
    return this.#watching;
  }

  get isIdle(): boolean {
    return this.#userState === "idle";
  }

  get isWatching(): boolean {
    return this.#watching;
  }

  get isLoading(): boolean {
    return this.#loading;
  }

  get userState(): IdleUserState | null {
    return this.#userState;
  }

  get screenState(): IdleScreenState | null {
    return this.#screenState;
  }

  get permission(): PermissionState | null {
    return this.#permission;
  }

  get error(): string | null {
    return this.#error;
  }

  get threshold(): number {
    return this.#threshold;
  }

  /**
   * Dismiss (or set) the surfaced error. `error` is the only writable member
   * of the `$idle` surface: it is an input — dismissing an error is a real
   * operation. Every other exposed field is reported state with no setter.
   */
  setError(error: string | null): void {
    if (this.lifecycle === "destroyed") return;
    this.#error = error;
    this.#emit();
  }

  /**
   * Ask for idle-detection permission.
   *
   * **Where the API does not exist, this reports `"granted"`.** That is
   * deliberate and it is the single most surprising thing in this package: the
   * permission prompt is the API's own, so with no API there is nothing to
   * grant and nothing to deny, and reporting `"denied"` would leave a caller
   * permanently unable to start a watch in exactly the browsers where a
   * fallback is most useful. Check `isSupported` first — `permission` alone
   * will not tell you whether a real prompt was ever shown.
   */
  async requestPermission(): Promise<PermissionState> {
    const win = safeWindow() as unknown as
      | { IdleDetector?: { requestPermission(): Promise<PermissionState> } }
      | undefined;
    if (win?.IdleDetector && typeof win.IdleDetector.requestPermission === "function") {
      try {
        const p = await win.IdleDetector.requestPermission();
        this.#permission = p;
        this.#emit();
        return p;
      } catch {
        this.#permission = "denied" as PermissionState;
        this.#emit();
        return this.#permission;
      }
    }
    this.#permission = "granted" as PermissionState;
    this.#emit();
    return this.#permission;
  }

  /**
   * Begin watching. `true` means "watching", not "the Idle Detection API is in
   * use" — read `isSupported` to tell those apart.
   *
   * The fallback is a **one-shot timer, not idle detection.** Where the API is
   * missing it sets `userState: 'active'` and flips to `'idle'` after
   * `threshold` milliseconds, once, with no way back. It cannot see input, so
   * it will call a user idle who never left. It exists so a page degrades to
   * "pause something eventually" rather than to nothing, and it should not be
   * relied on for anything that costs money.
   */
  async start(options?: { threshold?: number }): Promise<boolean> {
    if (this.lifecycle === "destroyed") return false;
    if (options?.threshold !== undefined) {
      this.#threshold = normalizeIdleThreshold(options.threshold);
    }
    const win = safeWindow() as unknown as
      | { IdleDetector?: new () => IdleDetectorLike }
      | undefined;
    if (win?.IdleDetector) {
      try {
        this.#loading = true;
        this.#emit();
        const detector = new (win.IdleDetector as unknown as new () => IdleDetectorLike)();
        await detector.start({ threshold: this.#threshold });
        this.#userState = detector.userState;
        this.#screenState = detector.screenState;
        this.#watching = true;
        this.#loading = false;
        this.#error = null;
        this.#emit();
        return true;
      } catch (err) {
        this.#error = err instanceof Error ? err.message : String(err);
        this.#loading = false;
        this.#emit();
        return false;
      }
    }
    this.#watching = true;
    this.#userState = "active";
    // The fallback always reports an unlocked screen: there is no signal to
    // say otherwise, and a wrong `"locked"` would make a consumer think the
    // device is secure.
    this.#screenState = "unlocked";
    this.#error = null;
    this.#emit();
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {
      if (this.lifecycle === "destroyed" || !this.#watching) return;
      this.#userState = "idle";
      this.#emit();
    }, this.#threshold);
    this.onCleanup(() => {
      if (this.#timer) clearTimeout(this.#timer);
    });
    return true;
  }

  stop(): boolean {
    if (!this.#watching) return false;
    this.#watching = false;
    this.#userState = null;
    this.#screenState = null;
    if (this.#timer) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
    this.#emit();
    return true;
  }

  protected override teardown(): void {
    this.stop();
  }

  #emit(): void {
    // One detail for every state change, so a consumer subscribing once sees
    // `threshold` and `permission` as well as the user/screen states.
    const detail: IdleChangeDetail = {
      userState: this.#userState,
      screenState: this.#screenState,
      permission: this.#permission,
      error: this.#error,
      threshold: this.#threshold,
      isWatching: this.#watching,
    };
    this.emit("idle:change", detail);
  }
}

export function createIdleController(options: AttentionControllerOptions = {}): IdleController {
  const c = new IdleController(options.id);
  c.mount();
  return c;
}

/**
 * Both sub-controllers under one lifecycle, re-emitting their events.
 *
 * For consumers that want a single handle. The Alpine plugin does **not** use
 * it — it registers two independent magics, so a page that only needs a wake
 * lock never pays for an idle detector's setup.
 */
export class AttentionController extends BaseController<AttentionEvents> {
  readonly id: string;
  readonly wakeLock: WakeLockController;
  readonly idle: IdleController;

  constructor(id?: string) {
    super();
    this.id = id ?? generateId("attention");
    // Derived from this id, so two `AttentionController`s never produce
    // colliding sub-controller ids in a log.
    this.wakeLock = new WakeLockController(`${this.id}-wakelock`);
    this.idle = new IdleController(`${this.id}-idle`);
  }

  override mount(): void {
    if (this.lifecycle !== "idle") return;
    super.mount();
    this.wakeLock.mount();
    this.idle.mount();
    const off1 = this.wakeLock.on("wakelock:change", (d) => this.emit("wakelock:change", d));
    const off2 = this.idle.on("idle:change", (d) => this.emit("idle:change", d));
    this.onCleanup(off1);
    this.onCleanup(off2);
  }

  override destroy(): void {
    if (this.lifecycle === "destroyed") return;
    this.wakeLock.destroy();
    this.idle.destroy();
    super.destroy();
  }
}

export function createAttentionController(
  options: AttentionControllerOptions = {}
): AttentionController {
  const c = new AttentionController(options.id);
  c.mount();
  return c;
}
