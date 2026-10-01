/**
 * The `x-data` expressions the timer demo ships.
 *
 * Two Alpine rules shaped this file, both learned the hard way:
 *
 * 1. A `*property*` of the object literal creates no binding. Writing
 *    `{ clock: (ms) => …, timer: $timer({ mode: 'down', format: ({ remaining }) => clock(remaining ?? 0) }) }`
 *    leaves `clock` a free variable inside the `format` closure. The controller
 *    invokes that closure while building the view, so the whole `x-data` threw
 *    `clock is not defined`, and because the object never evaluated, the
 *    `clock(...)` reads in the `x-text` readouts failed too.
 *
 * 2. The usual workaround — starting the expression with `const` so Alpine wraps
 *    it in an IIFE — trades one bug for another. Alpine's wrapper for `let` /
 *    `const` is an **async** IIFE (`(async()=>{ … })()`), so the data is attached
 *    a microtask later than the children that read it: every child evaluated
 *    first and reported `timer is not defined`.
 *
 * So the object literal stays synchronous and self-contained, and the one
 * formatter is spliced into both places from a single source. Duplication of
 * source text is cheaper than a closure that cannot be bound.
 */

/**
 * Formats milliseconds as `mm:ss`, as an expression string.
 *
 * `formatted` in the package is a breakdown of ELAPSED in both directions, so a
 * countdown has to format `remaining` itself. Reading the `hours`/`minutes`/
 * `seconds` the custom callback is handed would tick *upwards* — which is what
 * this demo used to do.
 */
const CLOCK = `(ms) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  return String(m).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
}`;

/** A countdown that renders the time REMAINING, and exposes the raw fields. */
export function countdownTimerData(duration: number): string {
  return [
    "{",
    `  clock: ${CLOCK},`,
    "  timer: $timer({",
    `    duration: ${duration},`,
    // Self-contained: no reference to `clock`, so the object literal can stay
    // synchronous and no binding is needed.
    `    format: ({ remaining }) => (${CLOCK})(remaining ?? 0),`,
    "  }),",
    "}",
  ].join("\n");
}

/**
 * A countup over a limit, with a progress bar driven by `progress`.
 */
export function countupTimerData(limit: number): string {
  return `{ counter: $timer({ mode: 'up', limit: ${limit} }) }`;
}

/**
 * A stopwatch whose lap list is built from the `onLap` option, not from
 * `sw.laps`.
 *
 * `lap()` records the lap on the controller but emits no event, so the lap
 * fields carried by the reactive view `$timer()` returns are never refreshed by
 * it and a template bound to them stays frozen on the initial empty list.
 * `onLap` fires synchronously inside `lap()`, which is what makes a template
 * lap list work at all.
 */
export function stopwatchTimerData(): string {
  return [
    "{",
    "  laps: [],",
    "  sw: null,",
    "  init() {",
    "    this.sw = $timer({",
    "      mode: 'stopwatch',",
    "      onLap: (lap) => this.laps.push(lap.splitFormatted),",
    "    });",
    "  },",
    "}",
  ].join("\n");
}
