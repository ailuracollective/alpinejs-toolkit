// @vitest-environment happy-dom
/**
 * `x-carousel` creating the instance, and `x-carousel.viewport` not doing so.
 *
 * The directive existed but only *bound* a viewport, so a caller still had to
 * create the instance first — and because the binding then had to reach a
 * descendant, the playground carried a 13-line helper doing `create()`,
 * `querySelector`, and a double `$nextTick` to wait for the descendant to exist.
 * Ten carousels, ten calls to that helper.
 *
 * Reading the options from the expression is what removes it, so this file
 * covers the creation path and the opt-out.
 */
import { html, mount, reset, resume, settled, start } from "@ailura/alpinejs-testing";
import Alpine from "alpinejs";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vite-plus/test";

import { carouselPlugin } from "../src/plugin";
import type { CarouselStore } from "../src/types";

vi.mock("embla-carousel", () => ({
  default: () => ({
    destroy: vi.fn(),
    on: vi.fn(),
    selectedScrollSnap: () => 0,
    scrollSnapList: () => [0],
    scrollProgress: () => 0,
    canScrollNext: () => false,
    canScrollPrev: () => false,
    canScrollTo: () => false,
    scrollTo: vi.fn(),
    plugins: () => ({}),
  }),
}));

vi.mock("embla-carousel-autoplay", () => ({
  default: () => ({}),
}));

function store(): CarouselStore {
  return (Alpine as unknown as { store(name: string): CarouselStore }).store("carousel");
}

/** The engine is built behind a dynamic import, so drain microtasks. */
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
});

afterEach(() => {
  reset();
});

describe("x-carousel instance creation", () => {
  test("creates the instance from a quoted id alone", async () => {
    const root = html(`<div x-data><div id="vp" x-carousel="'solo'"><span>s</span></div></div>`);
    mount(root);
    await flushEngine();

    // No separate `create()` call, and no `$nextTick` wait: the directive runs
    // on the viewport itself.
    expect(store().instances["solo"]).toBeDefined();
  });

  test("reads options from an object expression", async () => {
    const root = html(
      `<div x-data><div id="vp" x-carousel="{ id: 'looped', loop: true }"><span>s</span></div></div>`
    );
    mount(root);
    await flushEngine();

    expect(store().instances["looped"]?.options?.loop).toBe(true);
  });

  test("an unquoted expression still resolves a variable", async () => {
    // The default stays "this is an expression": `x-carousel="id"` with `id` in
    // scope is ordinary markup, and reading it as the id `"id"` would silently
    // bind the wrong carousel.
    const root = html(`<div x-data="{ id: 'named' }"><div id="vp" x-carousel="id"></div></div>`);
    mount(root);
    await flushEngine();

    expect(store().instances["named"]).toBeDefined();
    expect(store().instances["id"]).toBeUndefined();
  });

  test(".viewport binds without creating, for an instance made elsewhere", async () => {
    const root = html(
      `<div x-data><div id="vp" x-carousel.viewport="'made-elsewhere'"></div></div>`
    );
    mount(root);
    await settled();
    store().create("made-elsewhere");
    await flushEngine();

    expect(store().instances["made-elsewhere"]).toBeDefined();
    expect(store().instances["made-elsewhere"]?.currentIndex).toBe(0);
  });

  test(".viewport does not override the options of an existing instance", async () => {
    // `.viewport` means "bind only". `bindViewport` still creates the instance if
    // it is missing — that is the controller's own behaviour and it predates the
    // directive — but the point of the modifier is that the *options* come from
    // wherever the instance was made, not from the attribute.
    const root = html(
      `<div x-data>
         <div id="vp" x-carousel.viewport="{ id: 'preset', loop: true }"></div>
       </div>`
    );
    mount(root);
    await flushEngine();

    store().create("preset", { loop: false, axis: "y" });
    await flushEngine();

    expect(store().instances["preset"]?.options?.axis).toBe("y");
    expect(store().instances["preset"]?.options?.loop).toBe(false);
  });

  test("releases the engine when Alpine removes the viewport", async () => {
    const root = html(`<div x-data><div id="vp" x-carousel="'gone'"><span>s</span></div></div>`);
    mount(root);
    await flushEngine();
    expect(store().instances["gone"]).toBeDefined();

    root.querySelector("#vp")?.remove();
    await flushEngine();

    // The instance survives so its controls keep working; only the element
    // binding went away.
    expect(store().instances["gone"]).toBeDefined();
  });
});
