// @vitest-environment happy-dom
/**
 * The store must forward the controller's own month grid, and keep it current.
 *
 * The defect this pins: `CalendarStore` exposed `month`, `mode` and `selected`
 * but not `weeks`, even though `CalendarController.weeks` had always built the
 * six-week view. Every consumer therefore rebuilt the grid by hand — and the
 * playground's copy was Monday-first while the controller's is Sunday-first, so
 * the demo and the package disagreed about which day a month starts on. The
 * reimplementation also went stale: nothing rebuilt it on a selection change,
 * because it was derived from a snapshot the store did not react to.
 *
 * So this checks the two things a forwarding snapshot has to get right: the grid
 * is the controller's, and it is refreshed when the controller's state changes.
 */

import { reset, resume, settled, start } from "@ailura/alpinejs-testing";
import Alpine from "alpinejs";
import { afterEach, beforeAll, beforeEach, describe, expect, test } from "vite-plus/test";

import { calendarPlugin } from "../src/plugin";
import type { CalendarStore } from "../src/types";

function store(): CalendarStore {
  return Alpine.store("calendar") as CalendarStore;
}

/** Every date in the grid, flattened, as epoch milliseconds. */
function gridDates(): number[] {
  return store()
    .weeks.flat()
    .map((cell) => cell.date.getTime());
}

/**
 * Every cell the controller flags as belonging to the month the store reports.
 *
 * Asserted as a filtered list rather than an `expect` inside a loop, so a
 * failure says which cell was wrong instead of only that the loop ran.
 */
function currentMonthCells(): string[] {
  const month = store().month;
  return store()
    .weeks.flat()
    .filter((cell) => cell.isCurrentMonth)
    .map((cell) => `${cell.date.getFullYear()}-${cell.date.getMonth()}-${cell.date.getDate()}`)
    .filter((key) => {
      const [year, monthIndex] = key.split("-").map(Number) as [number, number];
      return year === month.getFullYear() && monthIndex === month.getMonth();
    });
}

describe("$store.calendar grid", () => {
  beforeAll(() => {
    start(() => {});
  });

  beforeEach(() => {
    Alpine.plugin(calendarPlugin());
    resume();
  });

  afterEach(() => {
    reset();
  });

  test("exposes six weeks of seven days", () => {
    settled();
    expect(store().weeks).toHaveLength(6);
    for (const week of store().weeks) {
      expect(week).toHaveLength(7);
    }
  });

  test("the grid starts on the day the package says it does", () => {
    settled();
    // Sunday-first, from `weekdayLabels`. A hand-rolled grid got this wrong,
    // which is how the playground's month ended up a day out.
    expect(store().weekdayLabels[0]).toBe("Su");
    const first = store().weeks[0]?.[0]?.date;
    expect(first?.getDay()).toBe(0);
  });

  test("the grid is the controller's, not a copy of its month", () => {
    settled();
    const month = store().month;
    const cells = store().weeks.flat();
    // Six weeks is 42 cells; the days that belong to the month are the ones the
    // controller flagged, and a grid of only month days could not render a
    // complete grid at all.
    expect(gridDates()).toHaveLength(42);
    expect(cells.filter((cell) => cell.isCurrentMonth).length).toBeGreaterThanOrEqual(28);
    // Every cell the controller flags has to actually be in the month it claims.
    expect(currentMonthCells()).toHaveLength(cells.filter((cell) => cell.isCurrentMonth).length);
    // The first column is the Sunday on or before the 1st, so the grid may open
    // in the previous month. It may not open later than the month itself.
    expect(cells[0]?.date.getTime()).toBeLessThanOrEqual(month.getTime());
  });

  test("moving a month rebuilds the grid", () => {
    settled();
    const before = gridDates();
    store().nextMonth();
    settled();
    expect(gridDates()).not.toEqual(before);
    expect(currentMonthCells()).toHaveLength(
      store()
        .weeks.flat()
        .filter((cell) => cell.isCurrentMonth).length
    );
  });

  test("selecting rebuilds the grid, so the selection is reflected immediately", () => {
    settled();
    const target = new Date(store().month.getFullYear(), store().month.getMonth(), 10);
    expect(gridDates().includes(target.getTime())).toBe(true);
    const selectedBefore = store()
      .weeks.flat()
      .filter((cell) => cell.isSelected).length;

    store().select(target);
    settled();

    // A stale grid would still report zero selected cells after a selection.
    const after = store()
      .weeks.flat()
      .filter((cell) => cell.isSelected);
    expect(selectedBefore).toBe(0);
    expect(after).toHaveLength(1);
    expect(after[0]?.date.getTime()).toBe(target.getTime());
    // Default mode is `single`, so a lone Date sets `isSelected` and not the
    // range flags — those need `mode: "range"` and a `{ from, to }` selection.
    expect(after[0]?.isRangeStart).toBe(false);
  });

  test("a range selection marks the endpoints and the days between them", () => {
    // The demo's range highlighting reads exactly these three flags, so they
    // have to come from the controller rather than from a page-side comparison.
    reset();
    Alpine.plugin(calendarPlugin({ mode: "range" }));
    resume();
    settled();

    const month = store().month;
    store().select(new Date(month.getFullYear(), month.getMonth(), 10));
    settled();
    store().select(new Date(month.getFullYear(), month.getMonth(), 14));
    settled();

    const cells = store().weeks.flat();
    expect(cells.filter((cell) => cell.isRangeStart)).toHaveLength(1);
    expect(cells.filter((cell) => cell.isRangeEnd)).toHaveLength(1);
    // The endpoints are selected, the days strictly between them are in range.
    expect(cells.filter((cell) => cell.isInRange)).toHaveLength(3);
    expect(cells.filter((cell) => cell.isSelected)).toHaveLength(2);
  });
});
