import type { SelectionMode, SelectionValue } from "@ailura/alpinejs-selection";

import type { AlpineInstance } from "../types/alpine.js";

/** Minimal serializer for a selection value — the package ships no helper. */
function serialize(value: SelectionValue): string {
  if (value === null) {
    return "";
  }
  if (Array.isArray(value)) {
    return value.join(",");
  }
  if (typeof value === "object") {
    const range = value as { from: string; to?: string };
    return range.to ? `${range.from}..${range.to}` : String(range.from);
  }
  return String(value);
}

const ITEM_CLASS =
  "w-full cursor-pointer rounded-md border px-3 py-2 text-left text-sm transition-colors";

type SelectionDemoData = {
  items: readonly string[];
  disabled: readonly string[];
  mode: SelectionMode;
  init(): void;
  itemClass(key: string): string;
  pick(event: MouseEvent, key: string): void;
  setMode(mode: SelectionMode): void;
  serialized(): string;
  copyUrl(): void;
};

type SelectionDemoComponent = SelectionDemoData & {
  $store: {
    selection: import("@ailura/alpinejs-selection").SelectionStore;
  };
};

export function registerSelectionDemo(Alpine: AlpineInstance): void {
  Alpine.data("selectionDemo", (): SelectionDemoData => ({
    items: ["Alpha", "Bravo", "Charlie", "Delta", "Echo"],
    disabled: ["Charlie"],
    mode: "multiple",

    init(this: SelectionDemoComponent) {
      this.$store.selection.create("demo", {
        mode: this.mode,
        keys: this.items,
        disabledKeys: this.disabled,
      });
    },

    itemClass(this: SelectionDemoComponent, key: string) {
      const store = this.$store.selection;
      if (!store.instances.demo) {
        return ITEM_CLASS;
      }

      // The store's own read helpers, not a re-derivation from the snapshot.
      // They are the ergonomic point of a store — `isSelected` / `isActive` /
      // `isSelectable` are what a template should be binding, and they track
      // whatever the controller does next without the demo having to know.
      return [
        ITEM_CLASS,
        store.isSelected("demo", key) ? "border-primary bg-primary/10" : "border-border",
        store.isActive("demo", key) ? "ring-2 ring-primary/40" : "",
        !store.isSelectable("demo", key) ? "opacity-50 cursor-not-allowed" : "",
      ].join(" ");
    },

    pick(this: SelectionDemoComponent, event: MouseEvent, key: string) {
      const store = this.$store.selection;
      if (!store.instances.demo || !store.isSelectable("demo", key)) {
        return;
      }

      // `select()` is the single entry point. This used to re-implement the
      // modifier mapping by hand — setActive, then branch on shift/meta/ctrl
      // into extend/toggle/replace, four store calls in total — which is exactly
      // the mapping `select()` already does, and it also re-implemented the
      // disabled-key guard it then had to repeat above.
      const behavior = event.shiftKey
        ? "extend"
        : event.metaKey || event.ctrlKey
          ? "toggle"
          : "replace";
      store.select("demo", key, { behavior });
    },

    setMode(this: SelectionDemoComponent, mode: SelectionMode) {
      this.mode = mode;
      this.$store.selection.setMode("demo", mode);
    },

    serialized(this: SelectionDemoComponent) {
      const snap = this.$store.selection.instances.demo;
      if (!snap) {
        return "";
      }
      return serialize(snap.value);
    },

    copyUrl(this: SelectionDemoComponent) {
      const encoded = encodeURIComponent(this.serialized());
      const url = `${window.location.pathname}?selected=${encoded}&mode=${this.mode}`;
      navigator.clipboard.writeText(url);
    },
  }));
}
