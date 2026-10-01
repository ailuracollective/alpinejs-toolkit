import { LIFECYCLE_DESTROYED } from "@ailura/alpinejs-core/constants";
import { BaseController } from "@ailura/alpinejs-core/controller";
import { generateId } from "@ailura/alpinejs-core/ids";
import { addMonths, isSameDay, isSameMonth, isToday, startOfMonth, subMonths } from "date-fns";

import type { CalendarEvents } from "./events";
import type {
  CalendarControllerOptions,
  CalendarDay,
  CalendarInstance,
  CalendarMode,
  CalendarMonthView,
  CalendarOptions,
  CalendarSelection,
} from "./types";
import { MAX_NUMBER_OF_MONTHS, MIN_NUMBER_OF_MONTHS } from "./types";

function normalizeNumberOfMonths(value?: number): number {
  if (value === undefined) return MIN_NUMBER_OF_MONTHS;
  const n = Math.trunc(value);
  if (n < MIN_NUMBER_OF_MONTHS) return MIN_NUMBER_OF_MONTHS;
  if (n > MAX_NUMBER_OF_MONTHS) return MAX_NUMBER_OF_MONTHS;
  return n;
}

type RangeSel = { from: Date; to?: Date };
const isRangeSel = (s: CalendarSelection): s is RangeSel =>
  !!s && typeof s === "object" && !Array.isArray(s) && !(s instanceof Date) && "from" in s;

function isDisabledDate(date: Date, options: CalendarOptions): boolean {
  if (options.minDate && date < options.minDate) return true;
  if (options.maxDate && date > options.maxDate) return true;
  const d = options.disabled;
  if (!d) return false;
  if (d instanceof Date) return isSameDay(date, d);
  if (Array.isArray(d)) return d.some((x) => x instanceof Date && isSameDay(date, x));
  if (typeof d === "function") return d(date);
  return false;
}

function buildDay(
  date: Date,
  month: Date,
  selected: CalendarSelection,
  mode: CalendarMode,
  disabled: boolean
): CalendarDay {
  let isSelected: boolean;
  if (!selected) isSelected = false;
  else if (selected instanceof Date) isSelected = isSameDay(date, selected);
  else if (Array.isArray(selected)) isSelected = selected.some((d) => isSameDay(date, d));
  else if (isRangeSel(selected))
    isSelected =
      (!!selected.from && isSameDay(date, selected.from)) ||
      (!!selected.to && isSameDay(date, selected.to));
  else isSelected = false;

  let inRange = false;
  if (mode === "range" && isRangeSel(selected) && selected.from && selected.to)
    inRange = date > selected.from && date < selected.to;

  const isRangeStart =
    mode === "range" && isRangeSel(selected) && !!selected.from && isSameDay(date, selected.from);
  const isRangeEnd =
    mode === "range" && isRangeSel(selected) && !!selected.to && isSameDay(date, selected.to);

  return {
    date,
    isCurrentMonth: isSameMonth(date, month),
    isToday: isToday(date),
    isSelected,
    isDisabled: disabled,
    isRangeStart,
    isRangeEnd,
    isInRange: inRange,
  };
}

export class CalendarController extends BaseController<CalendarEvents> implements CalendarInstance {
  readonly id: string;
  #month: Date;
  #mode: CalendarMode;
  #selected: CalendarSelection;
  #numberOfMonths: number;
  #options: CalendarOptions;

  constructor(options: CalendarOptions = {}, id?: string) {
    super();
    this.id = id ?? generateId("calendar");
    this.#options = options;
    this.#mode = options.mode ?? "single";
    this.#numberOfMonths = normalizeNumberOfMonths(options.numberOfMonths);
    this.#month = startOfMonth(options.month ?? new Date());
    this.#selected = options.selected ?? null;
  }

  get month(): Date {
    return this.#month;
  }
  get mode(): CalendarMode {
    return this.#mode;
  }
  get selected(): CalendarSelection {
    return this.#selected;
  }
  get numberOfMonths(): number {
    return this.#numberOfMonths;
  }
  get months(): CalendarMonthView[] {
    const out: CalendarMonthView[] = [];
    for (let i = 0; i < this.#numberOfMonths; i++) {
      const m = addMonths(this.#month, i);
      out.push({ month: m, weeks: this.weeksForMonth(m) });
    }
    return out;
  }
  get weeks(): CalendarDay[][] {
    return this.weeksForMonth(this.#month);
  }
  get weekdayLabels(): string[] {
    // Sunday-first, to match the column order `weeksForMonth` builds — the
    // store hands both to a consumer and a header that disagrees with the grid
    // is a silent off-by-one. Not localized: a locale-aware header means
    // `Intl` in the host, which is where the consumer's other strings live.
    return ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  }

  private weeksForMonth(month: Date): CalendarDay[][] {
    const start = startOfMonth(month);
    // Always 42 days, never 35 or 49: a grid that changes height with the
    // month makes every cell below it jump, and the padding days on the last
    // row are what make a two-row February feel broken.
    const firstDay = start.getDay();
    const days: CalendarDay[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() - firstDay + i);
      days.push(buildDay(d, month, this.#selected, this.#mode, isDisabledDate(d, this.#options)));
    }
    const weeks: CalendarDay[][] = [];
    for (let i = 0; i < 6; i++) weeks.push(days.slice(i * 7, (i + 1) * 7));
    return weeks;
  }

  prevMonth(): void {
    if (this.lifecycle === LIFECYCLE_DESTROYED) return;
    this.#month = subMonths(this.#month, 1);
    this.emit("monthChange", { month: this.#month });
  }

  nextMonth(): void {
    if (this.lifecycle === LIFECYCLE_DESTROYED) return;
    this.#month = addMonths(this.#month, 1);
    this.emit("monthChange", { month: this.#month });
  }

  goToMonth(date: Date): void {
    if (this.lifecycle === LIFECYCLE_DESTROYED) return;
    this.#month = startOfMonth(date);
    this.emit("monthChange", { month: this.#month });
  }

  goToToday(): void {
    this.goToMonth(new Date());
  }

  select(date: Date | null): void {
    if (this.lifecycle === LIFECYCLE_DESTROYED) return;
    if (date && isDisabledDate(date, this.#options)) return;
    if (date === null) {
      this.clear();
      return;
    }
    if (this.#mode === "single") {
      this.#selected = date;
    } else if (this.#mode === "multiple") {
      const arr = Array.isArray(this.#selected) ? ([...this.#selected] as Date[]) : [];
      const idx = arr.findIndex((d) => isSameDay(d, date));
      if (idx >= 0) arr.splice(idx, 1);
      else arr.push(date);
      this.#selected = arr;
    } else {
      // Three clicks per range, and the third starts over: first sets `from`,
      // second sets `to` (swapping them if the click lands before `from`), and
      // a click on an already-complete range opens a new one.
      const cur = this.#selected as { from?: Date; to?: Date } | null;
      if (
        !cur ||
        !(cur as { from?: Date }).from ||
        ((cur as { from?: Date }).from && (cur as { to?: Date }).to)
      ) {
        this.#selected = { from: date, to: undefined };
      } else {
        const from = (cur as { from: Date }).from;
        if (date < from) this.#selected = { from: date, to: from };
        else this.#selected = { from, to: date };
      }
    }
    this.emit("select", { date, mode: this.#mode, selected: this.#selected });
  }

  clear(): void {
    if (this.lifecycle === LIFECYCLE_DESTROYED) return;
    this.#selected = null;
    this.emit("clear");
    this.emit("select", { date: null, mode: this.#mode, selected: null });
  }

  matches(_date: Date, matcher: unknown): boolean {
    if (typeof matcher === "function") return (matcher as (d: Date) => boolean)(_date);
    return false;
  }

  isSelected(date: Date): boolean {
    return buildDay(date, this.#month, this.#selected, this.#mode, false).isSelected;
  }

  isDisabled(date: Date): boolean {
    return isDisabledDate(date, this.#options);
  }

  isToday(date: Date): boolean {
    return isToday(date);
  }

  isSameMonth(date: Date, month?: Date): boolean {
    return isSameMonth(date, month ?? this.#month);
  }

  isInRange(date: Date): boolean {
    if (this.#mode !== "range" || !isRangeSel(this.#selected)) return false;
    const r = this.#selected;
    if (!r.from || !r.to) return false;
    return date > r.from && date < r.to;
  }

  isRangeStart(date: Date): boolean {
    if (this.#mode !== "range" || !isRangeSel(this.#selected)) return false;
    return !!this.#selected.from && isSameDay(date, this.#selected.from);
  }

  isRangeEnd(date: Date): boolean {
    if (this.#mode !== "range" || !isRangeSel(this.#selected)) return false;
    return !!this.#selected.to && isSameDay(date, this.#selected.to);
  }

  format(date: Date, _pattern: string): string {
    // `_pattern` is accepted and ignored: the signature is the one consumers
    // already call, and honouring it would mean shipping locale data for a
    // headless package. Pass a pattern only if you need the argument to exist.
    try {
      return new Intl.DateTimeFormat(undefined).format(date);
    } catch {
      return date.toISOString();
    }
  }

  formatMonth(month?: Date): string {
    const d = month ?? this.#month;
    return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(d);
  }
  formatYear(month?: Date): string {
    return new Intl.DateTimeFormat(undefined, { year: "numeric" }).format(month ?? this.#month);
  }

  toStore(): import("./types").CalendarStore {
    return this as unknown as import("./types").CalendarStore;
  }
}

export function createCalendarController(
  options: CalendarControllerOptions = {}
): CalendarController {
  const { id, ...rest } = options;
  const controller = new CalendarController(rest, id);
  controller.mount();
  return controller;
}
