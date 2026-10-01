---
title: Calendar
---

@ailura/alpinejs-calendar

A headless calendar: the current month, the selection, and the navigation. It renders
nothing, so the grid, the week header, and the styling stay yours.

## Install

```sh
pnpm add alpinejs @ailura/alpinejs-calendar
```

## Register the plugin

Do this once, before `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import calendarPlugin from "@ailura/alpinejs-calendar";

Alpine.plugin(calendarPlugin());

Alpine.start();
```

That registers a `calendar` store, so everything below is reachable at `$store.calendar`.

## Minimal example

Navigate months, jump to today, and select a date.

```html
<div x-data>
  <p>
    <button @click="$store.calendar.prevMonth()">Prev</button>
    <span x-text="$store.calendar.month.toISOString().slice(0, 7)"></span>
    <button @click="$store.calendar.nextMonth()">Next</button>
    <button @click="$store.calendar.goToToday()">Today</button>
  </p>

  <p>
    Selected:
    <span x-text="$store.calendar.selected ?? 'none'"></span>
    <button @click="$store.calendar.select(new Date())">Select today</button>
    <button @click="$store.calendar.clear()">Clear</button>
  </p>
</div>
```

`month` is a `Date`, not a string, and `selected` is whatever your mode allows. The
plugin owns the navigation and the bounds; computing the weeks and rendering the grid
is your code.

## Constraining the range

`minDate` and `maxDate` go to the plugin factory, not to a method. There is no
`configure()` on the store: the range is fixed when the plugin is created.

```ts
calendarPlugin({
  minDate: new Date("2026-01-01"),
  maxDate: new Date("2026-12-31"),
});
```

The store refuses to select a date outside the range, silently. The bounds are not
readable from the store, so keep the two dates you passed in your own module and
compare against those — otherwise the last day of the month looks broken and nobody
knows why.

```html
<button
  @click="
    if (day >= bounds.min && day <= bounds.max)
      $store.calendar.select(day)
  "
  :disabled="day < bounds.min || day > bounds.max"
>
  <span x-text="day.getDate()"></span>
</button>
```

## Variants

**Pick a mode.** `mode` decides whether `selected` is one date or several. Read it
back off the store; set it at the factory.

```ts
calendarPlugin({ mode: "range" });
```

The mode is readable from the store, which is what the UI binds to.

```html
<p>Mode: <span x-text="$store.calendar.mode"></span></p>
```

**Jump to a month.** `goToMonth` takes any date; the month is what matters.

```js
$store.calendar.goToMonth(new Date("2027-03-15"));
```

## API reference

| Name                               | Type   | Purpose                                        |
| ---------------------------------- | ------ | ---------------------------------------------- |
| `$store.calendar.month`            | store  | The month currently shown, as a `Date`.        |
| `$store.calendar.selected`         | store  | The current selection.                         |
| `$store.calendar.mode`             | store  | The selection mode.                            |
| `$store.calendar.prevMonth()`      | method | Step back one month.                           |
| `$store.calendar.nextMonth()`      | method | Step forward one month.                        |
| `$store.calendar.goToMonth(date)`  | method | Jump to the month of a given date.             |
| `$store.calendar.goToToday()`      | method | Jump to the current month.                     |
| `$store.calendar.select(date)`     | method | Select a date, subject to the mode and bounds. |
| `$store.calendar.isSelected(date)` | method | Whether a date is selected.                    |
| `$store.calendar.clear()`          | method | Clear the selection.                           |
| `$store.calendar.destroy()`        | method | Tear the store down.                           |

`mode`, `month` and `selected` are readable from the store. The bounds are **not**: set
them on the factory and keep your own copy if you need to compare against them.

:::caution[`select()` respects the bounds, your click handler has to]
The store refuses a date outside the range without saying so, and it does not expose
the range either. If your day cell handles the click, check the bound you passed to
the factory — otherwise the button looks broken on the first and last month, which is
where nobody tests.
:::

## Plugin options

```ts
calendarPlugin({ id: "app-calendar", storeKey: "cal" });
```
