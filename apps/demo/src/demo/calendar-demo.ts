/**
 * Calendar demo.
 *
 * Everything visible here comes out of `$store.calendar`. The month grid used to
 * be rebuilt by hand in this file — 42 cells, `isToday`, `isStart`, `isEnd`,
 * `inRange` and a `toRange()` normaliser — because the store exposed only
 * `month`, `mode` and `selected` while the controller had always computed the
 * grid. That was a second implementation of `CalendarController.weeks`, and the
 * two disagreed: this one was Monday-first, the package's is Sunday-first.
 *
 * The store now forwards `weeks` and `weekdayLabels`, so the demo reads the
 * real thing. What is left here is formatting — the month and selection labels
 * — and the click handler, both of which are the host's job.
 */

import type { CalendarDay, CalendarSelection, CalendarStore } from "@ailura/alpinejs-calendar";

import type { AlpineInstance } from "../types/alpine.js";

/** A cell, flattened for the template: the package's `CalendarDay` plus a key. */
type Cell = CalendarDay & { key: string; day: number };

const MONTH_FORMATTER = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" });
const DAY_FORMATTER = new Intl.DateTimeFormat("en", { day: "numeric", month: "short" });

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameDay(a: Date | undefined | null, b: Date): boolean {
  return Boolean(a) && startOfDay(a as Date).getTime() === startOfDay(b).getTime();
}

/**
 * The three shapes `CalendarSelection` can take, normalized to a range.
 *
 * Still the host's job: the package stores the selection in whichever shape the
 * caller used (`Date`, `Date[]`, or a `{ from, to }` pair) and the template
 * needs one label out of it.
 */
function toRange(selection: CalendarSelection): { from?: Date; to?: Date } {
  if (selection === null) {
    return {};
  }
  if (Array.isArray(selection)) {
    const sorted = [...selection].sort((a, b) => a.getTime() - b.getTime());
    return { from: sorted[0], to: sorted[sorted.length - 1] };
  }
  if (selection instanceof Date) {
    return { from: selection, to: selection };
  }
  return selection;
}

type CalendarDemoData = {
  readonly store: CalendarStore;
  /** The store's grid, flattened for `x-for` and given a stable key. */
  readonly cells: Cell[];
  readonly weekdayLabels: readonly string[];
  readonly monthLabel: string;
  readonly selectionLabel: string;
  pick(cell: Cell): void;
  jumpNextMonth(): void;
  clear(): void;
};

export function registerCalendarDemo(Alpine: AlpineInstance): void {
  Alpine.data("calendarDemo", (): CalendarDemoData => ({
    get store(): CalendarStore {
      return Alpine.store("calendar") as CalendarStore;
    },

    get cells(): Cell[] {
      return this.store.weeks.flat().map((day) => ({
        ...day,
        key: `${day.date.getFullYear()}-${day.date.getMonth()}-${day.date.getDate()}`,
        day: day.date.getDate(),
      }));
    },

    get weekdayLabels(): readonly string[] {
      return this.store.weekdayLabels;
    },

    get monthLabel(): string {
      return MONTH_FORMATTER.format(this.store.month);
    },

    get selectionLabel(): string {
      const { from, to } = toRange(this.store.selected);
      if (!from) {
        return "—";
      }
      if (!to || isSameDay(from, to)) {
        return DAY_FORMATTER.format(from);
      }
      return `${from ? DAY_FORMATTER.format(from) : "…"} → ${to ? DAY_FORMATTER.format(to) : "…"}`;
    },

    pick(cell) {
      this.store.select(cell.date);
    },

    jumpNextMonth() {
      const month = this.store.month;
      this.store.goToMonth(new Date(month.getFullYear(), month.getMonth() + 2, 1));
    },

    clear() {
      this.store.clear();
    },
  }));
}
