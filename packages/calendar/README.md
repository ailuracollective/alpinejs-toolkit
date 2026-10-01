# @ailura/alpinejs-calendar

<p align="center">

[![bundlephobia minzip](https://badgen.net/bundlephobia/minzip/@ailura/alpinejs-calendar)](https://bundlephobia.com/package/@ailura/alpinejs-calendar)

</p>

> Headless calendar controller — date-fns month grids, single / range / multiple selection, disabled dates and month navigation, on `@ailura/alpinejs-core`. The package computes the 42-cell grid and every day predicate; you render it.

## Installation

```sh
pnpm add @ailura/alpinejs-calendar alpinejs
# or
npm install @ailura/alpinejs-calendar alpinejs
```

Requires `alpinejs@^3.0.0` and `date-fns@^3.0.0` as peers — `date-fns` is never
bundled, so the version you already have is the one that runs.
`@ailura/alpinejs-core` is a **peer dependency**, not a dependency:
no package in this toolkit has a `dependencies` block, so the host
installs it too.

## Usage

### 1. Standalone (framework-agnostic)

```ts
import { createCalendarController } from "@ailura/alpinejs-calendar";

const ctrl = createCalendarController({ mode: "range", minDate: new Date() });
ctrl.on("select", (detail) => console.log(detail.selected));
ctrl.on("monthChange", (detail) => console.log(detail.month));

ctrl.weeks; // 6 weeks × 7 CalendarDay, Sunday-first
ctrl.weekdayLabels; // ['Su','Mo','Tu','We','Th','Fr','Sa'] — same column order

ctrl.select(new Date(2026, 0, 12));
ctrl.nextMonth();
ctrl.destroy(); // every mutation after this is a silent no-op
```

`createCalendarController()` already calls `mount()`, so the controller is live
before you touch it. The grid is recomputed on every read of `weeks`/`months`
and after each `select` or `monthChange` — it is never stale.

### 2. Alpine

```ts
import Alpine from "alpinejs";
import calendarPlugin from "@ailura/alpinejs-calendar";

Alpine.plugin(calendarPlugin({ mode: "single" }));
Alpine.start();
```

The plugin registers `$store.calendar`, and nothing else — there are no
directives. A minimal single-select month:

```html
<div x-data>
  <div class="flex items-center gap-2">
    <button @click="$store.calendar.prevMonth()">‹</button>
    <strong x-text="$store.calendar.formatMonth()"></strong>
    <button @click="$store.calendar.nextMonth()">›</button>
    <button @click="$store.calendar.goToToday()">Today</button>
  </div>

  <div class="grid grid-cols-7 gap-1">
    <template x-for="label in $store.calendar.weekdayLabels" :key="label">
      <span class="text-center text-xs" x-text="label"></span>
    </template>
  </div>

  <div class="grid grid-cols-7 gap-1">
    <template x-for="day in $store.calendar.weeks.flat()" :key="day.date.getTime()">
      <button
        :disabled="day.isDisabled"
        :aria-pressed="day.isSelected"
        :class="day.isToday ? 'font-bold' : ''"
        @click="$store.calendar.select(day.date)"
        x-text="day.date.getDate()"
      ></button>
    </template>
  </div>
</div>
```

Every visual decision is yours: `weeks` is a plain array of arrays, so a
`<table>`, a CSS grid, or a virtualised viewport all read the same data.

## API

### Exports

| Export                       | Description                                                                                                                                         | Type       |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `CalendarController`         | Framework-agnostic controller — owns month, mode, selection and the day predicates                                                                  | `class`    |
| `createCalendarController`   | `createCalendarController(options?) => CalendarController`, already `mount()`ed                                                                     | `function` |
| `calendarPlugin`             | `Alpine.plugin()` factory — `calendarPlugin(options?) => Plugin`; registers `$store`                                                                | `function` |
| `DEFAULT_CALENDAR_STORE_KEY` | Default `$store` key — `"calendar"`                                                                                                                 | `string`   |
| `MIN_NUMBER_OF_MONTHS`       | Lower clamp on `numberOfMonths` — `1`                                                                                                               | `number`   |
| `MAX_NUMBER_OF_MONTHS`       | Upper clamp on `numberOfMonths` — `12`                                                                                                              | `number`   |
| `CalendarMode`               | `'single' \| 'range' \| 'multiple'`                                                                                                                 | `type`     |
| `CalendarDateRange`          | `{ from?: Date; to?: Date }` — the range-mode selection shape                                                                                       | `type`     |
| `CalendarSelection`          | `Date \| Date[] \| CalendarDateRange \| null` — the value `selected` can hold                                                                       | `type`     |
| `CalendarDay`                | One grid cell — `date` plus `isCurrentMonth`, `isToday`, `isSelected`, `isDisabled`, `isRangeStart`, `isRangeEnd`, `isInRange`                      | `type`     |
| `CalendarMonthView`          | `{ month: Date; weeks: CalendarDay[][] }` — one entry of `months`                                                                                   | `type`     |
| `CalendarState`              | The four state fields as one object. Exported for consumers typing a snapshot; nothing in the package builds one, and it is **not** the store shape | `type`     |
| `CalendarInstance`           | The read/write surface the controller implements — what a duck-typed consumer can rely on                                                           | `type`     |
| `CalendarStore`              | The `$store.calendar` surface (see below)                                                                                                           | `type`     |
| `CalendarOptions`            | `minDate`, `maxDate`, `mode`, `month`, `selected`, `disabled`, `numberOfMonths`                                                                     | `type`     |
| `CalendarControllerOptions`  | `CalendarOptions` plus `id`                                                                                                                         | `type`     |
| `CreateCalendarOptions`      | `CalendarControllerOptions` plus `storeKey`                                                                                                         | `type`     |
| `CalendarEvents`             | Event map — `select`, `monthChange`, `clear`                                                                                                        | `type`     |
| `CalendarSelectDetail`       | `{ date: Date \| null; mode; selected }`                                                                                                            | `type`     |
| `CalendarMonthChangeDetail`  | `{ month: Date }`                                                                                                                                   | `type`     |
| `CalendarAlpine`             | Typed view of `Alpine` the plugin uses                                                                                                              | `type`     |
| `CalendarPluginCallback`     | `Alpine.plugin()` callback signature                                                                                                                | `type`     |

### Controller API

| Member                                    | Description                                                                                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `month`                                   | First day of the visible month, always normalised by `startOfMonth`                                                                         |
| `mode`                                    | The mode the controller was constructed with; it never changes                                                                              |
| `selected`                                | `Date` in `single`, `Date[]` in `multiple`, `{ from, to }` in `range`, `null` when empty                                                    |
| `numberOfMonths`                          | Clamped to `1…12`                                                                                                                           |
| `weeks`                                   | Six weeks × seven days for `month` only, each cell carrying every predicate                                                                 |
| `months`                                  | `{ month, weeks }` for `numberOfMonths` consecutive months starting at `month`                                                              |
| `weekdayLabels`                           | `['Su','Mo','Tu','We','Th','Fr','Sa']` — Sunday-first, matching the column order of `weeks`                                                 |
| `prevMonth()` / `nextMonth()`             | Step one month back/forward and emit `monthChange`. No-op once destroyed.                                                                   |
| `goToMonth(date)`                         | Jump to any date; only its month is kept, normalised to the 1st                                                                             |
| `goToToday()`                             | `goToMonth(new Date())`                                                                                                                     |
| `select(date)`                            | Applies the mode's rule. `null` clears. **Silently returns without emitting** if the date is disabled by `minDate` / `maxDate` / `disabled` |
| `clear()`                                 | Sets `selected` to `null` and emits `clear` then `select` with `date: null`                                                                 |
| `isSelected(date)`                        | Same predicate as the cell's `isSelected`                                                                                                   |
| `isDisabled(date)`                        | `true` outside `[minDate, maxDate]` or when `disabled` matches                                                                              |
| `isToday(date)`                           | `date-fns` `isToday`                                                                                                                        |
| `isSameMonth(date, month?)`               | Compares against `month` unless a second date is given                                                                                      |
| `isInRange(date)`                         | Strictly between `from` and `to`. **Always `false` outside `range` mode**                                                                   |
| `isRangeStart(date)` / `isRangeEnd(date)` | Endpoints of a complete range. **`false` in any mode other than `range`**, and while `to` is still unset                                    |
| `format(date, pattern)`                   | Locale default date string. **`pattern` is ignored**                                                                                        |
| `formatMonth(month?)`                     | `Intl` `month: 'long', year: 'numeric'`, e.g. `March 2026`                                                                                  |
| `formatYear(month?)`                      | `Intl` year, e.g. `2026`                                                                                                                    |
| `toStore()`                               | Returns `this` cast to `CalendarStore`. The store type is a subset of the controller, so there is no wrapper object                         |

### Store API

The store is a **writable projection**, not the controller: it carries the state
plus the mutators, and `plugin.ts` overwrites it from `select` / `monthChange`.
It does not expose every controller method.

```ts
$store.calendar.month; // Date
$store.calendar.mode; // 'single' | 'range' | 'multiple'
$store.calendar.selected; // CalendarSelection
$store.calendar.weeks; // readonly (readonly CalendarDay[])[] — 6 × 7
$store.calendar.weekdayLabels; // readonly string[]

$store.calendar.prevMonth();
$store.calendar.nextMonth();
$store.calendar.goToMonth(new Date(2026, 2, 1));
$store.calendar.goToToday();
$store.calendar.select(day.date);
$store.calendar.clear();
$store.calendar.isSelected(day.date);
$store.calendar.destroy();
```

| Method                   | On the store | Notes                                                                                         |
| ------------------------ | ------------ | --------------------------------------------------------------------------------------------- |
| `prevMonth()`            | yes          |                                                                                               |
| `nextMonth()`            | yes          |                                                                                               |
| `goToMonth(date)`        | yes          |                                                                                               |
| `goToToday()`            | yes          |                                                                                               |
| `select(date)`           | yes          | Silently returns without emitting if `date` is disabled                                       |
| `clear()`                | yes          |                                                                                               |
| `isSelected(date)`       | yes          |                                                                                               |
| `destroy()`              | yes          | Tears the controller down. Never called for you — the host that registered the plugin owns it |
| `isDisabled(date)`       | **no**       | Read `day.isDisabled` off the cell instead, or drive the controller standalone                |
| `isToday(date)`          | **no**       | Same — `day.isToday`                                                                          |
| `isInRange(date)`        | **no**       | Same — `day.isInRange`                                                                        |
| `isRangeStart/End(date)` | **no**       | Same — `day.isRangeStart` / `day.isRangeEnd`                                                  |
| `formatMonth()`          | **no**       | Call `Intl` yourself, or use the controller standalone                                        |
| `months`                 | **no**       | The store forwards `weeks` only; `numberOfMonths > 1` needs the controller                    |

### Options

```ts
type CreateCalendarOptions = {
  id?: string; // instance id — defaults to generateId('calendar')
  storeKey?: string; // $store key — default 'calendar'
  minDate?: Date; // days before it are disabled
  maxDate?: Date; // days after it are disabled
  mode?: "single" | "range" | "multiple"; // default 'single'
  month?: Date; // visible month — defaults to the current month, normalised to the 1st
  selected?: CalendarSelection; // initial selection — defaults to null
  disabled?: Date | Date[] | ((date: Date) => boolean); // extra disabled days
  numberOfMonths?: number; // default 1, clamped to 1…12
};
```

| Option              | Default      | Effect                                                                                |
| ------------------- | ------------ | ------------------------------------------------------------------------------------- |
| `mode`              | `'single'`   | Decides the shape of `selected` and the rule `select()` applies. **Read once**        |
| `numberOfMonths`    | `1`          | `Math.trunc` then clamped to `[1, 12]`. A float of `1.9` becomes `1`                  |
| `disabled`          | —            | A `Date` or `Date[]` matches by calendar day; a function is called per cell           |
| `minDate`/`maxDate` | —            | Compared as instants, not calendar days. `minDate` at noon excludes that same morning |
| `month`             | `new Date()` | Only the month is read; the day of month is discarded                                 |
| `storeKey`          | `'calendar'` | The `$store` key the plugin registers under                                           |

### Avoiding name collisions

Only the store name moves; the controller is untouched.

```ts
Alpine.plugin(calendarPlugin({ storeKey: "booking" })); // → $store.booking
```

The exported constant `DEFAULT_CALENDAR_STORE_KEY` keeps the rename
discoverable from TypeScript. There is no magic key to rename — this package
registers no magics.

### Events

```ts
import type { CalendarSelectDetail, CalendarMonthChangeDetail } from "@ailura/alpinejs-calendar";

ctrl.on("select", (detail: CalendarSelectDetail) => {
  detail.date; // the day clicked, or null when cleared
  detail.mode; // 'single' | 'range' | 'multiple'
  detail.selected; // the whole selection after the change
});
ctrl.on("monthChange", (detail: CalendarMonthChangeDetail) => detail.month);
ctrl.on("clear", () => {
  /* no payload */
});
```

`clear()` emits `clear` first and then `select` with `date: null`, so a listener
on `select` alone still sees the reset.

## Selection modes

The mode is fixed at construction and decides both the shape of `selected` and
what a click does.

```ts
// single — one Date, replaced by the next click
calendarPlugin({ mode: "single" });

// multiple — a Date[], toggled per day
calendarPlugin({ mode: "multiple", selected: [new Date(2026, 0, 5)] });

// range — { from, to }; three clicks per range
calendarPlugin({ mode: "range" });
```

In `range` mode: the first click sets `from` with `to` unset; the second sets
`to`, swapping the two if the click lands _before_ `from`; a third click on a
completed range starts a new one. While `to` is unset there is no `isRangeEnd`
and no `isInRange` — the half-open range has no interior to shade.

`isSelected` and the cell's `isSelected` are true at **both** endpoints of a
range; `isInRange` is strictly between them.

## SSR

> SSR-safe — no `window`/`document` is touched at any point, import time
> included. The controller is pure state plus `date-fns`, so it constructs and
> navigates on the server. One caveat: a selection built from `new Date()` on the
> server and one built on the client can straddle a midnight boundary, so pass
> an explicit `selected` when you hydrate.

## Limitations

- **The grid is always 42 cells, six rows, Sunday-first.** There is no option
  for week start, first day of week, or locale; `weekdayLabels` are the
  hard-coded `['Su'…'Sa']`. A Monday-first calendar means reversing each row and
  the labels yourself, or sorting the cells — the package will not do it.
- **No time, no week view, no locale formatting.** `format(date, pattern)`
  accepts a pattern and **ignores it**, returning `Intl`'s locale default;
  `formatMonth()` / `formatYear()` are the only format helpers. Localised month
  names come from your own `Intl` call.
- **The store exposes less than the controller.** `isDisabled`, `isToday`,
  `isInRange`, `isRangeStart`, `isRangeEnd`, `formatMonth`, `months` and
  `numberOfMonths` are not forwarded — read the flags off `weeks` cells instead
  (which is what the demo does), or drive the controller standalone.
- **`numberOfMonths > 1` is controller-only.** The store forwards `weeks` for
  the first month only; `months` never reaches `$store.calendar`.
- **`select()` on a disabled day is a silent no-op** — no event, no error. If
  your UI needs to explain the refusal, check `isDisabled(date)` first.
- **The plugin never calls `controller.mount()`.** The controller declares no
  `setup()`, so behaviour is identical, but `lifecycle` stays `'idle'` and
  `$store.calendar.destroy()` is the only teardown handle — nothing calls it for
  you.
- **`CalendarState` is exported but unused.** No code path in the package builds
  one, and it is narrower than the store.
- **No keyboard or ARIA.** Nothing here produces `role="grid"`, roving
  tabindex, or arrow-key navigation — the package is the date logic, and the
  accessibility of the rendered calendar is yours to build.

## Size

`4.61 kB raw / 1.85 kB gzip` · budget `3.5 kB` · externalized peers: `alpinejs`, `@ailura/alpinejs-core`, `date-fns` · `size-limit` + `publint` + `attw` verified.

## Architecture

[Primitives layer](../../ARCHITECTURE.md) — controllers own state, Alpine owns reactivity. See canon, guards, and SSR rules in [ARCHITECTURE.md](../../ARCHITECTURE.md).

## Testing

```sh
pnpm test              # vp test (happy-dom)
pnpm run typecheck     # tsc --noEmit
```

Uses `@ailura/alpinejs-testing` — `html`/`mount`/`settled`/`start`/`resume`/`reset`. See [ARCHITECTURE.md §8](../../ARCHITECTURE.md).

## License

MIT
