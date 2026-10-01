// @vitest-environment happy-dom
/**
 * `$store.lang` reactivity.
 *
 * The predicates were the bug. `is()` and `includes()` read the controller's
 * private fields, which are not reactive, so a template calling them registered
 * no dependency on anything `sync()` writes. An effect evaluated once and then
 * never again: `x-show="$store.lang.is('es')"` stayed visible after switching to
 * another language, and `x-bind:data-active="$store.lang.is(...)"` never moved at
 * all. The demo's translations froze on whichever language rendered first.
 *
 * Every test below starts from the branch that is VISIBLE, because that is the
 * only direction that exposes a stale effect: a hidden branch that stays hidden
 * looks correct by accident.
 */
import { html, mount, reset, resume, settled, start } from "@ailura/alpinejs-testing";
import Alpine from "alpinejs";
import { afterEach, beforeAll, beforeEach, describe, expect, test } from "vite-plus/test";

import { langPlugin } from "../src/plugin";

interface LangStoreLike {
  current: string;
  base: string;
  region: string | null;
  isDetected: boolean;
  set(value: string): void;
  reset(): void;
}

const store = () => Alpine.store("lang") as LangStoreLike;

beforeAll(() => {
  start(langPlugin());
});

beforeEach(() => {
  resume();
});

afterEach(() => {
  reset();
});

async function render(snippet: string): Promise<HTMLElement> {
  const el = html(snippet);
  mount(el as HTMLElement);
  await settled();
  return el as HTMLElement;
}

/** `x-show` writes `display: none` rather than removing the element. */
const isVisible = (el: Element, selector: string) =>
  el.querySelector(selector)?.getAttribute("style") !== "display: none;";

/** `x-text` and `x-bind` output, as text. */
const text = (el: Element, selector: string) => el.querySelector(selector)?.textContent ?? "";

/** The value of an attribute Alpine may remove by writing null. */
const attr = (el: Element, selector: string, name: string) =>
  el.querySelector(selector)?.getAttribute(name) ?? null;

describe("plain store values", () => {
  test("the initial value is already detected, not the fallback", async () => {
    // `mount()` re-reads the navigator and announces it on a microtask, so the
    // store must be usable before that fires.
    const el = await render(`<div><span id="a" x-text="$store.lang.current"></span></div>`);
    expect(text(el, "#a")).toBe("en-us");
  });

  test("current follows set()", async () => {
    const el = await render(`<div><span id="a" x-text="$store.lang.current"></span></div>`);
    store().set("fr");
    await settled();
    expect(text(el, "#a")).toBe("fr");
  });

  test("base and region follow the tag", async () => {
    const el = await render(
      `<div><span id="b" x-text="$store.lang.base"></span><span id="r" x-text="$store.lang.region"></span></div>`
    );
    // Tags normalize to lowercase, so the region comes back as `br`.
    store().set("pt-BR");
    await settled();
    expect(text(el, "#b")).toBe("pt");
    expect(text(el, "#r")).toBe("br");
  });
});

describe("is() in a template", () => {
  test("a visible branch hides when the language moves away", async () => {
    store().set("es");
    const el = await render(`<div><span id="es" x-show="$store.lang.is('es')">es</span></div>`);
    expect(isVisible(el, "#es")).toBe(true);

    store().set("fr");
    await settled();
    expect(isVisible(el, "#es")).toBe(false);
  });

  test("two branches swap as the language changes", async () => {
    store().set("es");
    const el = await render(`
      <div>
        <span id="es" x-show="$store.lang.is('es')">es</span>
        <span id="fr" x-show="$store.lang.is('fr')">fr</span>
      </div>
    `);
    expect([isVisible(el, "#es"), isVisible(el, "#fr")]).toEqual([true, false]);

    store().set("fr");
    await settled();
    expect([isVisible(el, "#es"), isVisible(el, "#fr")]).toEqual([false, true]);

    store().set("es");
    await settled();
    expect([isVisible(el, "#es"), isVisible(el, "#fr")]).toEqual([true, false]);
  });

  test("is() rendered as text turns false", async () => {
    store().set("fr");
    // `x-text` coerces a bare `false` to the empty string, so this asserts on
    // the transition rather than on the literal word.
    const el = await render(`<div><span id="a" x-text="$store.lang.is('fr')"></span></div>`);
    expect(text(el, "#a")).toBe("true");

    store().set("es");
    await settled();
    expect(text(el, "#a")).toBe("");
  });

  test("a region-qualified tag still matches its base", async () => {
    store().set("pt-BR");
    const el = await render(`<div><span id="a" x-text="$store.lang.is('pt')"></span></div>`);
    expect(text(el, "#a")).toBe("true");
  });
});

describe("is() as an attribute binding", () => {
  test("data-active tracks the language in both directions", async () => {
    store().set("es");
    const el = await render(
      `<div><b id="a" x-bind:data-active="$store.lang.is('es') ? 'true' : null"></b></div>`
    );
    expect(attr(el, "#a", "data-active")).toBe("true");

    store().set("fr");
    await settled();
    expect(attr(el, "#a", "data-active")).toBeNull();
  });

  test("it can turn on as well as off", async () => {
    store().set("es");
    const el = await render(
      `<div><b id="a" x-bind:data-active="$store.lang.is('fr') ? 'true' : null"></b></div>`
    );
    expect(attr(el, "#a", "data-active")).toBeNull();

    store().set("fr");
    await settled();
    expect(attr(el, "#a", "data-active")).toBe("true");
  });
});

describe("includes() in a template", () => {
  test("it answers from the navigator list, not the selected language", async () => {
    const el = await render(`<div><span id="a" x-text="$store.lang.includes('en')"></span></div>`);
    // The test navigator reports ['en-US', 'en'], so `includes('en')` is true
    // whatever language is selected.
    expect(text(el, "#a")).toBe("true");

    store().set("fr");
    await settled();
    expect(text(el, "#a")).toBe("true");

    // A language the browser never offered is still absent after reset().
    store().reset();
    await settled();
    const el2 = await render(`<div><span id="a" x-text="$store.lang.includes('fr')"></span></div>`);
    expect(text(el2, "#a")).toBe("");
  });

  test("it re-renders when the list changes", async () => {
    const el = await render(`<div><span id="a" x-text="$store.lang.includes('en')"></span></div>`);
    expect(text(el, "#a")).toBe("true");

    // reset() re-reads the navigator and rewrites `languages`, which is what a
    // stale predicate would fail to pick up.
    store().reset();
    await settled();
    expect(text(el, "#a")).toBe("true");
  });
});

describe("controller API is unchanged", () => {
  test("is()/includes() still work without a store", async () => {
    const { createLangController } = await import("../src/controller");
    const controller = createLangController({
      navigator: { language: "en-GB", languages: ["en-GB"] },
    });
    expect(controller.is("en")).toBe(true);
    expect(controller.is("en-GB")).toBe(true);
    expect(controller.is("fr")).toBe(false);
    expect(controller.includes("en")).toBe(true);
    expect(controller.includes("fr")).toBe(false);
    controller.destroy();
  });
});
