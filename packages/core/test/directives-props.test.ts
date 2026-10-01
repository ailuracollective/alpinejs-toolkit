// @vitest-environment happy-dom
/**
 * `applyProps` / `bindProps` — the imperative counterpart to `x-bind="{...}"`.
 *
 * Alpine evaluates object-form `x-bind` exactly once, so a record returned by a
 * `*Props()` helper can only carry values that never change. Three demos
 * already work around that by hand (`apps/demo/src/components/demos/
 * TabsDemo.astro:41-63`, `SelectionDemo.astro:56-60`), re-declaring `aria-*`
 * and `tabindex` per attribute next to the frozen `x-bind`. These helpers are
 * what a directive uses instead.
 */
import { describe, expect, test, vi } from "vite-plus/test";

import { applyProps, bindProps, type DirectiveEvaluator } from "../src/directives";

/**
 * A synchronous `effect` stub.
 *
 * `DirectiveEvaluator` mirrors Alpine's declared `effect` type, which omits the
 * `stop` Alpine attaches at runtime, so the stub is cast rather than widened.
 */
function effectStub(
  effect: (callback: () => unknown) => { stop: () => void }
): DirectiveEvaluator["effect"] {
  return effect as unknown as DirectiveEvaluator["effect"];
}

describe("applyProps", () => {
  test("writes attributes as strings", () => {
    const el = document.createElement("button");
    applyProps(el, { role: "tab", "aria-level": "2" });
    expect(el.getAttribute("role")).toBe("tab");
    expect(el.getAttribute("aria-level")).toBe("2");
  });

  test("null removes the attribute instead of writing the string 'null'", () => {
    const el = document.createElement("div");
    el.setAttribute("hidden", "");
    applyProps(el, { hidden: null });
    expect(el.hasAttribute("hidden")).toBe(false);
  });

  test("false removes the attribute", () => {
    const el = document.createElement("div");
    el.setAttribute("data-active", "");
    applyProps(el, { "data-active": false });
    expect(el.hasAttribute("data-active")).toBe(false);
  });

  test("true writes an empty attribute, which is how boolean ARIA works", () => {
    const el = document.createElement("div");
    applyProps(el, { "aria-hidden": true });
    expect(el.getAttribute("aria-hidden")).toBe("");
  });

  test("property-backed keys are written as properties, not attributes", () => {
    const input = document.createElement("input") as HTMLInputElement;
    applyProps(input, { value: "hello", checked: true });
    expect(input.value).toBe("hello");
    expect(input.checked).toBe(true);
  });

  test("returns the attribute names it touched, so a caller can undo them", () => {
    const el = document.createElement("div");
    const touched = applyProps(el, { role: "tab", hidden: null, value: null });
    expect(touched).toEqual(["role"]);
  });
});

describe("bindProps", () => {
  test("recomputes on every effect run, which is what x-bind cannot do", () => {
    let active = false;
    const el = document.createElement("button");
    const effect = vi.fn((callback: () => unknown) => {
      callback();
      return { stop: vi.fn() };
    });
    const release = bindProps(el, { effect: effectStub(effect) }, () => ({
      "aria-selected": active ? "true" : "false",
      tabindex: active ? "0" : "-1",
    }));

    expect(el.getAttribute("aria-selected")).toBe("false");
    expect(el.getAttribute("tabindex")).toBe("-1");

    // Simulate the reactive re-run Alpine would trigger.
    active = true;
    effect.mock.calls[0]?.[0]();

    expect(el.getAttribute("aria-selected")).toBe("true");
    expect(el.getAttribute("tabindex")).toBe("0");
    release();
  });

  test("release removes the attributes it applied", () => {
    const el = document.createElement("button");
    const release = bindProps(el, { effect: effectStub(runNow) }, () => ({ role: "tab" }));
    expect(el.getAttribute("role")).toBe("tab");
    release();
    expect(el.hasAttribute("role")).toBe(false);
  });
});

/** Minimal `effect` stub: runs the callback once, returns a stop handle. */
function runNow(callback: () => unknown): { stop: () => void } {
  callback();
  return { stop: () => {} };
}
