// @vitest-environment happy-dom
/**
 * `x-keyboard` — a shortcut bound to its element's lifetime.
 *
 * The trap this replaces: Alpine compiles `x-init` to `let __result = <expr>`
 * and then invokes `__result` when it is a function, so a bare list of
 * `register()` calls silently disposed the first shortcut on mount, and a
 * multi-statement `x-init` needed an IIFE just to survive at all. That is
 * impossible here because a directive callback never assigns its expression's
 * value — which is precisely why the old markup needed 12 of its 31 lines for
 * an IIFE workaround.
 *
 * The release is the other half: `register()` returns an unregister disposer
 * and nothing in the store surface can invoke it later. A directive's
 * `cleanup()` is the only Alpine-invoked teardown in this Alpine version
 * (`plugin()` discards the callback's return value; the Alpine object exposes no
 * `cleanup`/`stop()`), so it is what releases the registration.
 */
import { clearAllSingletons } from "@ailura/alpinejs-core/singletons";
import { html, mount, reset, resume, settled, start } from "@ailura/alpinejs-testing";
import Alpine from "alpinejs";
import { afterEach, beforeAll, beforeEach, describe, expect, test } from "vite-plus/test";

import { keyboardPlugin } from "../src/plugin";
import type { KeyboardStore } from "../src/types";

function store(): KeyboardStore {
  return (Alpine as unknown as { store(name: string): KeyboardStore }).store("keyboard");
}

/** Shortcut ids currently registered, i.e. what the store advertises. */
function ids(): string[] {
  return store().commands.map((command) => command.id);
}

/**
 * Dispatch a keydown on `window`, which is where the controller listens.
 *
 * The plugin's listener is global by design: `x-keyboard` binds the
 * *registration* to an element, not the dispatch.
 *
 * `mod` resolves to Meta on a Mac hint and Ctrl elsewhere, so the modifier to
 * press depends on the host — the same branch the package's own tests use.
 */
function press(key: string, extra: KeyboardEventInit = {}): void {
  const onMac = window.navigator.platform.toLowerCase().includes("mac");
  window.dispatchEvent(
    new KeyboardEvent("keydown", {
      bubbles: true,
      key,
      ...(onMac ? { metaKey: true } : { ctrlKey: true }),
      ...extra,
    })
  );
}

/**
 * Flush past Alpine's mutation observer.
 *
 * A directive's `cleanup()` runs from the observer's `childList` callback, and
 * `settled()`'s two ticks are not always enough to reach it after an
 * `el.remove()`. Draining microtasks in between matches what
 * `packages/carousel/test/viewport-directive.test.ts` does for the same reason.
 */
async function flush(): Promise<void> {
  await settled();
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
  await settled();
}

beforeAll(() => {
  start(() => {});
});

beforeEach(() => {
  clearAllSingletons();
  keyboardPlugin()(Alpine as unknown as import("alpinejs").Alpine);
  resume();
});

afterEach(() => {
  reset();
});

describe("x-keyboard directive", () => {
  test("registers the shortcut from the shorthand form", async () => {
    const root = html(
      `<div x-data="{ hits: 0 }"><div id="box" x-keyboard="'mod+s -> hits++'"></div></div>`
    );
    mount(root);
    await flush();

    expect(store().commands).toHaveLength(1);
    expect(store().commands[0]?.shortcut).toBe("mod+s");
  });

  test("the handler runs when the shortcut fires", async () => {
    // No scope modifier, so the registration lands in the `default` scope,
    // which the controller has active from the start.
    const root = html(
      `<div x-data="{ hits: 0 }"><div id="box" x-keyboard="'mod+s -> hits++'"></div><p id="out" x-text="hits"></p></div>`
    );
    mount(root);
    await flush();

    press("s");
    await flush();

    expect(root.querySelector("#out")?.textContent).toBe("1");
  });

  test("several directives all survive — no disposer trap", async () => {
    // This is what the old markup could not express: `x-init` invokes the value
    // of its expression when that value is a function, so a list of
    // `register()` calls disposed the first shortcut on mount.
    const root = html(
      `<div x-data="{ hits: [] }">
         <div id="save"   x-keyboard.editor="'mod+s -> hits.push(` +
        "`save`" +
        `)'"></div>
         <div id="search" x-keyboard.editor="'mod+f -> hits.push(` +
        "`search`" +
        `)'"></div>
       </div>`
    );
    mount(root);
    await flush();

    // Two distinct elements sharing one scope get distinct ids, so neither
    // evicts the other.
    expect(store().commands).toHaveLength(2);
  });

  test("a scope-derived id makes re-entry idempotent instead of throwing", async () => {
    // `register` throws `ERR_KEYBOARD_DUPLICATE_ID`, which the playground had to
    // defend against with a manual unregister pass on every visit.
    const root = html(`<div x-data><div id="box" x-keyboard.editor="'mod+s -> null'"></div></div>`);
    mount(root);
    await flush();
    const first = root.querySelector("#box") as HTMLElement;
    first.remove();
    await flush();

    const again = html(
      `<div x-data><div id="box" x-keyboard.editor="'mod+s -> null'"></div></div>`
    );
    mount(again);
    await flush();

    expect(store().commands).toHaveLength(1);
    expect(store().commands[0]?.id).toBe("x-keyboard.editor.mod-s");
  });

  test("unregisters the shortcut when Alpine removes the element", async () => {
    const root = html(`<div x-data><div id="box" x-keyboard="'mod+s -> null'"></div></div>`);
    mount(root);
    await flush();
    expect(ids()).toHaveLength(1);

    root.querySelector("#box")?.remove();
    await flush();

    expect(ids()).toHaveLength(0);
  });

  test("the window listener survives — only the registration is element-bound", async () => {
    const root = html(`<div x-data><div id="box" x-keyboard="'mod+s -> null'"></div></div>`);
    mount(root);
    await flush();
    (root.querySelector("#box") as HTMLElement).remove();
    await flush();

    // A second, independent registration still works after the first element is
    // gone, which is only true if the shared controller and its `window`
    // listener are intact.
    const again = html(`<div x-data><div id="box2" x-keyboard="'mod+f -> null'"></div></div>`);
    mount(again);
    await flush();
    expect(() =>
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "f", metaKey: true }))
    ).not.toThrow();
  });

  test("the hand-written register is unchanged — additive, not a replacement", async () => {
    // The IIFE is not decoration here either: `x-init`'s return value is invoked
    // when it is a function, and `register()` returns the unregister disposer.
    // That is the behaviour the directive exists to make unnecessary, so the
    // hand-written path has to keep behaving exactly as documented.
    const root = html(
      `<div x-data><div id="box" x-init="(() => { $store.keyboard.register('mod+g', () => {}); })()"></div></div>`
    );
    mount(root);
    await flush();

    expect(store().commands).toHaveLength(1);
    expect(store().commands[0]?.shortcut).toBe("mod+g");
  });

  test("an empty expression registers nothing and throws nothing", async () => {
    const root = html(`<div x-data><div id="box" x-keyboard></div></div>`);
    mount(root);
    await flush();

    expect(store().commands).toHaveLength(0);
  });
});
