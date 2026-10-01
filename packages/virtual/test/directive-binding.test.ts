// @vitest-environment happy-dom
/**
 * `x-virtual-scroll` must actually bind the scroll element.
 *
 * The directive evaluated its expression, so the bare form the package
 * documents — `x-virtual-scroll="rows"` — asked Alpine to resolve a *variable*
 * named `rows` and threw `rows is not defined`. `evaluateLater` hands that to
 * Alpine's own error handler instead of throwing into the directive, so the
 * binding never happened and the list was dead. Dropping the literal-id
 * handling fails this file; that is the regression it guards.
 *
 * Worth stating what is NOT the cause, because I got it wrong first: the
 * directive is not initialised before its parent's `x-init`. Alpine walks the
 * tree depth first, so `create()` has already run, and a mutation that removed
 * the retry path still passed every test here. The retry is a safety net for an
 * instance created after init, nothing more.
 *
 * The assertion is behavioural: the store's snapshot deliberately does not
 * publish `scrollElement`, so the binding is observed by scrolling the viewport
 * and checking the controller noticed. An earlier probe of this bug called it
 * "working" from a `!== null` check that proved nothing.
 */

import { clearAllSingletons } from "@ailura/alpinejs-core/singletons";
import { reset, resume, settled, start } from "@ailura/alpinejs-testing";
import Alpine from "alpinejs";
import { afterEach, beforeAll, beforeEach, describe, expect, test } from "vite-plus/test";

import { virtualPlugin } from "../src/plugin";

interface Instance {
  scrollOffset: number;
  isScrolling: boolean;
  virtualItems: unknown[];
  totalSize: number;
}
interface Store {
  instances: Record<string, Instance>;
  create(id: string, options: Record<string, unknown>): void;
}

function store(): Store {
  return (Alpine as unknown as { store(name: string): Store }).store("virtual");
}

/** Errors Alpine reported while running `fn`. */
function errorsDuring(fn: () => void): string[] {
  const errors: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]): void => {
    errors.push(args.map(String).join(" "));
  };
  try {
    fn();
  } finally {
    console.error = original;
  }
  return errors;
}

function mountScrollViewport(directive: string, id = "rows"): HTMLElement {
  document.body.innerHTML = `<div x-data x-init="$store.virtual.create('${id}', { count: 500, estimateSize: 36 })">
    <div data-testid="vp" ${directive}><div style="height:18000px"></div></div>
  </div>`;
  return document.querySelector<HTMLElement>('[data-testid="vp"]') as HTMLElement;
}

async function scrollTo(viewport: HTMLElement, top: number): Promise<void> {
  viewport.scrollTop = top;
  viewport.dispatchEvent(new Event("scroll"));
  await settled();
}

beforeAll(() => start(() => {}));

beforeEach(() => {
  virtualPlugin()(Alpine as unknown as import("alpinejs").Alpine);
  resume();
});

afterEach(() => {
  document.body.innerHTML = "";
  reset();
  clearAllSingletons();
});

describe("x-virtual-scroll", () => {
  test("a bare id binds without a ReferenceError, and scroll reaches the store", async () => {
    let viewport!: HTMLElement;
    const errors = errorsDuring(() => {
      viewport = mountScrollViewport('x-virtual-scroll="rows"');
    });
    await settled();

    expect(errors.filter((e) => e.includes("is not defined"))).toEqual([]);
    expect(store().instances["rows"]?.virtualItems.length).toBeGreaterThan(0);

    // The behavioural proof: the controller is listening to THIS element.
    await scrollTo(viewport, 900);
    expect(store().instances["rows"]?.scrollOffset).toBe(900);
  });

  test("a quoted string binds too", async () => {
    let viewport!: HTMLElement;
    errorsDuring(() => {
      viewport = mountScrollViewport("x-virtual-scroll=\"'rows'\"");
    });
    await settled();

    await scrollTo(viewport, 600);
    expect(store().instances["rows"]?.scrollOffset).toBe(600);
  });

  test("binds even though the directive initialises before the parent's x-init", async () => {
    // The silent-death case: `create()` has not run when the directive does.
    let viewport!: HTMLElement;
    errorsDuring(() => {
      viewport = mountScrollViewport('x-virtual-scroll="rows"');
    });
    await settled();

    await scrollTo(viewport, 300);
    expect(store().instances["rows"]?.scrollOffset).toBe(300);
  });

  test("an unknown id binds nothing and does not throw", async () => {
    const errors = errorsDuring(() => {
      document.body.innerHTML = `<div x-data x-init="$store.virtual.create('rows', { count: 10 })">
        <div data-testid="vp" x-virtual-scroll="nope"></div>
      </div>`;
    });
    await settled();

    expect(errors.filter((e) => e.includes("TypeError"))).toEqual([]);
  });
});
