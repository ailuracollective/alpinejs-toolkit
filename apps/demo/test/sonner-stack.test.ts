// @vitest-environment happy-dom
/**
 * The demo renders ONE list of toasts, in arrival order, and every toast in it
 * shares one coordinate line.
 *
 * The regression this pins: persistent (loading) and timed toasts were two
 * sibling `<ol>`s, and the "persistent" treatment — in flow, `height: auto`, and
 * a `--y` reset — was selected by which toaster the toast landed in
 * (`[data-stack="persistent"]`). Fusing the lists deleted that toaster, so a
 * loading toast fell back to the timed rules: it inherited `--y:
 * translateY(100%)` and sat outside the viewport, because the only rule that
 * zeroes `--y` for the front toast requires `data-expanded="false"` and a
 * loading toast is expanded.
 *
 * The fix was not to special-case the toast back into flow, but to put it in the
 * same absolute model as the rest and give it an offset that clears whatever
 * arrived before it. That offset is what these tests check: an offset that counts
 * only the timed toasts — the pre-fusion arithmetic — leaves a toast sitting on
 * top of a loading created just before it.
 */

import { reset, resume, settled, start } from "@ailura/alpinejs-testing";
import { createToastController } from "@ailura/alpinejs-toast";
import Alpine from "alpinejs";
import { afterEach, beforeAll, describe, expect, test } from "vite-plus/test";

import { registerToastSonner } from "../src/demo/sonner-demo";

type OffsetToast = {
  id: string;
  key: null;
  content: unknown;
  title: string | null;
  description: string | null;
  variant: string;
  position: string;
  duration: number | false;
  action: null;
  removed: boolean;
};

/** `duration: false` is what makes a toast a loading — it never auto-dismisses. */
function toast(id: string, duration: number | false): OffsetToast {
  return {
    id,
    key: null,
    content: null,
    title: id,
    description: null,
    variant: "info",
    position: "bottom-right",
    duration,
    action: null,
    removed: false,
  };
}

/** Mounts the component for real, so `this` is Alpine-bound like in the page. */
async function mount(): Promise<Record<string, (...args: never[]) => unknown>> {
  resume();
  document.body.innerHTML = `<div x-data="toastSonner()"></div>`;
  await settled();
  const el = document.querySelector<HTMLElement>("[x-data]");
  const stack = (el as unknown as { _x_dataStack?: Record<string, unknown>[] })._x_dataStack;
  if (!stack?.[0]) {
    throw new Error("the component did not mount");
  }
  return stack[0] as Record<string, (...args: never[]) => unknown>;
}

function offset(toastItem: unknown): string {
  const c = component as unknown as {
    toastStyle: (t: unknown, p: string) => Record<string, string>;
  };
  return c.toastStyle(toastItem, "bottom-right")["--offset"];
}

let component: Record<string, (...args: never[]) => unknown>;

// `registerToastSonner` has to run before Alpine starts, since that is when it
// calls `Alpine.data("toastSonner", …)`.
beforeAll(() => {
  // The component reads its queue off the store on init, so the store has to
  // exist first. It is the package's own store, not a hand-rolled stand-in:
  // `init()` reads `items`, and `isVisible` / `dismiss` read `maxVisible` and
  // `dismiss`, so a partial literal would be missing members the component
  // calls. These tests drive `queue` directly instead of the store.
  Alpine.store("toast", createToastController().toStore());
  registerToastSonner(Alpine);
  start(() => {});
});

afterEach(() => {
  document.body.innerHTML = "";
  reset();
});

describe("one list, in arrival order", () => {
  test("a loading toast and a timed one share the stack", async () => {
    component = await mount();
    const c = component as unknown as { queue: OffsetToast[]; stackAt: (p: string) => unknown[] };
    c.queue = [toast("timed-1", 4000), toast("loading", false)];

    expect(c.stackAt("bottom-right")).toHaveLength(2);
  });

  /**
   * The regression this pins: `stackAt` filtered dismissed toasts out, so a
   * toast left the DOM the instant it was dismissed. The store holds it for 300ms
   * precisely so it can animate out, and no exit transition could ever be seen —
   * the toast simply vanished.
   */
  test("a dismissed toast stays in the render list so it can animate out", async () => {
    component = await mount();
    const c = component as unknown as {
      queue: OffsetToast[];
      stackAt: (p: string) => unknown[];
      liveAt: (p: string) => unknown[];
    };
    const gone = toast("timed-2", 4000);
    gone.removed = true;
    c.queue = [toast("timed-1", 4000), gone];

    expect(c.stackAt("bottom-right")).toHaveLength(2);
    expect(c.liveAt("bottom-right")).toHaveLength(1);
  });

  test("the toaster hides once only dismissed toasts are left", async () => {
    component = await mount();
    const c = component as unknown as {
      queue: OffsetToast[];
      hasAnyToasts: (p: string) => boolean;
    };
    const gone = toast("timed-1", 4000);
    gone.removed = true;
    c.queue = [gone];

    // Otherwise the <ol> stays x-show-visible holding nothing but a toast that is
    // already on its way off.
    expect(c.hasAnyToasts("bottom-right")).toBe(false);
  });

  test("a dismissed toast stays visible so the exit can play", async () => {
    component = await mount();
    const c = component as unknown as {
      queue: OffsetToast[];
      toastVisible: (t: unknown, p: string) => boolean;
    };
    const gone = toast("timed-2", 4000);
    gone.removed = true;
    c.queue = [toast("timed-1", 4000), gone];

    // `data-visible="false"` sets `opacity: 0` outright, which cancelled the
    // slide in the same tick the toast was dismissed.
    expect(c.toastVisible(gone, "bottom-right")).toBe(true);
  });
});

describe("offsets are cumulative over EVERY preceding toast", () => {
  test("the front toast sits at 0", async () => {
    component = await mount();
    const c = component as unknown as { queue: OffsetToast[]; heights: Record<string, number> };
    const first = toast("timed-1", 4000);
    c.queue = [first, toast("loading", false)];
    c.heights = { "timed-1": 40, loading: 30 };

    expect(offset(first)).toBe("0px");
  });

  test("a toast clears the one that arrived before it, loadings included", async () => {
    component = await mount();
    const c = component as unknown as { queue: OffsetToast[]; heights: Record<string, number> };
    const loading = toast("loading", false);
    const timed = toast("timed-2", 4000);
    c.queue = [loading, timed];
    c.heights = { loading: 30, "timed-2": 40 };

    // 30px of loading + the 14px gap.
    expect(offset(timed)).toBe("44px");
  });

  test("a timed toast created after a loading is pushed up, not stacked on it", async () => {
    component = await mount();
    const c = component as unknown as { queue: OffsetToast[]; heights: Record<string, number> };
    const timed = toast("timed-2", 4000);
    c.queue = [toast("loading", false), timed];
    c.heights = { loading: 30, "timed-2": 40 };

    // This is the exact assertion the old arithmetic fails: counting only the
    // timed toasts yields 0px, which parks both on the same line.
    expect(offset(timed)).toBe("44px");
    expect(offset(timed)).not.toBe("0px");
  });

  test("a toast that is leaving stops pushing the ones behind it", async () => {
    component = await mount();
    const c = component as unknown as { queue: OffsetToast[]; heights: Record<string, number> };
    const gone = toast("timed-1", 4000);
    gone.removed = true;
    const live = toast("timed-2", 4000);
    c.queue = [gone, live];
    c.heights = { "timed-1": 40, "timed-2": 40 };

    // The departed toast occupies 40px + 14px of gap. Counting it would leave the
    // live toast sitting 54px too high, in a hole where nothing is any more.
    expect(offset(live)).toBe("0px");
  });

  test("two loadings stack on each other in arrival order", async () => {
    component = await mount();
    const c = component as unknown as { queue: OffsetToast[]; heights: Record<string, number> };
    const first = toast("loading-1", false);
    const second = toast("loading-2", false);
    c.queue = [first, second];
    c.heights = { "loading-1": 30, "loading-2": 30 };

    expect(offset(first)).toBe("0px");
    expect(offset(second)).toBe("44px");
  });
});

/**
 * The regression this pins: offsets summed each toast's MEASURED height while a
 * collapsed toast behind the front is PAINTED at `--front-toast-height`. The sum
 * and the painting disagreed, so a toast taller than the front — a two-line one
 * among one-liners, which is what a loading next to a normal toast produces —
 * shifted everything above it and the stack overlapped.
 */
describe("an offset clears the height a toast is painted at", () => {
  test("a collapsed toast behind the front occupies the front's height", async () => {
    component = await mount();
    const c = component as unknown as {
      queue: OffsetToast[];
      heights: Record<string, number>;
      isExpanded: (p: string) => boolean;
    };
    const front = toast("timed-1", 4000);
    const behind = toast("timed-2", 4000);
    c.queue = [front, behind];
    c.heights = { "timed-1": 40, "timed-2": 90 };
    expect(c.isExpanded("bottom-right")).toBe(false);

    // Painted at the front's 40px, not at its own 90px. Summing 90 would push
    // everything above it 50px too far up.
    expect(offset(behind)).toBe("54px");
  });

  test("expanded, each toast occupies its own height again", async () => {
    component = await mount();
    const c = component as unknown as {
      queue: OffsetToast[];
      heights: Record<string, number>;
      setExpanded: (p: string, v: boolean) => void;
    };
    const behind = toast("timed-2", 4000);
    const last = toast("timed-3", 4000);
    c.queue = [toast("timed-1", 4000), behind, last];
    c.heights = { "timed-1": 40, "timed-2": 90, "timed-3": 40 };
    c.setExpanded("bottom-right", true);

    // Each preceding toast contributes its height plus a 14px gap:
    // 40 + 14 + 90 + 14.
    expect(offset(last)).toBe("158px");
  });

  test("collapsed, the same third toast clears the front's height", async () => {
    component = await mount();
    const c = component as unknown as {
      queue: OffsetToast[];
      heights: Record<string, number>;
    };
    c.queue = [toast("timed-1", 4000), toast("timed-2", 4000), toast("timed-3", 4000)];
    c.heights = { "timed-1": 40, "timed-2": 90, "timed-3": 40 };

    // 40 + 14 + 40 + 14 — the tall toast is painted at the front's 40px, so it
    // only ever occupies 40px of the stack however tall it really is.
    expect(offset(c.queue[2])).toBe("108px");
  });

  /**
   * And the failure mode that made it read as a stacking bug: an unmeasured
   * toast contributed `0 + 14`, so every toast behind it landed on top of it.
   */
  test("an unmeasured toast still occupies the front's height", async () => {
    component = await mount();
    const c = component as unknown as {
      queue: OffsetToast[];
      heights: Record<string, number>;
    };
    const behind = toast("timed-2", 4000);
    c.queue = [toast("timed-1", 4000), behind];
    c.heights = { "timed-1": 40 };

    // No height for `timed-2`. Before the fix it added 14px and the toast landed
    // on the front; it must fall back to the front's 40px.
    expect(offset(behind)).toBe("54px");
  });

  /**
   * The case in the report: a loading is always `data-expanded="true"`, so it
   * never takes the collapsed branch above and reaches `paintedHeight`'s fallback
   * instead. A loading whose height was never read — its element measured while
   * hidden — used to contribute `0 + 14`, so the loading and the normal toasts
   * around it piled on top of each other.
   */
  test("an unmeasured loading occupies the front's height", async () => {
    component = await mount();
    const c = component as unknown as {
      queue: OffsetToast[];
      heights: Record<string, number>;
    };
    const front = toast("timed-1", 4000);
    const loading = toast("loading", false);
    const afterLoading = toast("timed-2", 4000);
    c.queue = [front, loading, afterLoading];
    c.heights = { "timed-1": 40, "timed-2": 40 };

    expect(offset(loading)).toBe("54px");
    // 40 + 14 + 40 (the loading's fallback) + 14.
    expect(offset(afterLoading)).toBe("108px");
  });
});

describe("a loading toast keeps the persistent state flags", () => {
  test("expanded, front and visible, regardless of collapse", async () => {
    component = await mount();
    const c = component as unknown as {
      queue: OffsetToast[];
      isExpanded: (p: string) => boolean;
      toastExpanded: (t: unknown, p: string) => boolean;
      toastFront: (t: unknown, p: string) => boolean;
      toastVisible: (t: unknown, p: string) => boolean;
    };
    const loading = toast("loading", false);
    c.queue = [loading];

    // Collapsed: a timed toast behind the front is neither front nor visible.
    expect(c.isExpanded("bottom-right")).toBe(false);

    // A loading is not collapsible, so it never takes those states.
    expect(c.toastExpanded(loading, "bottom-right")).toBe(true);
    expect(c.toastFront(loading, "bottom-right")).toBe(true);
    expect(c.toastVisible(loading, "bottom-right")).toBe(true);
  });
});
