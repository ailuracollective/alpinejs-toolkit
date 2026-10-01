import type { CalendarMode, CalendarSelection } from "./types";

export interface CalendarSelectDetail {
  readonly date: Date | null;
  readonly mode: CalendarMode;
  readonly selected: CalendarSelection;
}

export interface CalendarMonthChangeDetail {
  readonly month: Date;
}

export interface CalendarEvents extends Record<string, unknown[]> {
  select: [CalendarSelectDetail];
  monthChange: [CalendarMonthChangeDetail];
  clear: [];
}
