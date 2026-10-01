// @vitest-environment happy-dom
/**
 * The playground's keyboard demo, and the Alpine behaviour that silently broke it.
 *
 * `KeyboardDemo.astro` registered three shortcuts in one `x-init`. Only two of
 * them ever existed. The cause is Alpine, not this package: `x-init` compiles to
 *
 *     with (scope) { let __result = <expression>; return __result }
 *
 * so with several statements only the FIRST statement's value is assigned to
 * `__result` — the rest become separate statements. `register()` returns an
 * unregister disposer, and Alpine auto-invokes a function result, so
 * `__result` held the disposer for the first registration and Alpine called it.
 * The first shortcut was disposed on mount.
 *
 * The casualty was the one the demo tells you to try first: `mod+shift+k`.
 * `g h` and the scoped `x` worked, which is what made it look like a flaky demo
 * rather than a broken one.
 *
 * A second defect hid behind the first: `register()` throws on a duplicate id
 * (`invariant`), and the playground uses Astro view transitions, so `x-init`
 * re-runs on every visit. With the first registration silently disposed there
 * was no duplicate to trip over; once it survives, re-entry would throw unless
 * the demo unregisters first.
 */

// @vitest-environment happy-dom
import { clearAllSingletons } from "@ailura/alpinejs-core/singletons";
import { html, mount, reset, resume, settled, start } from "@ailura/alpinejs-testing";
import Alpine from "alpinejs";
import { afterEach, beforeAll, beforeEach, describe, expect, test } from "vite-plus/test";

import { keyboardPlugin } from "../src/plugin";
import type { KeyboardStore } from "../src/types";

/**
 * The package's own store contract, not a local copy of it. A hand-rolled
 * interface here had already drifted: it listed six members and omitted
 * `suspendScope` / `resumeScope` / `isScopeActive` / `isScopeSuspended`, which
 * `KeyboardMagic` declares and the plugin registers — so this file's scope
 * assertions could not typecheck against its own store.
 */
function store(): KeyboardStore {
  return (Alpine as unknown as { store(name: string): KeyboardStore }).store("keyboard");
}

function ids(): string[] {
  return store().commands.map((c) => c.id);
}

function press(init: KeyboardEventInit): void {
  window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ...init }));
}

/** The demo's x-init, verbatim in structure: three registrations, one IIFE. */
const DEMO_INIT = `
  (() => {
    for (const id of ['demo-chord', 'demo-sequence', 'demo-editor']) {
      $store.keyboard.unregister(id);
    }
    $store.keyboard.register('mod+shift+k', () => push('Chord: mod+shift+k'), {
      id: 'demo-chord',
      metadata: { label: 'Demo chord', group: 'Demo' },
    });
    $store.keyboard.register('g h', () => push('Sequence: g then h'), {
      id: 'demo-sequence',
      metadata: { label: 'Go home sequence', group: 'Demo' },
    });
    $store.keyboard.register('x', () => push('Editor scope: x'), {
      id: 'demo-editor',
      scope: 'editor',
      metadata: { label: 'Editor action', group: 'Editor' },
    });
  })()
`;

function mountDemo(init = DEMO_INIT): void {
  mount(
    html(`<div
      data-testid="root"
      x-data="{ log: [], push(m) { this.log = [m, ...this.log] } }"
      x-init="${init}"
    >
      <ul data-testid="log"><template x-for="e in log" :key="e"><li x-text="e"></li></template></ul>
    </div>`)
  );
}

beforeAll(() => start(() => {}));

beforeEach(() => {
  keyboardPlugin()(Alpine as unknown as import("alpinejs").Alpine);
  resume();
});

afterEach(() => {
  reset();
  clearAllSingletons();
});

describe("keyboard demo — every advertised shortcut exists", () => {
  test("all three registrations survive x-init", async () => {
    mountDemo();
    await settled();

    // The regression: `demo-chord` was missing from this list.
    expect(ids()).toEqual(["demo-chord", "demo-sequence", "demo-editor"]);
  });

  test("mod+shift+k fires, as the demo's own instructions claim", async () => {
    mountDemo();
    await settled();

    const onMac = window.navigator.platform.toLowerCase().includes("mac");
    press({ key: "k", shiftKey: true, ...(onMac ? { metaKey: true } : { ctrlKey: true }) });
    await settled();

    expect(document.querySelector('[data-testid="log"]')?.textContent).toContain(
      "Chord: mod+shift+k"
    );
  });

  test("the g h sequence still fires", async () => {
    mountDemo();
    await settled();

    press({ key: "g" });
    press({ key: "h" });
    await settled();

    expect(document.querySelector('[data-testid="log"]')?.textContent).toContain(
      "Sequence: g then h"
    );
  });

  test("the scoped x fires only once the editor scope is active", async () => {
    mountDemo();
    await settled();

    press({ key: "x" });
    await settled();
    expect(document.querySelector('[data-testid="log"]')?.textContent).not.toContain("Editor");

    store().activateScope("editor");
    press({ key: "x" });
    await settled();
    expect(document.querySelector('[data-testid="log"]')?.textContent).toContain("Editor scope: x");
  });

  test("a suspended scope stops firing but stays active", async () => {
    mountDemo();
    await settled();
    store().activateScope("editor");

    store().suspendScope("editor");
    expect(store().isScopeActive("editor")).toBe(true);
    expect(store().isScopeSuspended("editor")).toBe(true);

    press({ key: "x" });
    await settled();
    expect(document.querySelector('[data-testid="log"]')?.textContent).not.toContain("Editor");

    store().resumeScope("editor");
    press({ key: "x" });
    await settled();
    expect(document.querySelector('[data-testid="log"]')?.textContent).toContain("Editor scope: x");
  });
});

describe("keyboard demo — re-entry is idempotent", () => {
  test("a second mount replaces the registrations instead of throwing", async () => {
    // Astro view transitions re-run x-init on every visit, and register()
    // throws on a duplicate id. This is the defect the IIFE fix would otherwise
    // have exposed.
    mountDemo();
    await settled();
    expect(() => mountDemo()).not.toThrow();
    await settled();

    expect(ids()).toEqual(["demo-chord", "demo-sequence", "demo-editor"]);
  });

  test("without the guard, a second visit hits the duplicate-id invariant", async () => {
    // IIFE but NO unregister pass, so the registration genuinely survives the
    // first mount and the duplicate is real. A bare (unwrapped) x-init would not
    // demonstrate anything here: Alpine disposes the first registration, so
    // there would be no duplicate left to trip over.
    //
    // Asserted through the store rather than through `mount()`: Alpine traps a
    // throwing expression in its own handler and rethrows it asynchronously, so
    // it never escapes the mount call.
    const unguarded = `(() => {
      $store.keyboard.register('mod+shift+k', () => {}, { id: 'demo-chord' });
    })()`;
    mountDemo(unguarded);
    await settled();
    expect(ids()).toEqual(["demo-chord"]);

    expect(() => store().register("j", () => {}, { id: "demo-chord" })).toThrow(
      /already registered/
    );
  });
});

describe("keyboard demo — repeated presses keep the log well-formed", () => {
  /** The demo's log after the fix: a unique id per entry, keyed on it. */
  const FIXED_LOG = `{
    log: [],
    seq: 0,
    push(message) {
      this.log = [{ id: ++this.seq, message }, ...this.log].slice(0, 6);
    },
  }`;

  /** The markup before the fix: the message itself was the key. */
  const NAIVE_LOG = `{ log: [], push(m) { this.log = [m, ...this.log].slice(0, 6); } }`;

  function pressChordTwice(): void {
    const onMac = window.navigator.platform.toLowerCase().includes("mac");
    const chord = {
      key: "k",
      shiftKey: true,
      ...(onMac ? { metaKey: true } : { ctrlKey: true }),
    };
    press(chord);
    press(chord);
  }

  test("the fixed log renders one row per press", async () => {
    mount(
      html(`<div data-testid="root" x-data="${FIXED_LOG}" x-init="${DEMO_INIT}">
        <ul data-testid="log"><template x-for="e in log" :key="e.id"><li x-text="e.message"></li></template></ul>
      </div>`)
    );
    await settled();
    pressChordTwice();
    await settled();

    // `Array.from`, not a spread: this package compiles without `DOM.Iterable`,
    // so `NodeListOf<Element>` carries no `[Symbol.iterator]`.
    const rows = Array.from(document.querySelectorAll('[data-testid="log"] li'));
    expect(rows).toHaveLength(2);
  });

  test("keying on the message collapsed repeats into one row", async () => {
    // Documented defect: `:key="entry"` with a duplicated message made the
    // second press invisible, the same class of silent breakage as the missing
    // registration.
    mount(
      html(`<div data-testid="root" x-data="${NAIVE_LOG}" x-init="${DEMO_INIT}">
        <ul data-testid="log"><template x-for="e in log" :key="e"><li x-text="e"></li></template></ul>
      </div>`)
    );
    await settled();
    pressChordTwice();
    await settled();

    expect(document.querySelectorAll('[data-testid="log"] li')).toHaveLength(1);
  });
});
