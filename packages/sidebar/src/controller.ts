import { BaseController } from "@ailura/alpinejs-core/controller";
import { safeMatchMedia } from "@ailura/alpinejs-core/env";
import { generateId } from "@ailura/alpinejs-core/ids";

import type { SidebarEvents } from "./events";
import type {
  CreateSidebarOptions,
  SidebarChangeDetail,
  SidebarChangeSource,
  SidebarStore,
} from "./types";

export class SidebarController extends BaseController<SidebarEvents> {
  readonly id: string;
  #visible: boolean;
  #matchesBreakpoint = false;
  #closeOnEscape: boolean;
  #closeOnOverlayClick: boolean;
  #breakpoint?: CreateSidebarOptions["breakpoint"];
  #initialVisible: boolean;
  #mql: MediaQueryList | null = null;

  constructor(options: CreateSidebarOptions = {}) {
    super();
    this.id = options.id ?? generateId("sidebar");
    this.#closeOnEscape = options.closeOnEscape !== false;
    this.#closeOnOverlayClick = options.closeOnOverlayClick !== false;
    this.#breakpoint = options.breakpoint;
    this.#visible = options.initial ?? false;
    this.#initialVisible = this.#visible;
  }

  get visible(): boolean {
    return this.#visible;
  }
  get isVisible(): boolean {
    return this.#visible;
  }
  get hasOverlay(): boolean {
    return this.#visible && this.#closeOnOverlayClick;
  }
  get matchesBreakpoint(): boolean {
    return this.#matchesBreakpoint;
  }

  show(): void {
    if (this.lifecycle === "destroyed" || this.#visible) return;
    const prev = this.#snapshot();
    this.#visible = true;
    this.#emit("user", prev);
  }

  hide(): void {
    if (this.lifecycle === "destroyed" || !this.#visible) return;
    const prev = this.#snapshot();
    this.#visible = false;
    this.#emit("user", prev);
  }

  toggle(): void {
    if (this.lifecycle === "destroyed") return;
    if (this.#visible) this.hide();
    else this.show();
  }

  reset(): void {
    if (this.lifecycle === "destroyed") return;
    const prev = this.#snapshot();
    this.#visible = this.#initialVisible;
    this.#emit("reset", prev);
  }

  handleKeydown(event: KeyboardEvent): void {
    if (!this.#closeOnEscape || !this.#visible) return;
    if (event.key === "Escape") {
      event.preventDefault();
      const prev = this.#snapshot();
      this.#visible = false;
      this.#emit("escape", prev);
    }
  }

  protected override setup(): void {
    if (this.#breakpoint) {
      const mql = safeMatchMedia(this.#breakpoint.query);
      if (mql) {
        this.#mql = mql;
        this.#matchesBreakpoint = mql.matches;
        const handler = (e: MediaQueryListEvent): void => {
          this.#matchesBreakpoint = e.matches;
          if (!e.matches && this.#breakpoint?.onMismatch === "hide" && this.#visible) {
            const prev = this.#snapshot();
            this.#visible = false;
            this.#emit("breakpoint", prev);
          } else {
            const prev = { visible: this.#visible, matchesBreakpoint: !e.matches };
            this.#emit("breakpoint", prev);
          }
        };
        mql.addEventListener("change", handler);
        this.onCleanup(() => mql.removeEventListener("change", handler));
      }
    }

    if (this.#closeOnEscape && typeof document !== "undefined") {
      const onKey = (e: KeyboardEvent): void => this.handleKeydown(e);
      document.addEventListener("keydown", onKey);
      this.onCleanup(() => document.removeEventListener("keydown", onKey));
    }

    queueMicrotask(() => {
      if (this.lifecycle === "destroyed") return;
      this.emit("change", {
        visible: this.#visible,
        matchesBreakpoint: this.#matchesBreakpoint,
        source: "initialization",
        previous: null,
      });
    });
  }

  toStore(): SidebarStore {
    const self = this;
    return {
      get visible() {
        return self.visible;
      },
      set visible(v: boolean) {
        v ? self.show() : self.hide();
      },
      get matchesBreakpoint() {
        return self.matchesBreakpoint;
      },
      get isVisible() {
        return self.isVisible;
      },
      get hasOverlay() {
        return self.hasOverlay;
      },
      show: () => self.show(),
      hide: () => self.hide(),
      toggle: () => self.toggle(),
      reset: () => self.reset(),
      handleKeydown: (e: KeyboardEvent) => self.handleKeydown(e),
    };
  }

  #snapshot(): { visible: boolean; matchesBreakpoint: boolean } {
    return { visible: this.#visible, matchesBreakpoint: this.#matchesBreakpoint };
  }

  #emit(
    source: SidebarChangeSource,
    previous: { visible: boolean; matchesBreakpoint: boolean } | null
  ): void {
    const detail: SidebarChangeDetail = {
      visible: this.#visible,
      matchesBreakpoint: this.#matchesBreakpoint,
      source,
      previous,
    };
    this.emit("change", detail);
  }
}

export function createSidebarController(options?: CreateSidebarOptions): SidebarController {
  const c = new SidebarController(options);
  c.mount();
  return c;
}
