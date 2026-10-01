// @vitest-environment happy-dom
import "@testing-library/jest-dom/vitest";
import { html, mount, reset, resume, settled, start } from "@ailura/alpinejs-testing";
import { screen } from "@testing-library/dom";
import Alpine from "alpinejs";
import { beforeAll, beforeEach, afterEach, describe, expect, test } from "vite-plus/test";

import {
  BaseController,
  RegistrationError,
  bridgeControllerDirective,
  guardDirective,
  guardStore,
  isBrowser,
  safeDocument,
} from "../src/index";

class DomController extends BaseController {
  destroys = 0;
  protected override teardown(): void {
    this.destroys += 1;
  }
}

/** Core ships no `alpine.d.ts` of its own, so name lookups stay `unknown` here. */
function testStore(name: string): { count: number } {
  return Alpine.store(name) as { count: number };
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

describe("core env (happy-dom)", () => {
  test("detects a browser-like environment", () => {
    expect(isBrowser()).toBe(true);
    expect(safeDocument()).toBe(document);
  });
});

describe("core guards (Alpine integration)", () => {
  test("guardStore registers a store and returns its proxy", async () => {
    const store = guardStore(Alpine, "coreDomStore", { count: 0 }, "core-dom");
    expect(store).toEqual({ count: 0 });

    mount(html('<div x-data><span x-text="String($store.coreDomStore.count)"></span></div>'));
    await settled();

    expect(screen.getByText("0")).toBeInTheDocument();
  });

  test("a rival package colliding on a store throws and keeps the owner value", async () => {
    guardStore(Alpine, "coreOwnedStore", { count: 1 }, "owner-pkg");

    let thrown: unknown;
    try {
      guardStore(Alpine, "coreOwnedStore", { count: 99 }, "rival-pkg");
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(RegistrationError);
    expect((thrown as RegistrationError).registrationName).toBe("coreOwnedStore");

    mount(html('<div x-data><span x-text="String($store.coreOwnedStore.count)"></span></div>'));
    await settled();

    expect(testStore("coreOwnedStore").count).toBe(1);
    expect(screen.getByText("1")).toBeInTheDocument();
  });
});

describe("core bridges (Alpine integration)", () => {
  test("bridgeControllerDirective registers a working directive", async () => {
    const controller = new DomController();
    controller.mount();
    const dispose = bridgeControllerDirective({
      alpine: Alpine,
      directiveKey: "core-upper",
      directive: (el) => {
        el.textContent = (el.textContent ?? "").toUpperCase();
      },
      packageName: "core-dom",
      controller,
    });

    mount(html("<div x-data><span x-core-upper>hello</span></div>"));
    await settled();

    expect(screen.getByText("HELLO")).toBeInTheDocument();
    dispose();
    expect(controller.lifecycle).toBe("destroyed");
  });

  test("camelCase and kebab-case directive registrations behave identically", async () => {
    const shout = (el: Element) => {
      el.textContent = `${el.textContent ?? ""}!`;
    };
    // `myDirective` normalizes to `my-directive`: without normalization this
    // registration would silently never match the `x-core-shout` markup.
    guardDirective(Alpine, "coreShout", shout, "core-dom");
    guardDirective(Alpine, "core-shout-alias", shout, "core-dom");

    mount(
      html("<div x-data><span x-core-shout>camel</span><span x-core-shout-alias>kebab</span></div>")
    );
    await settled();

    expect(screen.getByText("camel!")).toBeInTheDocument();
    expect(screen.getByText("kebab!")).toBeInTheDocument();
  });
});
