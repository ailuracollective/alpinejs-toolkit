import { guardStore } from "@ailura/alpinejs-core/guards";
import { readAlpineStore, resolveStoreKey } from "@ailura/alpinejs-core/registration";
import type { Alpine } from "alpinejs";

import { CalendarController } from "./controller";
import {
  type CalendarStore,
  type CreateCalendarOptions,
  DEFAULT_CALENDAR_STORE_KEY,
} from "./types";

const packageName = "@ailura/alpinejs-calendar";

export function calendarPlugin(options: CreateCalendarOptions = {}): (alpine: Alpine) => void {
  const storeKey = resolveStoreKey(options, DEFAULT_CALENDAR_STORE_KEY);

  return function registerCalendar(alpine: Alpine): void {
    const controller = new CalendarController(options, options.id);

    // Every field is writable on the snapshot, because the controller owns
    // the real state and this object only exists to be re-rendered: `sync`
    // overwrites the whole projection on the next event.
    const store: CalendarStore = {
      month: controller.month,
      mode: controller.mode,
      selected: controller.selected,
      weeks: controller.weeks,
      weekdayLabels: controller.weekdayLabels,
      prevMonth: () => controller.prevMonth(),
      nextMonth: () => controller.nextMonth(),
      goToMonth: (d: Date) => controller.goToMonth(d),
      goToToday: () => controller.goToToday(),
      select: (d: Date | null) => controller.select(d),
      clear: () => controller.clear(),
      isSelected: (d: Date) => controller.isSelected(d),
      destroy: () => controller.destroy(),
    };

    const sync = (): void => {
      const proxy = readAlpineStore<CalendarStore>(alpine, storeKey);
      // `sync` writes the derived fields, so the target is the store's shape with
      // those four dropped and re-added as writable: intersecting a readonly
      // declaration with a mutable one stays readonly, which is what made
      // `target.weeks = …` a compile error.
      const target = (proxy ?? store) as Omit<
        CalendarStore,
        "month" | "mode" | "selected" | "weeks"
      > & {
        month: Date;
        mode: string;
        selected: import("./types").CalendarSelection;
        weeks: import("./types").CalendarDay[][];
      };
      target.month = controller.month;
      target.mode = controller.mode;
      target.selected = controller.selected;
      // The grid is derived from `month` and `selected`, so it has to be
      // rebuilt here too — a template reading `store.weeks` after a selection
      // change would otherwise keep showing the old range.
      target.weeks = controller.weeks;
    };
    controller.on("select", sync);
    controller.on("monthChange", sync);

    guardStore(alpine, storeKey, store, packageName);
  };
}

export default calendarPlugin;
