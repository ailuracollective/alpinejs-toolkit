// @vitest-environment happy-dom
/**
 * `createDirectiveBinding` — the idempotent release queue every element-bound
 * directive hands to Alpine's `cleanup()` utility.
 *
 * Alpine drains `el._x_cleanups` when an element leaves the tree, and it drains
 * on attribute removal too, so `release()` can be reached more than once for
 * the same binding. A naive teardown closure that is not idempotent
 * double-frees on the second drain, which is exactly the kind of failure that
 * shows up as "the widget only breaks after you navigate away twice".
 */
import { describe, expect, test } from "vite-plus/test";

import { createDirectiveBinding } from "../src/directives";

describe("createDirectiveBinding", () => {
  test("runs queued teardowns LIFO", () => {
    const binding = createDirectiveBinding();
    const order: string[] = [];
    binding.add(() => order.push("first"));
    binding.add(() => order.push("second"));
    binding.add(() => order.push("third"));
    binding.release();
    expect(order).toEqual(["third", "second", "first"]);
  });

  test("release is idempotent — a second drain runs nothing", () => {
    const binding = createDirectiveBinding();
    let calls = 0;
    binding.add(() => {
      calls += 1;
    });
    binding.release();
    binding.release();
    expect(calls).toBe(1);
    expect(binding.released).toBe(true);
  });

  test("add after release is ignored, so a late effect cannot resurrect state", () => {
    const binding = createDirectiveBinding();
    binding.release();
    let called = false;
    binding.add(() => {
      called = true;
    });
    binding.release();
    expect(called).toBe(false);
  });

  test("every queued teardown runs even when one throws, and the error surfaces", () => {
    const binding = createDirectiveBinding();
    const order: string[] = [];
    binding.add(() => order.push("last"));
    binding.add(() => {
      throw new Error("boom");
    });
    binding.add(() => order.push("first"));
    expect(() => binding.release()).toThrow("boom");
    // LIFO, and the healthy teardown after the throwing one still ran.
    expect(order).toEqual(["first", "last"]);
  });
});
