import type { Alpine } from "alpinejs";

/** Calendar display mode. */
export type CalendarMode = "single" | "range" | "multiple";

/** A date range with optional bounds. */
export type CalendarDateRange = {
  readonly from?: Date;
  readonly to?: Date;
};

/** Selection value depending on the current mode. */
export type CalendarSelection = Date | Date[] | CalendarDateRange | null;

/** One visible month in the calendar view. */
export interface CalendarMonthView {
  readonly month: Date;
  readonly weeks: CalendarDay[][];
}

/** A single day cell in the month grid. */
export interface CalendarDay {
  readonly date: Date;
  readonly isCurrentMonth: boolean;
  readonly isToday: boolean;
  readonly isSelected: boolean;
  readonly isDisabled: boolean;
  readonly isRangeStart: boolean;
  readonly isRangeEnd: boolean;
  readonly isInRange: boolean;
}

/**
 * The four state fields as one object.
 *
 * Declared for consumers typing a snapshot; nothing inside the package builds
 * one, and it is not what the store exposes — `$store.calendar` carries
 * `weeks` and `weekdayLabels` too.
 */
export interface CalendarState {
  readonly month: Date;
  readonly mode: CalendarMode;
  readonly selected: CalendarSelection;
  readonly numberOfMonths: number;
}

/** Options accepted by `createCalendar()`. */
export interface CalendarOptions {
  readonly minDate?: Date;
  readonly maxDate?: Date;
  readonly mode?: CalendarMode;
  readonly month?: Date;
  readonly selected?: CalendarSelection;
  readonly disabled?: Date | Date[] | ((date: Date) => boolean);
  readonly numberOfMonths?: number;
}

/**
 * Options for `createCalendarController`.
 *
 * `CalendarOptions` plus the `id`, which used to be a second positional
 * parameter: `createCalendarController(options, id)` made the two arguments
 * distinguishable only by position, and neither was optional in a readable way.
 */
export type CalendarControllerOptions = CalendarOptions & {
  /** Controller id. Generated when absent. */
  readonly id?: string;
};

/** Options for the plugin factory — includes the store rename. */
export interface CreateCalendarOptions extends CalendarControllerOptions {
  readonly storeKey?: string;
}

/** Consumer-facing calendar surface. */
export interface CalendarInstance {
  readonly month: Date;
  readonly numberOfMonths: number;
  readonly months: CalendarMonthView[];
  readonly mode: CalendarMode;
  readonly selected: CalendarSelection;
  readonly weeks: CalendarDay[][];
  readonly weekdayLabels: string[];
  prevMonth(): void;
  nextMonth(): void;
  goToMonth(date: Date): void;
  goToToday(): void;
  select(date: Date | null): void;
  clear(): void;
  isSelected(date: Date): boolean;
  isDisabled(date: Date): boolean;
  isToday(date: Date): boolean;
  isSameMonth(date: Date, month?: Date): boolean;
  isInRange(date: Date): boolean;
  isRangeStart(date: Date): boolean;
  isRangeEnd(date: Date): boolean;
  format(date: Date, pattern: string): string;
  formatMonth(month?: Date): string;
  formatYear(month?: Date): string;
}

/** Alpine-facing store surface. */
export interface CalendarStore {
  readonly month: Date;
  readonly mode: CalendarMode;
  readonly selected: CalendarSelection;
  /**
   * The visible month grid, six weeks of seven days, recomputed on every
   * `select` and `monthChange`.
   *
   * The controller has always built this; the store used to expose only
   * `month`, `mode` and `selected`, which left every consumer to rebuild the
   * grid by hand. Doing that is not a presentation choice — it is a second
   * implementation of {@link CalendarController.weeks}, and the two drift: the
   * controller's grid is Sunday-first, so a hand-rolled Monday-first grid
   * disagrees with the package about which day a month starts on.
   */
  readonly weeks: readonly (readonly CalendarDay[])[];
  /** Weekday headers matching the column order of {@link weeks}. */
  readonly weekdayLabels: readonly string[];
  prevMonth(): void;
  nextMonth(): void;
  goToMonth(date: Date): void;
  goToToday(): void;
  select(date: Date | null): void;
  clear(): void;
  isSelected(date: Date): boolean;
  destroy(): void;
}

/** Default `$store` key registered by {@link calendarPlugin}. */
export const DEFAULT_CALENDAR_STORE_KEY = "calendar";

/** Typed view of `Alpine` the calendar plugin uses. */
export type CalendarAlpine = Alpine;

/** `Alpine.plugin()` callback signature. */
export type CalendarPluginCallback = (alpine: Alpine) => void;

/** Minimum supported `numberOfMonths`. */
export const MIN_NUMBER_OF_MONTHS = 1;

/** Maximum supported `numberOfMonths`. */
export const MAX_NUMBER_OF_MONTHS = 12;
