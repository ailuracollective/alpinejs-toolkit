/**
 * Teardown contract for the `@ailura/alpinejs-keyboard` store surface.
 *
 * Observable: the `window` `keydown` listener the controller registers. The
 * controller's `teardown()` also clears its registration map, so a
 * registration that exists only AFTER `destroy()` is the honest probe for the
 * listener itself — if the listener had leaked, that fresh handler would run.
 */

// @vitest-environment happy-dom
import { clearAllSingletons } from "@ailura/alpinejs-core/singletons";
import { reset, resume, start } from "@ailura/alpinejs-testing";
import { createMockAlpine } from "@ailura/alpinejs-testing/mock";
import Alpine from "alpinejs";
import { afterEach, beforeAll, beforeEach, describe, expect, test } from "vite-plus/test";

import { KeyboardController } from "../src/controller";
import { keyboardPlugin } from "../src/plugin";
import type { KeyboardStore } from "../src/types";

function register(): KeyboardStore {
  const { alpine, stores } = createMockAlpine();
  keyboardPlugin()(alpine);
  return stores.get("keyboard") as KeyboardStore;
}

function pressKey(key: string): void {
  window.dispatchEvent(new KeyboardEvent("keydown", { key }));
}

describe("keyboardPlugin teardown", () => {
  test("store exposes a host-owned destroy handle", () => {
    const store = register();
    expect(typeof store.destroy).toBe("function");
  });

  test("window keydown stops reaching handlers after destroy", () => {
    const store = register();
    let beforeDestroy = 0;
    store.register(
      "k",
      () => {
        beforeDestroy += 1;
      },
      { id: "before" }
    );

    // Before destroy: the real window keydown listener runs the handler.
    pressKey("k");
    expect(beforeDestroy).toBe(1);

    store.destroy();

    // Registered only after destroy, so the registration map cannot be the
    // reason it stays silent: a leaked window listener would run it.
    let afterDestroy = 0;
    store.register(
      "j",
      () => {
        afterDestroy += 1;
      },
      { id: "after" }
    );

    pressKey("k");
    pressKey("j");
    expect(afterDestroy).toBe(0);
    expect(beforeDestroy).toBe(1);
  });

  test("destroy is idempotent and does not throw when called twice", () => {
    const store = register();
    expect(() => {
      store.destroy();
      store.destroy();
    }).not.toThrow();
  });

  test("other store members stay callable after destroy", () => {
    const store = register();
    store.register("k", () => undefined, { id: "before" });
    expect(store.commands).toHaveLength(1);

    store.destroy();

    // Scope state survives teardown...
    expect(store.activeScopes).toEqual(["default"]);
    expect(store.isScopeActive("default")).toBe(true);
    expect(store.isScopeSuspended("default")).toBe(false);
    // ...but the registry is released: `commands` is now empty. This is a
    // meaningful post-destroy value, not a convenient one.
    expect(store.commands).toHaveLength(0);
  });
});

/** Dispatch a keydown carrying explicit modifier state. */
function pressMod(init: KeyboardEventInit): void {
  window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ...init }));
}

/**
 * `mod` is the platform's primary modifier: Cmd on macOS, Ctrl elsewhere.
 * The controller's `isMacHint` is the only way to pin that, so these cases
 * live at the controller level: the plugin constructs the controller with no
 * hint, so it cannot express "the other platform".
 */
describe("mod shortcut platform resolution", () => {
  const controllers: KeyboardController[] = [];

  function makeController(onMac: boolean): KeyboardController {
    const controller = new KeyboardController({}, onMac);
    controller.mount();
    controllers.push(controller);
    return controller;
  }

  afterEach(() => {
    for (const c of controllers.splice(0)) c.destroy();
  });

  test("mod+s matches Cmd+S on a mac controller", () => {
    const controller = makeController(true);
    let runs = 0;
    controller.register("mod+s", () => {
      runs += 1;
    });

    pressMod({ key: "s", metaKey: true });
    expect(runs).toBe(1);
  });

  test("mod+s matches Ctrl+S on a non-mac controller", () => {
    const controller = makeController(false);
    let runs = 0;
    controller.register("mod+s", () => {
      runs += 1;
    });

    pressMod({ key: "s", ctrlKey: true });
    expect(runs).toBe(1);
  });

  test("mod+s on a mac controller does not match Ctrl+S or Ctrl+Cmd+S", () => {
    const controller = makeController(true);
    let runs = 0;
    controller.register("mod+s", () => {
      runs += 1;
    });

    pressMod({ key: "s", ctrlKey: true });
    expect(runs).toBe(0);

    pressMod({ key: "s", ctrlKey: true, metaKey: true });
    expect(runs).toBe(0);
  });

  test("mod+s on a non-mac controller does not match Ctrl+Shift+S", () => {
    const controller = makeController(false);
    let runs = 0;
    controller.register("mod+s", () => {
      runs += 1;
    });

    pressMod({ key: "s", ctrlKey: true, shiftKey: true });
    expect(runs).toBe(0);
  });

  test("explicit cmd+s keeps its platform-independent meaning", () => {
    const mac = makeController(true);
    let macRuns = 0;
    mac.register("cmd+s", () => {
      macRuns += 1;
    });

    pressMod({ key: "s", metaKey: true });
    expect(macRuns).toBe(1);

    pressMod({ key: "s", ctrlKey: true });
    expect(macRuns).toBe(1);
  });

  test("explicit ctrl+s keeps its platform-independent meaning", () => {
    const other = makeController(false);
    let otherRuns = 0;
    other.register("ctrl+s", () => {
      otherRuns += 1;
    });

    pressMod({ key: "s", ctrlKey: true });
    expect(otherRuns).toBe(1);

    pressMod({ key: "s", metaKey: true });
    expect(otherRuns).toBe(1);
  });

  test("a mod+s registration still reports the shortcut as mod+s", () => {
    const controller = makeController(true);
    controller.register("mod+s", () => undefined, { id: "save" });

    expect(controller.commands.map((c) => c.shortcut)).toEqual(["mod+s"]);
  });

  test("guard: a sequence whose chords use mod matches its buffer on both platforms", () => {
    const mac = makeController(true);
    let macRuns = 0;
    mac.register("g mod+s", () => {
      macRuns += 1;
    });

    pressMod({ key: "g" });
    pressMod({ key: "s", metaKey: true });
    expect(macRuns).toBe(1);

    const other = makeController(false);
    let otherRuns = 0;
    other.register("g mod+s", () => {
      otherRuns += 1;
    });

    pressMod({ key: "g" });
    pressMod({ key: "s", ctrlKey: true });
    expect(otherRuns).toBe(1);

    // ...and the wrong modifier still does not complete the sequence.
    pressMod({ key: "g" });
    pressMod({ key: "s", ctrlKey: true, shiftKey: true });
    expect(otherRuns).toBe(1);
    expect(macRuns).toBe(1);
  });
});

describe("mod shortcut through the real plugin (environment platform)", () => {
  beforeAll(() => {
    start(() => {});
  });

  beforeEach(() => {
    keyboardPlugin()(Alpine as unknown as import("alpinejs").Alpine);
    resume();
  });

  afterEach(() => {
    reset();
    clearAllSingletons();
  });

  test("mod+q fires for the environment's primary modifier", () => {
    // Registered through the real Alpine store so the plugin wiring is
    // exercised. The plugin passes no `isMacHint`, so the event must carry
    // whichever modifier this environment reports as primary.
    const keyboardStore = (Alpine as unknown as import("alpinejs").Alpine).store(
      "keyboard"
    ) as KeyboardStore;
    let runs = 0;
    keyboardStore.register(
      "mod+q",
      () => {
        runs += 1;
      },
      { id: "primary" }
    );

    const onMac = window.navigator.platform.toLowerCase().includes("mac");
    pressMod(onMac ? { key: "q", metaKey: true } : { key: "q", ctrlKey: true });
    expect(runs).toBe(1);
  });
});
