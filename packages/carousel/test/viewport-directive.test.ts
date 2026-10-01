// @vitest-environment happy-dom
/**
 * `x-carousel` — the Alpine-invoked teardown for a carousel viewport.
 *
 * Alpine 3.17 gives a plugin no teardown of its own: `plugin()` discards the
 * callback's return value and the Alpine object exposes no `cleanup`/`stop()`.
 * A directive's `cleanup(cb)` is the only mechanism the runtime actually
 * invokes, queued in `el._x_cleanups` and drained by `cleanupElement` when the
 * element leaves the tree. These tests therefore prove the release through a
 * real element removal against a real Alpine instance, exactly like
 * `packages/core/test/bridge.test.ts` and `packages/gesture/`.
 *
 * The observable is the Embla engine itself: `embla-carousel` is stubbed so
 * the test can count `destroy()` calls, because the controller loads it
 * through a dynamic import and a real Embla needs layout this DOM does not
 * have. Everything on the path under test — the directive, the expression
 * evaluation, `bindViewport`, the release, and Alpine's `cleanupElement` — is
 * the production code.
 */
import { html, mount, reset, resume, settled, start } from "@ailura/alpinejs-testing";
import Alpine, { type Alpine as AlpineInstance } from "alpinejs";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vite-plus/test";

import { carouselPlugin } from "../src/plugin";
import type { CarouselStore } from "../src/types";

/** One entry per Embla engine the controller created. */
const engines: Array<{ el: HTMLElement; destroy: ReturnType<typeof vi.fn> }> = [];

vi.mock("embla-carousel", () => ({
  default: (el: HTMLElement) => {
    const destroy = vi.fn();
    engines.push({ el, destroy });
    return {
      destroy,
      on: vi.fn(),
      selectedScrollSnap: () => 0,
      scrollSnapList: () => [0],
      scrollProgress: () => 0,
      canScrollNext: () => false,
      canScrollPrev: () => false,
      slidesInView: () => [],
      scrollNext: vi.fn(),
      scrollPrev: vi.fn(),
      scrollTo: vi.fn(),
      plugins: () => ({}),
    };
  },
}));

function store(): CarouselStore {
  return (Alpine as unknown as { store(name: string): CarouselStore }).store("carousel");
}

/** `bindViewport` builds its Embla engine behind a dynamic import. */
async function flushEngine(): Promise<void> {
  await settled();
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
  await settled();
}

beforeAll(() => {
  start(carouselPlugin());
});

beforeEach(() => {
  resume();
  engines.length = 0;
});

afterEach(() => {
  reset();
});

describe("x-carousel directive", () => {
  test("binds the viewport element to the instance named in the expression", async () => {
    const root = html(
      '<div x-data><div id="viewport" x-carousel="\'hero\'"><span>slide</span></div></div>'
    );
    mount(root);
    await flushEngine();

    expect(engines.length).toBe(1);
    expect(engines[0]?.el).toBe(root.querySelector("#viewport"));
    expect(engines[0]?.destroy).not.toHaveBeenCalled();
  });

  test("releases the Embla engine when Alpine removes the viewport element", async () => {
    const root = html(
      '<div x-data><div id="viewport" x-carousel="\'gone\'"><span>slide</span></div></div>'
    );
    mount(root);
    await flushEngine();
    expect(engines.length).toBe(1);

    root.querySelector("#viewport")?.remove();
    await settled();
    await flushEngine();

    expect(engines[0]?.destroy).toHaveBeenCalledTimes(1);
  });

  test("the release unbinds the viewport but keeps the instance usable", async () => {
    const root = html(
      '<div x-data><div id="viewport" x-carousel="\'kept\'"><span>slide</span></div></div>'
    );
    mount(root);
    await flushEngine();

    root.querySelector("#viewport")?.remove();
    await flushEngine();

    // Element-owned resources are gone, the instance is not: the store method
    // path still works and a new viewport can be bound by hand.
    expect(store().instances.kept).toBeDefined();
    expect(() => store().create("kept", { loop: true })).not.toThrow();
    expect(store().instances.kept).toBeDefined();

    const fresh = document.createElement("div");
    store().bindViewport("kept", fresh);
    await flushEngine();
    expect(engines.length).toBe(2);
    expect(engines[1]?.el).toBe(fresh);
  });

  test("the hand-written store method is unchanged", async () => {
    const root = html(
      "<div x-data x-init=\"$store.carousel.create('manual', { loop: true })\">" +
        '<div id="viewport"><span>slide</span></div>' +
        "</div>"
    );
    mount(root);
    await settled();

    const viewport = root.querySelector("#viewport") as HTMLElement;
    store().bindViewport("manual", viewport);
    await flushEngine();

    expect(engines.length).toBe(1);
    expect(engines[0]?.el).toBe(viewport);
    expect(engines[0]?.destroy).not.toHaveBeenCalled();
  });

  test("an absent id is generated rather than leaving the directive inert", async () => {
    const root = html('<div x-data="{ id: null }"><div id="viewport" x-carousel="id"></div></div>');
    mount(root);
    await flushEngine();

    // Under the instantiation canon the id is optional and generated when
    // missing, so `x-carousel="id"` with a null id is a working carousel rather
    // than a directive that silently binds nothing.
    const viewport = root.querySelector("#viewport") as HTMLElement;
    const generated = viewport.getAttribute("data-carousel-id");
    expect(generated).toBeTruthy();
    expect(Object.keys(store().instances)).toContain(generated);
    expect(store().instances[generated as string]).toBeDefined();
    expect(engines.length).toBe(1);

    // Removing such an element is not an error, and its id leaves the registry.
    viewport.remove();
    await flushEngine();
    expect(() => store().instances[generated as string]).not.toThrow();
  });

  test("the directive name is configurable", async () => {
    const other = html("<div x-data><div x-carousel-viewport=\"'custom'\"></div></div>");
    mount(other);
    await settled();
    // The default `x-carousel` key must not answer to a different attribute.
    expect(engines.length).toBe(0);

    // A separate store key keeps the default registration untouched.
    carouselPlugin({ directiveKey: "carouselViewport", storeKey: "carousel-alt" })(
      Alpine as unknown as AlpineInstance
    );
    const custom = html("<div x-data><div x-carousel-viewport=\"'custom'\"></div></div>");
    mount(custom);
    await flushEngine();
    expect(engines.length).toBe(1);
  });
});
