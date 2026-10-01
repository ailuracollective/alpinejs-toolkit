// @vitest-environment happy-dom
/**
 * Tests for the `bridge` module.
 *
 * `bridgeControllerDirective` is the only export left here: a directive's
 * teardown is wired to Alpine's `cleanup()` utility, so the teardown is
 * element-bound and Alpine really invokes it when the element leaves the
 * tree. The DOM tests below use the real Alpine + `@ailura/alpinejs-testing`
 * harness for that reason; the guard/collision tests use the same minimal
 * Alpine double as the other core unit tests.
 */
import "@testing-library/jest-dom/vitest";
import { html, mount, reset, resume, settled, start } from "@ailura/alpinejs-testing";
import { createMockAlpine } from "@ailura/alpinejs-testing/mock";
import Alpine from "alpinejs";
import { afterEach, beforeAll, beforeEach, describe, expect, test } from "vite-plus/test";

import * as bridge from "../src/bridge";
import { BaseController, RegistrationError, bridgeControllerDirective } from "../src/index";

class BridgeController extends BaseController {
  destroys = 0;
  protected override teardown(): void {
    this.destroys += 1;
  }
}

beforeAll(() => {
  start(() => {});
});

beforeEach(() => {
  resume();
});

afterEach(() => {
  reset();
});

describe("bridge surface", () => {
  test("exports only the directive bridge", () => {
    // A store registration has no Alpine-invoked teardown in Alpine 3.17:
    // `plugin()` discards its callback's return value and there is no
    // `cleanup`/`stop()` on the Alpine object, so a store `dispose()` could
    // never be called by the runtime.
    expect(bridge).not.toHaveProperty("bridgeControllerStore");
    expect(bridge.bridgeControllerDirective).toBeTypeOf("function");
  });
});

describe("bridgeControllerDirective (guard)", () => {
  test("registers the directive through the guard", () => {
    const { alpine, directives } = createMockAlpine();
    const callback = (el: Element) => {
      el.textContent = (el.textContent ?? "").toUpperCase();
    };
    bridgeControllerDirective({
      alpine,
      directiveKey: "upper",
      directive: callback,
      packageName: "pkg-a",
    });
    expect(directives.get("upper")).toBe(callback);
  });

  test("teardown drains event cleanups, DOM cleanups and the controller once", () => {
    const { alpine } = createMockAlpine();
    const order: string[] = [];
    const controller = new BridgeController();
    controller.mount();
    const teardown = bridgeControllerDirective({
      alpine,
      directiveKey: "ordered",
      directive: () => {},
      packageName: "pkg-a",
      controller,
      eventCleanups: [
        () => {
          order.push("event-1");
        },
        () => {
          order.push("event-2");
        },
      ],
      domCleanups: [
        () => {
          order.push("dom-1");
        },
        () => {
          order.push("dom-2");
        },
      ],
    });

    teardown();
    expect(order).toEqual(["event-2", "event-1", "dom-2", "dom-1"]);
    expect(controller.lifecycle).toBe("destroyed");
    expect(controller.destroys).toBe(1);

    // A repeated teardown is a no-op, not an error.
    expect(() => {
      teardown();
      teardown();
    }).not.toThrow();
    expect(order).toEqual(["event-2", "event-1", "dom-2", "dom-1"]);
    expect(controller.destroys).toBe(1);
  });

  test("teardown works without a controller", () => {
    const { alpine } = createMockAlpine();
    const order: string[] = [];
    const teardown = bridgeControllerDirective({
      alpine,
      directiveKey: "no-controller",
      directive: () => {},
      packageName: "pkg-a",
      eventCleanups: [
        () => {
          order.push("event");
        },
      ],
    });
    expect(() => teardown()).not.toThrow();
    expect(order).toEqual(["event"]);
  });

  test("collides with another package; the same package may re-register", () => {
    const { alpine, directives } = createMockAlpine();
    const first = () => {};
    const second = () => {};
    bridgeControllerDirective({
      alpine,
      directiveKey: "shared",
      directive: first,
      packageName: "pkg-a",
    });
    bridgeControllerDirective({
      alpine,
      directiveKey: "shared",
      directive: second,
      packageName: "pkg-a",
    });
    expect(directives.get("shared")).toBe(second);

    let thrown: unknown;
    try {
      bridgeControllerDirective({
        alpine,
        directiveKey: "shared",
        directive: first,
        packageName: "pkg-b",
      });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(RegistrationError);
    expect((thrown as RegistrationError).registrationName).toBe("shared");
    // A failed registration must not take over the directive.
    expect(directives.get("shared")).toBe(second);
  });
});

describe("bridgeControllerDirective (Alpine integration)", () => {
  test("the teardown actually runs when Alpine removes the element", async () => {
    const controller = new BridgeController();
    controller.mount();
    const order: string[] = [];
    const teardown = bridgeControllerDirective({
      alpine: Alpine,
      directiveKey: "core-bridge-probe",
      // The working reference (packages/gesture/src/plugin.ts): the returned
      // teardown is handed to Alpine's `cleanup()` utility, which Alpine
      // drains when the element leaves the tree.
      directive: (_el, _directive, { cleanup }) => {
        cleanup(teardown);
      },
      packageName: "core-bridge",
      controller,
      eventCleanups: [
        () => {
          order.push("event");
        },
      ],
      domCleanups: [
        () => {
          order.push("dom");
        },
      ],
    });

    const root = html("<div x-data><span x-core-bridge-probe>probe</span></div>");
    mount(root);
    await settled();
    expect(controller.lifecycle).toBe("mounted");
    expect(order).toEqual([]);

    // Alpine observes document.body: removing the element makes
    // `cleanupElement` drain `el._x_cleanups`, which invokes the teardown.
    const probe = root.querySelector("span");
    expect(probe).not.toBeNull();
    probe?.remove();
    await settled();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await settled();

    expect(order).toEqual(["event", "dom"]);
    expect(controller.lifecycle).toBe("destroyed");
    expect(controller.destroys).toBe(1);
  });

  test("the registered directive runs on a real element", async () => {
    bridgeControllerDirective({
      alpine: Alpine,
      directiveKey: "core-bridge-upper",
      directive: (el) => {
        el.textContent = (el.textContent ?? "").toUpperCase();
      },
      packageName: "core-bridge",
    });

    mount(html("<div x-data><span x-core-bridge-upper>hello</span></div>"));
    await settled();

    expect(document.body.textContent).toContain("HELLO");
  });
});
