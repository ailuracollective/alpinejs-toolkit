import { BaseController } from "@ailura/alpinejs-core/controller";
import { generateId } from "@ailura/alpinejs-core/ids";

import type { HistoryEvents } from "./events";
import type {
  CreateHistoryControllerOptions,
  HistoryEntry,
  HistoryManager,
  TransactionHandle,
} from "./types";

/**
 * Snapshot a value so later mutation of the caller's object cannot rewrite
 * history.
 *
 * `structuredClone` is the right tool and fails loudly on the things JSON
 * silently drops — a function, a DOM node, a `Map` with non-string keys. The
 * JSON fallback is the pragmatic choice for those: it keeps a
 * partially-serialisable state usable at the cost of silently losing
 * non-serialisable fields. Pass a `clone` if you need exactness.
 */
function defaultClone<T>(v: T): T {
  try {
    return structuredClone(v);
  } catch {
    return JSON.parse(JSON.stringify(v)) as T;
  }
}

export class HistoryController<T, TMeta = unknown>
  extends BaseController<HistoryEvents<T>>
  implements HistoryManager<T, TMeta>
{
  readonly #limit: number;
  readonly #clone: (v: T) => T;
  readonly #equality: (a: T, b: T) => boolean;
  #undo: HistoryEntry<T, TMeta>[] = [];
  #redo: HistoryEntry<T, TMeta>[] = [];
  #value: T | undefined;
  #transactionDepth = 0;

  readonly id: string;
  constructor(options: CreateHistoryControllerOptions<T> = {}) {
    super();
    this.id = options.id ?? generateId("history");
    this.#limit = options.limit ?? 100;
    this.#clone = (options.clone ?? defaultClone) as (v: T) => T;
    this.#equality = options.equality ?? Object.is;
    if (options.initialValue !== undefined) {
      this.#value = this.#clone(options.initialValue);
      this.#undo = [
        {
          value: this.#clone(options.initialValue),
          meta: { id: generateId("entry"), timestamp: Date.now(), label: "initial" },
        },
      ];
    }
  }

  get value(): T | undefined {
    return this.#value;
  }
  /**
   * True when there is somewhere to go back to.
   *
   * `> 1`, not `> 0`: the bottom of the undo stack is the initial value, which is
   * a position, not a step. Undoing past it is not an action.
   */
  get canUndo(): boolean {
    return this.#undo.length > 1;
  }
  get canRedo(): boolean {
    return this.#redo.length > 0;
  }
  get undoStack(): readonly HistoryEntry<T, TMeta>[] {
    return this.#undo;
  }
  get redoStack(): readonly HistoryEntry<T, TMeta>[] {
    return this.#redo;
  }
  get transactionDepth(): number {
    return this.#transactionDepth;
  }
  get limit(): number {
    return this.#limit;
  }

  /**
   * The single write path for the undo stack — `commit`, `push`, `reset` and
   * `checkpoint` all funnel through here, so the dedupe check, the limit and the
   * redo flush cannot be bypassed.
   *
   * Note the dedupe is a **no-op return**: it does not set `#value`. With the
   * default `Object.is` equality on a NaN value that means committing NaN twice
   * leaves `value` as `NaN` and the stack un-grown, which is correct but reads
   * as "my commit did nothing" from the outside.
   */
  private pushEntry(value: T, meta?: { label?: string; group?: string; meta?: TMeta }): void {
    const cloned = this.#clone(value);
    const last = this.#undo[this.#undo.length - 1];
    if (last && this.#equality(last.value, cloned)) return;
    const entry: HistoryEntry<T, TMeta> = {
      value: cloned,
      meta: {
        id: generateId("entry"),
        timestamp: Date.now(),
        label: meta?.label,
        group: meta?.group,
        meta: meta?.meta,
      },
    };
    this.#undo.push(entry);
    // The oldest entry is dropped, not the newest: the stack is a window onto
    // the recent past, so `limit` is how far back undo reaches.
    if (this.#undo.length > this.#limit) this.#undo.shift();
    // **Committing invalidates the redo branch.** This is the standard undo/redo
    // contract — once you have moved forward from an undone state, that future
    // is no longer reachable — and it is why undo-then-edit loses the redo stack
    // rather than forking it.
    this.#redo = [];
    this.#value = cloned;
    this.emit("change", { source: "commit", value: this.#value });
  }

  commit(value: T, meta?: { label?: string; group?: string; meta?: TMeta }): void {
    if (this.lifecycle === "destroyed") return;
    this.pushEntry(value, meta);
  }

  /** Alias of `commit` — both are the same operation. */
  push(value: T, meta?: { label?: string; group?: string; meta?: TMeta }): void {
    this.commit(value, meta);
  }

  /**
   * Step back one entry and return the restored value.
   *
   * Returns the current value unchanged when there is nothing to undo, rather
   * than `undefined` — an exhausted undo is not an error, and a caller binding
   * the result to a template should see the value it already had.
   */
  undo(): T | undefined {
    if (this.lifecycle === "destroyed") return undefined;
    if (this.#undo.length <= 1) return this.#value;
    const current = this.#undo.pop();
    if (current === undefined) return this.#value;
    this.#redo.push(current);
    const prev = this.#undo[this.#undo.length - 1];
    this.#value = prev ? this.#clone(prev.value) : undefined;
    this.emit("change", { source: "undo", value: this.#value });
    return this.#value;
  }

  redo(): T | undefined {
    if (this.lifecycle === "destroyed") return undefined;
    const next = this.#redo.pop();
    if (!next) return this.#value;
    this.#undo.push(next);
    this.#value = this.#clone(next.value);
    this.emit("change", { source: "redo", value: this.#value });
    return this.#value;
  }

  /**
   * Drop both stacks and set `value` to `undefined`.
   *
   * `value` really is `undefined` afterwards, not the initial value — a cleared
   * history has no current value as far as the controller is concerned, so a
   * template reading `value` gets `undefined` until the next commit. Guard the
   * read (`$store.history.value ?? fallback`) or pass an `initialValue`.
   */
  clear(): void {
    if (this.lifecycle === "destroyed") return;
    this.#undo = [];
    this.#redo = [];
    this.#value = undefined;
    this.emit("change", { source: "clear", value: undefined });
  }

  /**
   * Clear, then make `value` the new bottom of the stack.
   *
   * Emits **twice**: `clear` from the `clear()` call and then `commit` from the
   * `pushEntry`, before the `reset` that the caller sees last. A listener
   * treating `source` as "one event per user action" will see three.
   */
  reset(value: T, meta?: { label?: string; group?: string; meta?: TMeta }): void {
    if (this.lifecycle === "destroyed") return;
    this.clear();
    this.pushEntry(value, meta ?? { label: "reset" });
    this.emit("change", { source: "reset", value: this.#value });
  }

  /**
   * Push the current value as its own entry.
   *
   * The point is to make a state undoable *without changing it* — the snapshot a
   * user can return to. It goes through the same dedupe check as a commit, so
   * checkpointing an unchanged value is a no-op and does not grow the stack. It
   * is also a no-op when `value` is `undefined`.
   */
  checkpoint(meta?: { label?: string; group?: string; meta?: TMeta }): void {
    if (this.lifecycle === "destroyed") return;
    if (this.#value !== undefined)
      this.pushEntry(this.#clone(this.#value), meta ?? { label: "checkpoint" });
  }

  /**
   * Group the commits made inside the handle into one undo step.
   *
   * `commit()` KEEPS what was committed inside; `rollback()` throws it away and
   * restores the snapshot. It must not re-commit `initialValue`: the changes
   * inside are already on the undo stack, so committing the value from before
   * the transaction would push a second entry that undoes them — the `+5` in the
   * documented example left the value exactly where it started.
   */
  transaction(initialValue: T): TransactionHandle<T> {
    this.#transactionDepth++;
    // Opening a handle changes `transactionDepth`, which templates bind to, so
    // it has to announce itself: the docs promise a toolbar can tell it is
    // inside a transaction, and without this the depth only ever appeared once
    // the handle settled.
    this.emit("change", { source: "commit", value: this.#value });
    let settled = false;
    const snapUndo = [...this.#undo];
    const snapValue = this.#value;
    const handle: TransactionHandle<T> = {
      get value() {
        return initialValue;
      },
      commit: () => {
        if (settled) return;
        settled = true;
        this.#transactionDepth = Math.max(0, this.#transactionDepth - 1);
        // The work inside is already recorded; only the depth changed, and
        // `transactionDepth` is part of what a template binds to.
        this.emit("change", { source: "commit", value: this.#value });
      },
      rollback: () => {
        if (settled) return;
        settled = true;
        this.#transactionDepth = Math.max(0, this.#transactionDepth - 1);
        this.#undo = snapUndo;
        this.#redo = [];
        this.#value = snapValue;
        this.emit("change", { source: "clear", value: this.#value });
      },
    };
    return handle;
  }
}

export function createHistoryController<T>(
  options?: CreateHistoryControllerOptions<T>
): HistoryController<T> {
  return new HistoryController<T>(options);
}
