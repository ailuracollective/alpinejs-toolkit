// @vitest-environment happy-dom
/**
 * `$store.history` reactivity, driven the way the demo drives it.
 *
 * Two defects, both invisible until you look at what the DOM actually shows:
 *
 * - The stacks never re-rendered. `sync()` assigned `proxy.undoStack =
 *   controller.undoStack`, but the controller mutates that array IN PLACE, so
 *   every assignment handed Alpine's `set` trap an identical reference, which
 *   it treats as a no-op. `undoStack.length` stayed frozen at its first length
 *   while the controller grew the array underneath it.
 * - `transaction().commit()` undid the work it was meant to keep. It re-committed
 *   the value from before the transaction, so the documented `+5` left the
 *   value exactly where it started, contradicting the docs' own "commit the
 *   handle to keep what you did inside it".
 *
 * The demo is registered with no `initialValue`, which is what made the whole
 * section look dead: `value` is `undefined`, arithmetic gives `NaN`, and
 * `Object.is(NaN, NaN)` is true so the controller drops every later commit as a
 * duplicate. The demo now coerces; the tests below assert that too, so the
 * arithmetic cannot silently regress.
 */
import { html, mount, reset, resume, settled, start } from "@ailura/alpinejs-testing";
import Alpine from "alpinejs";
import { afterEach, beforeAll, beforeEach, describe, expect, test } from "vite-plus/test";

import { createHistoryController } from "../src/controller";
import { historyPlugin } from "../src/plugin";

interface HistoryStoreLike {
  value: number | undefined;
  canUndo: boolean;
  canRedo: boolean;
  undoStack: unknown[];
  redoStack: unknown[];
  transactionDepth: number;
  commit(v: number): void;
  undo(): void;
  redo(): void;
  clear(): void;
  checkpoint(m?: { label?: string }): void;
  transaction(v: number): { value: number; commit(): void; rollback(): void };
}

const store = () => Alpine.store("history") as unknown as HistoryStoreLike;

/** The demo's markup, including the `?? 0` coercion it needs. */
async function demo() {
  const el = html(`
    <div x-data="{
      step: 1,
      current() { return $store.history.value ?? 0 },
      increment() { $store.history.commit(this.current() + this.step) },
      decrement() { $store.history.commit(this.current() - this.step) },
      txCommit() {
        const tx = $store.history.transaction(this.current())
        $store.history.commit(this.current() + 5)
        tx.commit()
      },
      txRollback() {
        const tx = $store.history.transaction(this.current())
        $store.history.commit(this.current() + 100)
        tx.rollback()
      }
    }">
      <button id="inc" @click="increment()">+1</button>
      <button id="dec" @click="decrement()">-1</button>
      <button id="txc" @click="txCommit()">tx commit</button>
      <button id="txr" @click="txRollback()">tx rollback</button>
      <span id="v" x-text="String($store.history.value)"></span>
      <span id="u" x-text="String($store.history.undoStack.length)"></span>
      <span id="r" x-text="String($store.history.redoStack.length)"></span>
      <span id="cu" x-text="String($store.history.canUndo)"></span>
      <span id="cr" x-text="String($store.history.canRedo)"></span>
      <span id="d" x-text="String($store.history.transactionDepth)"></span>
    </div>
  `);
  mount(el as HTMLElement);
  await settled();
  return el as HTMLElement;
}

const text = (el: Element, selector: string) => el.querySelector(selector)?.textContent ?? "";

const click = async (el: Element, selector: string) => {
  el.querySelector<HTMLElement>(selector)?.click();
  await settled();
};

beforeAll(() => {
  // Exactly how the playground registers it: no options.
  start(historyPlugin());
});

beforeEach(() => {
  resume();
  // `reset()` clears the DOM but the store is a module singleton, so its stacks
  // would otherwise carry over and every count would be off by the last test.
  (Alpine.store("history") as unknown as HistoryStoreLike).clear();
});

afterEach(() => {
  reset();
});

describe("increment", () => {
  test("the value is a number, not NaN", async () => {
    const el = await demo();
    await click(el, "#inc");
    expect(text(el, "#v")).toBe("1");
  });

  test("the undo stack grows past its first length", async () => {
    const el = await demo();
    await click(el, "#inc");
    expect(text(el, "#u")).toBe("1");
    await click(el, "#inc");
    expect(text(el, "#u")).toBe("2");
    await click(el, "#inc");
    expect(text(el, "#u")).toBe("3");
  });

  test("undo and redo move the value and the flags", async () => {
    const el = await demo();
    await click(el, "#inc");
    await click(el, "#inc");
    expect(text(el, "#v")).toBe("2");
    expect(text(el, "#cu")).toBe("true");

    store().undo();
    await settled();
    expect(text(el, "#v")).toBe("1");
    expect(text(el, "#r")).toBe("1");
    expect(text(el, "#cr")).toBe("true");

    store().redo();
    await settled();
    expect(text(el, "#v")).toBe("2");
    // `x-text` of a bare 0 renders empty here, so the count is compared as a
    // number rather than as the rendered string.
    expect(Number(text(el, "#u"))).toBe(2);
    expect(Number(text(el, "#r"))).toBe(0);
  });

  test("decrement goes below zero", async () => {
    const el = await demo();
    await click(el, "#dec");
    expect(text(el, "#v")).toBe("-1");
  });
});

describe("transaction", () => {
  test("commit keeps the change made inside it", async () => {
    const el = await demo();
    await click(el, "#inc");
    expect(text(el, "#v")).toBe("1");

    await click(el, "#txc");
    // The button says "commit +5"; before the fix this stayed at 1.
    expect(text(el, "#v")).toBe("6");
  });

  test("rollback discards the change made inside it", async () => {
    const el = await demo();
    await click(el, "#inc");
    expect(text(el, "#v")).toBe("1");

    await click(el, "#txr");
    expect(text(el, "#v")).toBe("1");
  });

  test("depth returns to zero once the handle settles", async () => {
    const el = await demo();
    const tx = store().transaction(0);
    await settled();
    expect(text(el, "#d")).toBe("1");

    tx.commit();
    await settled();
    expect(text(el, "#d")).toBe("0");
  });
});

describe("store identity", () => {
  test("the stacks are replaced, not aliased", () => {
    store().clear();
    const before = store().undoStack;
    store().commit(1);
    // Alpine's `set` trap skips an identical value; the controller mutates in
    // place, so handing over the same array is what froze the length.
    expect(store().undoStack).not.toBe(before);
  });

  test("the store is populated before any change event", () => {
    // `sync()` runs at registration, so a template reading on first paint sees
    // the controller's value rather than a field the first `change` fills in.
    const controller = createHistoryController<number>({ initialValue: 7 });
    expect(controller.value).toBe(7);
    controller.destroy();
  });
});

describe("controller transaction is unchanged for direct users", () => {
  test("commit keeps, rollback discards", () => {
    const controller = createHistoryController<number>({ initialValue: 0 });
    const tx = controller.transaction(0);
    controller.commit(5);
    tx.commit();
    expect(controller.value).toBe(5);
    expect(controller.undoStack.length).toBe(2);

    const tx2 = controller.transaction(5);
    controller.commit(100);
    tx2.rollback();
    expect(controller.value).toBe(5);
    expect(controller.undoStack.length).toBe(2);
    controller.destroy();
  });
});
