// @vitest-environment happy-dom
/**
 * The `$notify` magic must actually be reactive.
 *
 * The defect this pins: the plugin handed `injectMagics` a factory instance
 * whose `isSupported` / `permission` / `requiresHomeScreenInstall` were plain
 * getters. `injectMagics` does not wrap a magic's return value in `reactive()`,
 * so a template read tracked only the never-changing `$notify` key of Alpine's
 * data proxy. The user clicked `requestPermission()`, granted the browser
 * prompt, and the readout stayed on `default` while the real
 * `Notification.permission` was already `granted` — and the `send()` button,
 * which is gated on `permission === 'granted'`, never appeared.
 *
 * The assertions read rendered text after a real click, so they fail against a
 * magic that is merely *correct* but not reactive.
 */

import { clearAllSingletons } from "@ailura/alpinejs-core/singletons";
import { html, mount, reset, resume, settled, start } from "@ailura/alpinejs-testing";
import Alpine from "alpinejs";
import { afterEach, beforeAll, beforeEach, describe, expect, test } from "vite-plus/test";

import { notifyPlugin } from "../src/plugin";

/** What `Notification.requestPermission()` will answer with. */
let answer: NotificationPermission = "granted";
let originalNotification: PropertyDescriptor | undefined;

beforeAll(() => start(() => {}));

beforeEach(() => {
  answer = "granted";
  originalNotification = Object.getOwnPropertyDescriptor(globalThis, "Notification");
  class FakeNotification {
    static permission: NotificationPermission = "default";
    static requestPermission = (): Promise<NotificationPermission> => {
      // The browser actually flips its own state when the prompt is granted.
      FakeNotification.permission = answer;
      return Promise.resolve(answer);
    };
    constructor(public title: string) {}
  }
  Object.defineProperty(globalThis, "Notification", {
    configurable: true,
    writable: true,
    value: FakeNotification,
  });
  notifyPlugin()(Alpine as unknown as import("alpinejs").Alpine);
  resume();
});

afterEach(() => {
  reset();
  clearAllSingletons();
  Reflect.deleteProperty(globalThis, "Notification");
  if (originalNotification) {
    Object.defineProperty(globalThis, "Notification", originalNotification);
  }
});

function text(testid: string): string {
  return document.querySelector(`[data-testid="${testid}"]`)?.textContent ?? "";
}

describe("$notify reactivity", () => {
  test("granting permission re-renders $notify.permission", async () => {
    mount(
      html(`<div>
        <span data-testid="perm" x-text="String($notify.permission)"></span>
        <button data-testid="go" @click="$notify.requestPermission()">request</button>
      </div>`)
    );
    await settled();
    expect(text("perm")).toBe("default");

    document.querySelector<HTMLButtonElement>('[data-testid="go"]')?.click();
    await settled();

    // Before the fix this stayed "default" while the real permission was
    // "granted" — the demo's primary flow was a dead end.
    expect(text("perm")).toBe("granted");
  });

  test("a denial re-renders too", async () => {
    answer = "denied";
    mount(
      html(`<div>
        <span data-testid="perm" x-text="String($notify.permission)"></span>
        <button data-testid="go" @click="$notify.requestPermission()">request</button>
      </div>`)
    );
    await settled();

    document.querySelector<HTMLButtonElement>('[data-testid="go"]')?.click();
    await settled();

    expect(text("perm")).toBe("denied");
  });

  test("a permission changed in browser settings is picked up on focus", async () => {
    mount(html(`<div><span data-testid="perm" x-text="String($notify.permission)"></span></div>`));
    await settled();
    expect(text("perm")).toBe("default");

    // The user grants it in the browser's own settings while the tab is open.
    (globalThis as unknown as { Notification: { permission: string } }).Notification.permission =
      "granted";
    window.dispatchEvent(new Event("focus"));
    await settled();

    expect(text("perm")).toBe("granted");
  });

  test("isSupported is present before any interaction", async () => {
    mount(html(`<div><span data-testid="sup" x-text="String($notify.isSupported)"></span></div>`));
    await settled();
    expect(text("sup")).toBe("true");
  });

  test("the host-owned teardown handle survives the reactive wrap", async () => {
    mount(html(`<div><span data-testid="d" x-text="typeof $notify.destroy"></span></div>`));
    await settled();
    expect(text("d")).toBe("function");
  });
});
