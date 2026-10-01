import type { Alpine } from "alpinejs";

export type SidebarChangeSource = "user" | "breakpoint" | "escape" | "reset" | "initialization";
export type SidebarOnMismatch = "hide" | "keep";

export interface SidebarBreakpointOption {
  readonly query: string;
  readonly onMismatch: SidebarOnMismatch;
}

export interface SidebarChangeDetail {
  readonly visible: boolean;
  readonly matchesBreakpoint: boolean;
  readonly source: SidebarChangeSource;
  readonly previous: { readonly visible: boolean; readonly matchesBreakpoint: boolean } | null;
}

export interface CreateSidebarOptions {
  readonly id?: string;
  readonly closeOnEscape?: boolean;
  readonly closeOnOverlayClick?: boolean;
  readonly breakpoint?: SidebarBreakpointOption;
  readonly initial?: boolean;
  readonly storeKey?: string;
  readonly magicKey?: string;
}

export const DEFAULT_SIDEBAR_STORE_KEY = "sidebar" as const;
export const DEFAULT_SIDEBAR_MAGIC_KEY = "sidebar" as const;

export interface SidebarStore {
  visible: boolean;
  matchesBreakpoint: boolean;
  readonly isVisible: boolean;
  readonly hasOverlay: boolean;
  show(): void;
  hide(): void;
  toggle(): void;
  reset(): void;
  handleKeydown(event: KeyboardEvent): void;
}

export interface SidebarManager extends SidebarStore {
  readonly id: string;
  on(event: "change", listener: (detail: SidebarChangeDetail) => void): () => void;
  destroy(): void;
}

/**
 * The store `sidebarPlugin` registers on Alpine: the state members of
 * {@link SidebarStore} plus the host-owned teardown handle.
 */
export interface SidebarAlpineStore extends SidebarStore {
  /**
   * Host-owned teardown: removes the breakpoint `MediaQueryList` change
   * listener and the `document` keydown listener. Nothing invokes it
   * automatically — the host that registered the plugin calls it.
   */
  destroy(): void;
}

export type SidebarAlpine = Alpine & { store(name: string): unknown };
export type SidebarPluginCallback = (alpine: Alpine) => void;
