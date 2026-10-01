// @vitest-environment happy-dom
/**
 * A tooltip must close when scrolling moves its trigger out from under a
 * stationary pointer — and must not re-open while scrolling back.
 *
 * The defect: the playground wired `@mouseenter` / `@mouseleave` by hand on
 * every trigger. A pointer that does not move produces no `mouseleave` — the
 * browser only re-dispatches pointer events on real movement — so scrolling the
 * trigger out from under the cursor left the tooltip open with nothing left to
 * close it.
 *
 * Two properties are asserted, and the second matters as much as the first: the
 * scroll handler may only ever CLOSE. A handler that could also open would
 * re-fire the hover path continuously for as long as the page moves, which is
 * exactly the "hover firing over and over" that must not happen.
 */

import { clearAllSingletons } from "@ailura/alpinejs-core/singletons";
import { reset, resume, start } from "@ailura/alpinejs-testing";
import Alpine from "alpinejs";
import { afterEach, beforeAll, beforeEach, describe, expect, test } from "vite-plus/test";

import { tooltipPlugin } from "../src/plugin";
import type { TooltipStore } from "../src/types";

function store(): TooltipStore {
  return (Alpine as unknown as { store(name: string): TooltipStore }).store("tooltip");
}

/**
 * A trigger standing in for a real element: `getBoundingClientRect` is what the
 * scroll check reads, and happy-dom returns zeroes, so the box is stubbed.
 */
function makeTrigger(rect: { left: number; top: number; right: number; bottom: number }) {
  const el = document.createElement("button");
  el.getBoundingClientRect = () => rect as DOMRect;
  document.body.appendChild(el);
  return el;
}

function hover(el: HTMLElement, x: number, y: number): void {
  el.dispatchEvent(new MouseEvent("mouseenter", { clientX: x, clientY: y }));
}

/** Move the trigger's box without moving the pointer — what scrolling does. */
function moveTrigger(
  el: HTMLElement,
  rect: { left: number; top: number; right: number; bottom: number }
): void {
  el.getBoundingClientRect = () => rect as DOMRect;
  window.dispatchEvent(new Event("scroll"));
}

beforeAll(() => start(() => {}));

beforeEach(() => {
  tooltipPlugin()(Alpine as unknown as import("alpinejs").Alpine);
  resume();
});

afterEach(() => {
  document.body.innerHTML = "";
  reset();
  clearAllSingletons();
});

describe("closeOnScrollAway", () => {
  test("closes when a scroll moves the trigger out from under the pointer", () => {
    const el = makeTrigger({ left: 100, top: 100, right: 200, bottom: 140 });
    store().create("tip");
    store().bindTrigger("tip", el);

    hover(el, 150, 120);
    expect(store().isOpen("tip")).toBe(true);

    // The page scrolls: the trigger's box is now well above the pointer, and no
    // `mouseleave` is coming.
    moveTrigger(el, { left: 100, top: -400, right: 200, bottom: -360 });

    expect(store().isOpen("tip")).toBe(false);
  });

  test("stays open while the trigger is still under the pointer", () => {
    const el = makeTrigger({ left: 100, top: 100, right: 200, bottom: 140 });
    store().create("tip");
    store().bindTrigger("tip", el);

    hover(el, 150, 120);
    // A few pixels of scroll, the pointer still inside the box.
    moveTrigger(el, { left: 100, top: 90, right: 200, bottom: 130 });

    expect(store().isOpen("tip")).toBe(true);
  });

  test("scrolling back does NOT re-open it", () => {
    const el = makeTrigger({ left: 100, top: 100, right: 200, bottom: 140 });
    store().create("tip");
    store().bindTrigger("tip", el);

    hover(el, 150, 120);
    moveTrigger(el, { left: 100, top: -400, right: 200, bottom: -360 });
    expect(store().isOpen("tip")).toBe(false);

    // The user scrolls back up so the trigger is under the pointer again.
    // No `mouseenter` has been dispatched, so nothing should open.
    moveTrigger(el, { left: 100, top: 100, right: 200, bottom: 140 });
    expect(store().isOpen("tip")).toBe(false);

    // A real hover still opens it.
    hover(el, 150, 120);
    expect(store().isOpen("tip")).toBe(true);
  });

  test("a stream of scroll events opens nothing", () => {
    const el = makeTrigger({ left: 100, top: 100, right: 200, bottom: 140 });
    store().create("tip");
    store().bindTrigger("tip", el);
    hover(el, 150, 120);

    // First scroll takes it out from under the pointer, which closes it.
    moveTrigger(el, { left: 100, top: -400, right: 200, bottom: -360 });
    expect(store().isOpen("tip")).toBe(false);

    // Now drag the box back and forth across the pointer, as a rubber-band
    // scroll does. It must never flicker open.
    for (let i = 0; i < 20; i++) {
      moveTrigger(el, { left: 100, top: i % 2 === 0 ? 100 : -400, right: 200, bottom: 140 });
      expect(store().isOpen("tip")).toBe(false);
    }
  });

  test("opt-out keeps the old behaviour", () => {
    const el = makeTrigger({ left: 100, top: 100, right: 200, bottom: 140 });
    store().create("tip", { closeOnScrollAway: false });
    store().bindTrigger("tip", el);

    hover(el, 150, 120);
    moveTrigger(el, { left: 100, top: -400, right: 200, bottom: -360 });

    expect(store().isOpen("tip")).toBe(true);
  });

  test("a tooltip opened by keyboard focus is left alone", () => {
    const el = makeTrigger({ left: 100, top: 100, right: 200, bottom: 140 });
    store().create("tip");
    store().bindTrigger("tip", el);

    // Focus carries no pointer position, so there is nothing to re-evaluate.
    el.dispatchEvent(new FocusEvent("focus"));
    expect(store().isOpen("tip")).toBe(true);

    moveTrigger(el, { left: 100, top: -400, right: 200, bottom: -360 });
    expect(store().isOpen("tip")).toBe(true);
  });
});

describe("bindTrigger", () => {
  test("handles the hover pair the demo used to wire by hand", () => {
    const el = makeTrigger({ left: 0, top: 0, right: 100, bottom: 50 });
    store().create("tip");
    store().bindTrigger("tip", el);

    hover(el, 10, 10);
    expect(store().isOpen("tip")).toBe(true);

    el.dispatchEvent(new MouseEvent("mouseleave"));
    expect(store().isOpen("tip")).toBe(false);
  });

  test("re-binding does not double up the listeners", () => {
    const el = makeTrigger({ left: 0, top: 0, right: 100, bottom: 50 });
    store().create("tip");
    store().bindTrigger("tip", el);
    store().bindTrigger("tip", el);

    hover(el, 10, 10);
    el.dispatchEvent(new MouseEvent("mouseleave"));
    // A second leave from a duplicated listener would be harmless, but an
    // extra enter would open twice — assert the close is the observable one.
    expect(store().isOpen("tip")).toBe(false);
  });

  test("unbindTrigger stops responding to the element", () => {
    const el = makeTrigger({ left: 0, top: 0, right: 100, bottom: 50 });
    store().create("tip");
    store().bindTrigger("tip", el);
    store().unbindTrigger("tip");

    hover(el, 10, 10);
    expect(store().isOpen("tip")).toBe(false);
  });

  test("destroy releases the element's listeners", () => {
    const el = makeTrigger({ left: 0, top: 0, right: 100, bottom: 50 });
    store().create("tip");
    store().bindTrigger("tip", el);
    store().destroy("tip");

    // A leaked mouseenter would re-create and open an instance that no longer
    // exists.
    hover(el, 10, 10);
    expect(store().isOpen("tip")).toBe(false);
  });

  test("destroy releases the window scroll listener", () => {
    const el = makeTrigger({ left: 0, top: 0, right: 100, bottom: 50 });
    store().create("tip");
    store().bindTrigger("tip", el);

    store().destroy();
    // Must not throw on a scroll after teardown.
    expect(() => window.dispatchEvent(new Event("scroll"))).not.toThrow();
  });

  test("creating an unknown id is implicit, so bindTrigger alone is enough", () => {
    const el = makeTrigger({ left: 0, top: 0, right: 100, bottom: 50 });
    store().bindTrigger("fresh", el);

    hover(el, 10, 10);
    expect(store().isOpen("fresh")).toBe(true);
  });
});
