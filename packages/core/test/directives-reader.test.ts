// @vitest-environment happy-dom
/**
 * `createValueReader` — the bare-identifier rule.
 *
 * `evaluateLater` hands a failing expression to Alpine's own error handler
 * instead of throwing into the directive, so evaluating a bare token asks
 * Alpine to resolve a *variable* of that name, prints `rows is not defined`,
 * and leaves the directive bound to nothing with no exception at the call
 * site. `packages/virtual/test/directive-binding.test.ts` is the regression
 * test for that bug on a real directive; this file pins the shared helper so
 * the next directive inherits the fix instead of re-deriving it.
 */
import { describe, expect, test, vi } from "vite-plus/test";

import {
  createValueReader,
  type DirectiveEvaluator,
  isLiteralDirectiveExpression,
} from "../src/directives";

/**
 * A stub evaluator that records what it was asked to evaluate.
 *
 * `evaluateLater` returns a getter, so calling it with no receiver returns the
 * value directly — that is the form `createValueReader` uses, since it feeds
 * the result to its own `receiver` instead of relying on a callback.
 */
function createUtilities() {
  const evaluateLater = vi.fn(
    <T>(_expression: string) =>
      ((callback?: (value: T) => void) => {
        callback?.("evaluated" as T);
      }) as unknown
  );
  const stop = vi.fn();
  const effect = vi.fn((callback: () => unknown) => {
    callback();
    return { stop };
  });
  return {
    // The stub is cast because `DirectiveEvaluator` deliberately mirrors
    // Alpine's declared `effect` type, which omits the `stop` that Alpine
    // attaches at runtime.
    utilities: { evaluateLater, effect } as unknown as DirectiveEvaluator,
    evaluateLater,
    effect,
    stop,
  };
}

describe("isLiteralDirectiveExpression", () => {
  test.each(["rows", "id", "_private", "$el", "with-dash", "a"])("reads %s literally", (raw) => {
    expect(isLiteralDirectiveExpression(raw)).toBe(true);
  });

  test.each(["'rows'", '"rows"', "rows.length", "a.b", "1 + 1", ""])(
    "does not read %s literally",
    (raw) => {
      expect(isLiteralDirectiveExpression(raw)).toBe(false);
    }
  );

  // A bare identifier with a dollar or dash is still a bare identifier. This is
  // the rule that makes `x-virtual-scroll="rows"` mean the id `rows` rather
  // than a variable lookup, so widening the pattern to `[\w$-]*` must not
  // accidentally exclude these.
  test.each(["$store", "with-dash", "a"])("still reads %s literally", (raw) => {
    expect(isLiteralDirectiveExpression(raw)).toBe(true);
  });
});

describe("createValueReader", () => {
  test("with literalBareIdentifier, a bare identifier is never evaluated", () => {
    const { utilities, evaluateLater } = createUtilities();
    const seen: unknown[] = [];
    createValueReader<string>("rows", utilities, (value) => seen.push(value), {
      literalBareIdentifier: true,
    });
    expect(seen).toEqual(["rows"]);
    // The whole point: Alpine is never asked to resolve `rows` as a variable.
    expect(evaluateLater).not.toHaveBeenCalled();
  });

  test("without the option, a bare identifier IS evaluated as an expression", () => {
    // The default, because `x-carousel="id"` with `id` in scope is ordinary
    // markup. Reading it as the id `"id"` would bind the wrong carousel.
    const { utilities, evaluateLater } = createUtilities();
    const seen: unknown[] = [];
    createValueReader<string>("id", utilities, (value) => seen.push(value));
    expect(evaluateLater).toHaveBeenCalledWith("id");
    expect(seen).toEqual(["evaluated"]);
  });

  test("a member expression is evaluated inside an effect, so it re-runs", () => {
    const { utilities, evaluateLater, effect } = createUtilities();
    const seen: unknown[] = [];
    createValueReader<string>("config.id", utilities, (value) => seen.push(value));
    expect(evaluateLater).toHaveBeenCalledWith("config.id");
    expect(effect).toHaveBeenCalledTimes(1);
    expect(seen).toEqual(["evaluated"]);
  });

  test("a quoted string is evaluated, not taken literally", () => {
    const { utilities, evaluateLater } = createUtilities();
    const seen: unknown[] = [];
    createValueReader<string>("'rows'", utilities, (value) => seen.push(value));
    expect(evaluateLater).toHaveBeenCalledWith("'rows'");
    expect(seen).toEqual(["evaluated"]);
  });

  test("an empty expression yields undefined and opens no effect", () => {
    const { utilities, effect } = createUtilities();
    const seen: unknown[] = [];
    createValueReader<string>("", utilities, (value) => seen.push(value));
    expect(seen).toEqual([undefined]);
    expect(effect).not.toHaveBeenCalled();
  });

  test("the returned stop function tears the effect down", () => {
    const { utilities, stop } = createUtilities();
    const stopReader = createValueReader<string>("config.id", utilities, () => {});
    stopReader();
    expect(stop).toHaveBeenCalledTimes(1);
  });
});
