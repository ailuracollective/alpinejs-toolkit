/**
 * Shared helpers for writing Alpine directives.
 *
 * These exist because the same four problems recur in every element-bound
 * directive in this toolkit, and getting any of them wrong fails *silently*
 * rather than loudly:
 *
 * 1. **Teardown.** A store registration has no Alpine-invoked teardown in this
 *    Alpine version (`plugin()` discards the callback's return value and the
 *    Alpine object exposes no `cleanup`/`stop()`), so a directive's own
 *    `cleanup()` utility is the only mechanism the runtime really invokes.
 *    {@link createDirectiveBinding} wraps that payload in an idempotent,
 *    LIFO release queue so a re-entrant `cleanup()` cannot double-free.
 *
 * 2. **Literal vs expression.** `evaluateLater` reports failures to Alpine's
 *    own error handler instead of throwing into the directive, so evaluating
 *    a bare identifier (`x-virtual-scroll="rows"`) asks Alpine to resolve a
 *    *variable* named `rows`, prints `rows is not defined`, and leaves the
 *    directive bound to nothing with no exception anywhere.
 *    {@link createValueReader} takes a bare identifier literally and evaluates
 *    everything else.
 *
 * 3. **Reactivity.** A directive callback is *not* wrapped in an effect by
 *    Alpine, so `evaluateLater(expr)(cb)` fires once and never again. Every
 *    reader here returns a reactive reader.
 *
 * 4. **`x-bind` object form.** Alpine evaluates `x-bind="{...}"` exactly once,
 *    so a record returned by a `*Props()` helper can only carry values that
 *    never change. {@link bindProps} applies attributes imperatively inside an
 *    effect instead, which is what makes live `aria-*` / `tabindex` work.
 */
import type { DirectiveUtilities, ElementWithXAttributes } from "alpinejs";

/**
 * A bare identifier is taken literally instead of being evaluated.
 *
 * Anything else — a quoted string, a member expression, a call — is evaluated
 * as an expression, so `x-foo="bar"` means the id `bar` and `x-foo="idVar"`
 * means "whatever `idVar` currently holds".
 */
const LITERAL_PATTERN = /^[A-Za-z_$][\w$-]*$/;

/** True when the expression is a bare identifier safe to read as a literal. */
export function isLiteralDirectiveExpression(expression: string): boolean {
  return LITERAL_PATTERN.test(expression.trim());
}

/**
 * An idempotent release queue for one element.
 *
 * Returned by {@link createDirectiveBinding}; hand {@link DirectiveBinding.release}
 * to the `cleanup()` utility Alpine supplies to a directive callback.
 */
export interface DirectiveBinding {
  /** Queue a teardown. Ignored once the binding has been released. */
  add(cleanup: () => void): void;
  /** Run every queued teardown, LIFO. Safe to call more than once. */
  release(): void;
  /** Whether {@link DirectiveBinding.release} has already run. */
  readonly released: boolean;
}

/** Create an idempotent, LIFO release queue for a single element. */
export function createDirectiveBinding(): DirectiveBinding {
  const cleanups: Array<() => void> = [];
  let released = false;
  return {
    add(cleanup) {
      if (released) return;
      cleanups.push(cleanup);
    },
    release() {
      if (released) return;
      released = true;
      let failed = false;
      let firstError: unknown;
      for (let index = cleanups.length - 1; index >= 0; index -= 1) {
        try {
          cleanups[index]();
        } catch (error) {
          if (!failed) {
            failed = true;
            firstError = error;
          }
        }
      }
      cleanups.length = 0;
      if (failed) throw firstError;
    },
    get released() {
      return released;
    },
  };
}

/**
 * Stop the effect Alpine's `effect()` returned.
 *
 * Three shapes have to be handled, and none of them is documented:
 *
 * - `utilities.effect` from a **directive callback** is Alpine's element-bound
 *   effect, which returns the raw reactivity runner — a function carrying an
 *   `effect` property, and that inner object is what holds `stop`.
 * - `Alpine.effect` returns that same runner.
 * - `@types/alpinejs` declares the result as `ReactiveEffect<T>`, a callable
 *   object whose members are `id` / `active` / `raw`, with `stop` omitted
 *   entirely — so a direct `.stop()` call does not typecheck either.
 *
 * Probing both shapes rather than trusting the declaration matters: calling
 * `.stop()` on the runner is a no-op *silently* if the branch is wrong, which
 * would leave a previous effect live after a re-bind.
 */
function stopEffect(effect: unknown): void {
  if (effect === null || (typeof effect !== "function" && typeof effect !== "object")) return;
  const candidate = effect as { stop?: unknown; effect?: { stop?: unknown } };
  if (typeof candidate.stop === "function") {
    (candidate.stop as () => void)();
    return;
  }
  const inner = candidate.effect;
  if (inner && typeof inner.stop === "function") inner.stop();
}

/** Minimal evaluator surface the helpers need, so tests can pass a stub. */
export interface DirectiveEvaluator {
  evaluateLater: DirectiveUtilities["evaluateLater"];
  /**
   * Alpine's own `effect`. Accepting its declared type (rather than the
   * stoppable shape) lets a directive callback's `utilities` be passed through
   * unchanged; the real handle is recovered by {@link stopEffect} inside each
   * helper, in one place.
   */
  effect: DirectiveUtilities["effect"];
}

/** Options for {@link createValueReader}. */
export interface ValueReaderOptions {
  /**
   * Deliver a bare identifier literally instead of evaluating it.
   *
   * `true` suits a directive whose markup is documented as an id
   * (`x-virtual-scroll="rows"`), because evaluating that would ask Alpine for a
   * variable named `rows` and fail silently. Leave it off when the expression is
   * *meant* to be an expression: `x-carousel="id"` with `id` in scope is
   * ordinary markup, and this option would silently bind the id `"id"`.
   */
  literalBareIdentifier?: boolean;
}

/**
 * Read a directive's expression into `receiver`, reactively.
 *
 * The expression is evaluated inside an effect, so `receiver` re-runs when the
 * value changes. With {@link ValueReaderOptions.literalBareIdentifier} set, a
 * bare identifier is instead delivered once, as a string.
 *
 * @returns A stop function; also safe to ignore when nothing was read.
 */
export function createValueReader<TValue>(
  expression: string,
  utilities: DirectiveEvaluator,
  receiver: (value: TValue) => void,
  options: ValueReaderOptions = {}
): () => void {
  const raw = typeof expression === "string" ? expression.trim() : "";
  if (raw === "") {
    receiver(undefined as TValue);
    return () => {};
  }
  // Opt in to reading a bare identifier literally. Evaluating it would ask
  // Alpine to resolve a variable of that name, and `evaluateLater` reports the
  // failure to Alpine's handler rather than throwing here — so the failure is
  // silent. But this is a *trade*, not a free win: `x-carousel="id"` naming a
  // real variable is legitimate markup, so a directive whose expression is
  // normally an expression must leave this off.
  if (options.literalBareIdentifier === true && isLiteralDirectiveExpression(raw)) {
    receiver(raw as TValue);
    return () => {};
  }
  // `evaluateLater` returns a getter whose *return value* is always undefined:
  // it hands the result to a receiver callback instead, and it only tracks
  // reactive dependencies while the getter itself runs. So the call has to
  // happen inside the effect — calling `get()` outside it would read the
  // expression once and never register a dependency, which is the same
  // one-shot bug as `x-bind` in object form.
  const get = utilities.evaluateLater<TValue>(raw);
  const effect = utilities.effect(() => {
    get((value) => receiver(value));
  });
  return () => stopEffect(effect);
}

/** Attribute-ready props: `null`/`undefined` removes the attribute. */
export type DirectiveProps = Readonly<Record<string, unknown>>;

/** Keys that must be written as DOM properties, not attributes. */
const PROPERTY_KEYS = new Set(["value", "checked", "selected", "indeterminate", "disabled"]);

/**
 * Apply a props record imperatively.
 *
 * The imperative counterpart to `x-bind="{...}"`, which Alpine evaluates only
 * once. Values that are `null` or `undefined` remove the attribute rather
 * than writing the string `"null"`.
 *
 * @returns The attribute names touched, so the caller can undo them.
 */
export function applyProps(el: Element, props: DirectiveProps): string[] {
  const touched: string[] = [];
  for (const [name, value] of Object.entries(props)) {
    if (name in el && PROPERTY_KEYS.has(name)) {
      (el as unknown as Record<string, unknown>)[name] = value ?? false;
      continue;
    }
    if (value === null || value === undefined || value === false) {
      el.removeAttribute(name);
      continue;
    }
    el.setAttribute(name, value === true ? "" : String(value));
    touched.push(name);
  }
  return touched;
}

/**
 * Apply a computed props record on every effect run, and undo it on release.
 *
 * This is how a directive makes live `aria-selected` / `tabindex` / `hidden`
 * work where `x-bind="$store.x.itemProps(id, key)"` cannot.
 *
 * @returns A stop function that also removes the attributes it applied.
 */
export function bindProps(
  el: Element,
  utilities: Pick<DirectiveUtilities, "effect"> & { effect: DirectiveEvaluator["effect"] },
  compute: () => DirectiveProps
): () => void {
  let applied: string[] = [];
  const effect = utilities.effect(() => {
    for (const name of applied) el.removeAttribute(name);
    applied = applyProps(el, compute());
  });
  return () => {
    stopEffect(effect);
    for (const name of applied) el.removeAttribute(name);
    applied = [];
  };
}

/** Convenience alias for the element type Alpine passes to a directive. */
export type DirectiveElement = ElementWithXAttributes;
