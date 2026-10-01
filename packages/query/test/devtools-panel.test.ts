// @vitest-environment happy-dom
/**
 * The devtools panel, mounted for real.
 *
 * The panel is the only DOM surface in this package, so its behaviour is tested
 * against a DOM rather than mocked: the panel builds real elements, subscribes
 * to a real `devtools` contract and tears both down again.
 *
 * The behaviours that matter, in the order they can silently break:
 *
 * 1. Mounting and destroying leave the document exactly as it was found.
 * 2. `destroy()` really releases the `devtools.subscribe` unsubscribe — the old
 *    panel never took its listener back, so a store outliving the panel kept
 *    repainting a detached tree.
 * 3. A change re-renders, and a panel that mounts *after* the last change is not
 *    blank, because the first paint comes from `getSnapshot()`.
 * 4. A source that exposes only `devtools` gets a panel that says so, instead of
 *    an Apply button that quietly does nothing.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";

import { mountQueryDevtools } from "../src/devtools/panel";
import { getQueryStore, queryDevtoolsPlugin } from "../src/devtools/plugin";
import type { QueryDevtoolsController, QueryDevtoolsSource } from "../src/devtools/types";
import type { QueryDevtoolsEntry, QueryDevtoolsSnapshot } from "../src/types";

type FakeSource = QueryDevtoolsSource & {
  /** Replaces the snapshot and notifies every subscriber, like the controller does. */
  publish(next?: Partial<QueryDevtoolsSnapshot>): number;
  subscriberCount(): number;
  unsubscribeCount(): number;
};

function createSource(
  initial: Partial<QueryDevtoolsSnapshot> = {},
  actions: Partial<QueryDevtoolsSource> = {}
): FakeSource {
  let snapshot: QueryDevtoolsSnapshot = {
    phase: "mounted",
    entries: [],
    mutations: [],
    ...initial,
  };
  const callbacks = new Set<(snapshot: QueryDevtoolsSnapshot) => void>();
  let unsubscribes = 0;
  return {
    devtools: {
      getSnapshot: () => snapshot,
      subscribe(callback) {
        callbacks.add(callback);
        return () => {
          unsubscribes += 1;
          callbacks.delete(callback);
        };
      },
    },
    ...actions,
    publish(next) {
      if (next) snapshot = { ...snapshot, ...next };
      const called = callbacks.size;
      for (const callback of [...callbacks]) callback(snapshot);
      return called;
    },
    subscriberCount: () => callbacks.size,
    unsubscribeCount: () => unsubscribes,
  };
}

function entry(overrides: Partial<QueryDevtoolsEntry> = {}): QueryDevtoolsEntry {
  return {
    key: ["post", 7],
    keyHash: '["post",7]',
    status: "success",
    fetchStatus: "idle",
    data: { title: "hello" },
    error: null,
    dataUpdatedAt: 1_700_000_000_000,
    errorUpdatedAt: 0,
    staleTime: 0,
    isStale: false,
    enabled: true,
    ...overrides,
  };
}

/** Renders are batched on an animation frame; let one land. */
async function frames(count = 4): Promise<void> {
  for (let i = 0; i < count; i += 1) await new Promise((resolve) => setTimeout(resolve, 20));
}

const panelEl = () => document.querySelector<HTMLElement>(".aq-devtools-panel");
const toggleEl = () => document.querySelector<HTMLElement>(".aq-devtools-toggle");
const listEl = () => document.querySelector<HTMLElement>(".aq-devtools-list");
const detailEl = () => document.querySelector<HTMLElement>(".aq-devtools-detail");

function buttonLabelled(container: HTMLElement, label: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll("button")).find((el) => el.textContent === label);
}

/** The detail pane has one viewer per section; a test must name which one it means. */
function sectionTitled(container: HTMLElement, title: string): HTMLElement {
  const section = Array.from(container.querySelectorAll<HTMLElement>(".aq-devtools-section")).find(
    (el) => el.querySelector(".aq-devtools-section-title")?.textContent === title
  );
  if (!section) throw new Error(`no "${title}" section in the detail pane`);
  return section;
}

/**
 * A found element, or a thrown error naming what was missing. The repo forbids
 * `!`, and a silent `undefined` in a test is worse than a loud one.
 */
function must<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`expected ${what} in the document`);
  return value;
}

const mounted: QueryDevtoolsController[] = [];

function mount(options: Parameters<typeof mountQueryDevtools>[0]): QueryDevtoolsController {
  const controller = mountQueryDevtools(options);
  mounted.push(controller);
  return controller;
}

beforeEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
});

afterEach(() => {
  for (const controller of mounted.splice(0)) controller.destroy();
  document.body.replaceChildren();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("mount and teardown", () => {
  test("mounts a panel and a toggle, and destroy() takes both out of the document", () => {
    const source = createSource();
    const controller = mount({ store: source, initialOpen: true });

    expect(panelEl()).not.toBeNull();
    expect(toggleEl()).not.toBeNull();
    expect(panelEl()?.className).toContain("aq-devtools-panel--bottom");
    expect(panelEl()?.className).toContain("is-open");

    controller.destroy();
    expect(panelEl()).toBeNull();
    expect(toggleEl()).toBeNull();
  });

  test("destroy() releases the devtools.subscribe unsubscribe", () => {
    const source = createSource();
    const controller = mount({ store: source });

    expect(source.subscriberCount()).toBe(1);
    controller.destroy();
    expect(source.unsubscribeCount()).toBe(1);
    expect(source.subscriberCount()).toBe(0);
  });

  test("no callback reaches the panel after teardown", () => {
    const source = createSource();
    const controller = mount({ store: source });
    controller.destroy();

    expect(source.publish({ entries: [entry()] })).toBe(0);
  });

  test("a repaint already queued at teardown does not resurrect the panel", async () => {
    const source = createSource();
    const controller = mount({ store: source });

    // A change queues one animation frame; destroying before it lands is the
    // exact race an unbatched teardown used to lose.
    source.publish({ entries: [entry()] });
    controller.destroy();
    await frames();

    expect(document.body.querySelector(".aq-devtools-root")).toBeNull();
  });

  test("destroy() is idempotent", () => {
    const source = createSource();
    const controller = mount({ store: source });

    controller.destroy();
    controller.destroy();
    expect(source.unsubscribeCount()).toBe(1);
  });

  test("a panel with no source is a configuration error, not a blank panel", () => {
    expect(() => mountQueryDevtools({})).toThrow(/at least one query source/);
  });

  test("a source without a devtools contract is rejected before anything is built", () => {
    expect(() => mount({ store: {} as QueryDevtoolsSource })).toThrow(/devtools.getSnapshot/);
    expect(document.body.querySelector(".aq-devtools-root")).toBeNull();
  });
});

describe("rendering", () => {
  test("a snapshot change re-renders the list", async () => {
    const source = createSource();
    mount({ store: source, initialOpen: true });

    expect(listEl()?.textContent).toContain("No queries cached yet.");

    source.publish({ entries: [entry()] });
    await frames();

    expect(listEl()?.querySelector(".aq-devtools-list-count")?.textContent).toBe("1");
    expect(listEl()?.querySelector(".aq-devtools-item-key")?.textContent).toBe("post › 7");
  });

  test("a panel mounted after the last change renders from getSnapshot()", () => {
    // No publish() at all: the state already moved before this panel existed.
    const source = createSource({ entries: [entry({ key: ["user", 1] })] });
    mount({ store: source, initialOpen: true });

    expect(listEl()?.querySelector(".aq-devtools-item-key")?.textContent).toBe("user › 1");
  });

  test("the search filter narrows the list and says so when it empties it", async () => {
    const source = createSource({
      entries: [entry(), entry({ key: ["user", 1], keyHash: '["user",1]' })],
    });
    mount({ store: source, initialOpen: true });

    const search = must(
      document.querySelector<HTMLInputElement>(".aq-devtools-search"),
      "the search input"
    );
    search.value = "user";
    search.dispatchEvent(new Event("input"));
    await frames();

    expect(listEl()?.querySelectorAll(".aq-devtools-item")).toHaveLength(1);

    search.value = "nothing-here";
    search.dispatchEvent(new Event("input"));
    await frames();
    expect(listEl()?.textContent).toContain("No queries match your filter.");
  });

  test("the detail pane shows the state the snapshot actually carries", async () => {
    const source = createSource({
      entries: [
        entry({
          status: "error",
          error: { name: "HttpError", message: "boom" },
          isStale: true,
          enabled: false,
          staleTime: 5000,
        }),
      ],
    });
    mount({ store: source, initialOpen: true });
    await frames();

    const detail = must(detailEl(), "the detail pane");
    expect(detail.textContent).toContain("HttpError: boom");
    expect(detail.textContent).toContain("Stale time");
    expect(detail.textContent).toContain("5.00s");
    expect(detail.textContent).toContain("Enabled");
    expect(detail.textContent).toContain("No");
  });

  test("mutations are listed from the snapshot's mutation records", async () => {
    const source = createSource({
      mutations: [{ id: 3, status: "success", data: { id: 1 }, error: null }],
    });
    mount({ store: source, initialOpen: true });

    must(
      document.querySelector<HTMLButtonElement>(".aq-devtools-tabs .aq-devtools-tab:last-child"),
      "the Mutations tab"
    ).click();
    await frames();

    expect(listEl()?.querySelector(".aq-devtools-item-key")?.textContent).toBe("3 · success");
  });
});

describe("the read-only contract", () => {
  test("a devtools-only source gets a disabled editor and a stated reason", async () => {
    const source = createSource({ entries: [entry()] });
    mount({ store: source, initialOpen: true });
    await frames();

    const detail = must(detailEl(), "the detail pane");
    const data = sectionTitled(detail, "Data");
    const edit = must(buttonLabelled(data, "Edit"), 'an "Edit" tab');
    expect(edit.disabled).toBe(true);
    expect(edit.title).toMatch(/setData/);
    expect(data.textContent).toContain("Read-only source");
  });

  test("a source without writers shows no action buttons at all", async () => {
    const source = createSource({ entries: [entry()] });
    mount({ store: source, initialOpen: true });
    await frames();

    const detail = must(detailEl(), "the detail pane");
    for (const label of ["Refetch", "Invalidate", "Reset", "Remove"]) {
      expect(buttonLabelled(detail, label)).toBeUndefined();
    }
  });

  test("a source that exposes setData() gets a working editor", async () => {
    const setData = vi.fn();
    const source = createSource({ entries: [entry()] }, { setData });
    mount({ store: source, initialOpen: true });
    await frames();

    const detail = must(detailEl(), "the detail pane");
    // The Options viewer is always read-only; the Data viewer is the one the
    // source can write, and both are present in the same pane.
    expect(
      must(buttonLabelled(sectionTitled(detail, "Options"), "Edit"), "an Edit tab").disabled
    ).toBe(true);
    expect(
      must(buttonLabelled(sectionTitled(detail, "Data"), "Edit"), "an Edit tab").disabled
    ).toBe(false);

    const data = sectionTitled(detail, "Data");
    must(buttonLabelled(data, "Edit"), 'an "Edit" tab').click();
    const editor = must(
      data.querySelector<HTMLTextAreaElement>(".aq-devtools-editor"),
      "the editor textarea"
    );
    editor.value = '{"title":"edited"}';
    must(buttonLabelled(data, "Apply"), 'an "Apply" button').click();

    expect(setData).toHaveBeenCalledWith(["post", 7], { title: "edited" });
    expect(data.querySelector(".aq-devtools-editor-feedback")?.textContent).toBe("Cache updated");
  });

  test("invalid JSON is reported and nothing is written", async () => {
    const setData = vi.fn();
    const source = createSource({ entries: [entry()] }, { setData });
    mount({ store: source, initialOpen: true });
    await frames();

    const detail = must(detailEl(), "the detail pane");
    const data = sectionTitled(detail, "Data");
    must(buttonLabelled(data, "Edit"), 'an "Edit" tab').click();
    must(
      data.querySelector<HTMLTextAreaElement>(".aq-devtools-editor"),
      "the editor textarea"
    ).value = "{not json";
    must(buttonLabelled(data, "Apply"), 'an "Apply" button').click();

    expect(setData).not.toHaveBeenCalled();
    expect(data.querySelector(".aq-devtools-editor-feedback")?.textContent).toBeTruthy();
  });

  test("the global action is disabled when the source cannot perform it", async () => {
    const source = createSource();
    mount({ store: source, initialOpen: true });
    await frames();

    const action = must(
      document.querySelector<HTMLButtonElement>(".aq-devtools-global-action"),
      "the global action button"
    );
    expect(action.textContent).toBe("Reset cache");
    expect(action.disabled).toBe(true);
    expect(action.title).toContain("reset()");
  });
});

describe("controller", () => {
  test("open, close and toggle drive the panel and the toggle button", async () => {
    const controller = mount({ store: createSource() });

    controller.open();
    await frames();
    expect(panelEl()?.className).toContain("is-open");
    expect(toggleEl()?.hidden).toBe(true);

    controller.close();
    await frames();
    expect(panelEl()?.className).not.toContain("is-open");
    expect(toggleEl()?.hidden).toBe(false);

    controller.toggle();
    await frames();
    expect(panelEl()?.className).toContain("is-open");
  });

  test("the toggle button opens the panel", async () => {
    mount({ store: createSource() });
    must(toggleEl(), "the toggle button").click();
    await frames();
    expect(panelEl()?.className).toContain("is-open");
  });

  test("setToggleCorner moves the button and is readable back", () => {
    const controller = mount({ store: createSource() });
    expect(controller.getToggleCorner()).toBe("bottom-right");

    controller.setToggleCorner("top-left");
    expect(controller.getToggleCorner()).toBe("top-left");
    expect(toggleEl()?.className).toContain("aq-devtools-toggle--top-left");
    expect(localStorage.getItem("alpine-query-devtools:toggle-corner")).toBe("top-left");
  });
});

describe("multiple sources", () => {
  test("a second source adds a scope filter and per-row labels", async () => {
    const first = createSource({ entries: [entry({ key: ["a"] })] });
    const second = createSource({ entries: [entry({ key: ["b"] })] });
    mount({ store: first, additionalStores: [second], storeName: "primary", initialOpen: true });
    await frames();

    const scope = must(
      document.querySelector<HTMLSelectElement>(".aq-devtools-select--adapter"),
      "the source filter"
    );
    expect(scope.hidden).toBe(false);
    expect(Array.from(scope.options, (option) => option.textContent)).toEqual([
      "All sources",
      "primary",
      "Store 2",
    ]);
    expect(listEl()?.querySelectorAll(".aq-devtools-item")).toHaveLength(2);
    expect(
      Array.from(
        must(listEl(), "the list").querySelectorAll(".aq-devtools-badge--adapter"),
        (el) => el.textContent
      ).sort()
    ).toEqual(["Store 2", "primary"]);

    scope.value = "1";
    scope.dispatchEvent(new Event("change"));
    await frames();
    expect(listEl()?.querySelectorAll(".aq-devtools-item")).toHaveLength(1);
  });

  test("one source is labelled by storeName and needs no scope filter", () => {
    mount({ store: createSource({ entries: [entry()] }), storeName: "cache", initialOpen: true });
    const scope = must(
      document.querySelector<HTMLSelectElement>(".aq-devtools-select--adapter"),
      "the source filter"
    );
    expect(scope.hidden).toBe(true);
    expect(document.querySelector(".aq-devtools-subtitle")?.textContent).toBe("cache");
  });
});

describe("queryDevtoolsPlugin", () => {
  function fakeAlpine(store: unknown) {
    return { store: (name: string) => (name === "query" ? store : undefined) } as never;
  }

  test("defers mounting to alpine:initialized, then mounts", async () => {
    const source = createSource({ entries: [entry()] });
    const register = queryDevtoolsPlugin({ initialOpen: true });
    const cleanup = register(fakeAlpine({ devtools: source.devtools }));

    expect(panelEl()).toBeNull();
    document.dispatchEvent(new Event("alpine:initialized"));
    await frames();

    expect(panelEl()).not.toBeNull();
    expect(listEl()?.querySelector(".aq-devtools-item-key")?.textContent).toBe("post › 7");
    cleanup();
    expect(panelEl()).toBeNull();
  });

  test("the cleanup removes the alpine:initialized listener it registered", async () => {
    const source = createSource();
    const cleanup = queryDevtoolsPlugin()(fakeAlpine({ devtools: source.devtools }));
    cleanup();

    // The old plugin never took this listener back, so a second registration
    // mounted a second panel. With the listener gone, this event does nothing.
    document.dispatchEvent(new Event("alpine:initialized"));
    await frames();
    expect(panelEl()).toBeNull();
  });

  test("a missing store names the plugin that has to be registered first", () => {
    expect(() => getQueryStore({ store: () => ({}) } as never)).toThrow(
      /Register @ailura\/alpinejs-query first/
    );
  });

  test("getQueryStore accepts a source that already exposes devtools", () => {
    const source = createSource();
    expect(getQueryStore(source)).toBe(source);
  });
});
