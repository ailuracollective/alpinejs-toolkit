# @ailura/alpinejs-testing

> Shared Alpine integration-test helpers — `html`, `mount`, `settled`, `start`,
> `resume`, `reset` — so a package's DOM tests are the same six lines in all 37
> of them.

**This package is not published.** It is `private: true`, it has no build step,
no `dist` and no `vite.config.ts`; its `exports` map points straight at the
TypeScript source. It is a workspace devDependency only, and it must never be
imported from plugin runtime code or bundled into a `dist`.

<!-- No bundlephobia badge: there is no published bundle to point at. -->

## Installation

```sh
pnpm add -D @ailura/alpinejs-testing alpinejs
# or
npm install -D @ailura/alpinejs-testing alpinejs
```

Requires `alpinejs@^3.0.0` as peer. Dev-only — never import from plugin runtime
or bundle into `dist`.

## Usage

### The lifecycle

Alpine holds **global singleton state**: one reactivity system, one mutation
observer, one `document.body` scan. `start` / `resume` / `reset` is the trio
that makes that safe across a file of tests — start once, resume before each
test, reset after each one.

```ts
// test/setup.ts — once per test file
import { onReset } from "@ailura/alpinejs-testing";
import { resetRegistrationTracking } from "@ailura/alpinejs-core/guards";
import { resetIdCounter } from "@ailura/alpinejs-core/ids";

onReset(resetRegistrationTracking);
onReset(resetIdCounter);
```

```ts
// accordion/dom.test.ts
// @vitest-environment happy-dom
import "@testing-library/jest-dom/vitest";
import { html, mount, reset, resume, settled, start } from "@ailura/alpinejs-testing";
import { screen } from "@testing-library/dom";
import { afterEach, beforeAll, beforeEach, test } from "vite-plus/test";

import accordionPlugin from "../src/plugin";

beforeAll(() => start(accordionPlugin())); // exactly once per file
beforeEach(() => resume());
afterEach(() => reset());

test("opens an item on click", async () => {
  mount(
    html(`
      <div x-data x-init="$store.accordion.create('faq'); $store.accordion.createItem('faq', 'item-1')">
        <button @click="$store.accordion.toggle('faq', 'item-1')">item 1</button>
        <div x-show="$store.accordion.isOpen('faq', 'item-1')">Panel content</div>
      </div>
    `)
  );
  await settled();

  screen.getByText("item 1").click();
  await settled();

  expect(screen.getByText("Panel content")).toBeVisible();
});
```

`settled()` is the one to reach for after every interaction: it is two
`Alpine.nextTick()` calls — the first drains the reactive queue, the second lets
the resulting DOM writes land.

### `html()` returns a wrapper, not your element

`html(snippet)` creates a detached `div` and assigns `snippet` to its
`innerHTML`, so what you get back is that wrapper. Select into it:

```ts
const root = html(`<div x-data>…</div>`);
mount(root);
await settled();

const panel = root.querySelector("[data-testid='panel']")!;
```

### Registration-only tests: the fake Alpine

A plugin's registration callback touches several Alpine surfaces at once, so a
hand-written stub that implements only the one a test cares about breaks the
moment the package grows a directive. `createMockAlpine` records all three
instead of performing them.

```ts
// @vitest-environment happy-dom
import { createMockAlpine } from "@ailura/alpinejs-testing/mock";
import { expect, test } from "vite-plus/test";

import accordionPlugin from "../src/plugin";

test("registers the store under the default key", () => {
  const { alpine, stores, magics, directives } = createMockAlpine();

  accordionPlugin()(alpine);

  expect([...stores.keys()]).toEqual(["accordion"]);
  // A store-only package records nothing else. A package that also registers a
  // magic or a directive adds it to `magics` / `directives` with the same
  // `guardMagic` / `guardDirective` call — that is the assertion this exists
  // for, because a hand-written stub is what breaks when the package grows one.
  expect(magics.size).toBe(0);
  expect(directives.size).toBe(0);
});
```

`Alpine.store(name, value)` writes and `Alpine.store(name)` reads, matching the
real overloads — which is what `guardStore` relies on — and
`Alpine.directive()` returns a `{ before() {} }` chain, because `guardDirective`
hands that chain back to its caller and a stub returning `undefined` would make
`before()` throw for the wrong reason.

## API

### Subpaths

| Subpath                         | Exports                                                                           |
| ------------------------------- | --------------------------------------------------------------------------------- |
| `@ailura/alpinejs-testing`      | `html`, `mount`, `settled`, `start`, `resume`, `reset`, `onReset`, `AlpinePlugin` |
| `@ailura/alpinejs-testing/mock` | `createMockAlpine`, `MockAlpine`, `MockMagicCallback`                             |

### The lifecycle helpers

| Export         | Signature                          | Description                                                                                                                                                                                                  |
| -------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `html`         | `(snippet: string) => HTMLElement` | Creates a **detached** `div` and assigns `snippet` to its `innerHTML`. The returned element is the wrapper, not the snippet's root. The node is not in the document, so Alpine ignores it until you mount it |
| `mount`        | `(el: HTMLElement) => void`        | `document.body.append(el)` — moves the node, it does not clone it. `reset()` is what removes it                                                                                                              |
| `settled`      | `() => Promise<void>`              | `await Alpine.nextTick()` twice. Flushes the reactive queue **and** the DOM writes it produced                                                                                                               |
| `start`        | `(plugin: AlpinePlugin) => void`   | `Alpine.plugin(plugin)` then `Alpine.start()`. **Once per file**, in `beforeAll` — a second `Alpine.start()` warns and re-initialising mid-file leaks observers between tests                                |
| `resume`       | `() => void`                       | `Alpine.startObservingMutations()`. Call in `beforeEach`, after any state you reset. The observer is stopped by `reset()` so teardown DOM removal does not re-initialise a tree that is being destroyed      |
| `reset`        | `() => void`                       | `stopObservingMutations()` → `destroyTree(document.body)` → `body.replaceChildren()` → run every `onReset` hook, in registration order. Call in `afterEach`                                                  |
| `onReset`      | `(hook: () => void) => () => void` | Registers a hook `reset()` runs last. This is how per-process state (core's guard owner map, its id counter, singleton caches) is cleared **without `testing` depending on `core`**. Returns an unsubscribe  |
| `AlpinePlugin` | `(alpine: Alpine) => void`         | The `Alpine.plugin()` argument type                                                                                                                                                                          |

### `/mock`

| Export                  | Description                                                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `createMockAlpine()`    | `{ alpine, stores, magics, directives }` — `alpine` is cast to `Alpine` for handing to a plugin; the three `Map`s record what it registered |
| `MockAlpine.stores`     | `Map<string, unknown>` — key → value                                                                                                        |
| `MockAlpine.magics`     | `Map<string, MockMagicCallback>`                                                                                                            |
| `MockAlpine.directives` | `Map<string, DirectiveCallback>`                                                                                                            |
| `MockMagicCallback`     | `(el: Element, options: unknown) => unknown` — mirrors `Alpine.magic()`                                                                     |

## Setup

Two things have to be true for these helpers to work.

**A DOM.** `@ailura/alpinejs-testing` imports Alpine, which needs
`MutationObserver` at module scope. Either set the environment in
`vite.config.ts` …

```ts
// packages/my-plugin/vite.config.ts
export default defineConfig({
  test: { environment: "happy-dom" },
  pack: {/* … */},
});
```

… or per file, which is what the repo does for the suites that need a different
environment than the package default:

```ts
// @vitest-environment happy-dom
```

**A setup file, if the package owns per-process state.** Register it once via
`test.setupFiles: ["./test/setup.ts"]`. Guard it, because a node-environment
unit test in the same package must not import Alpine:

```ts
// test/setup.ts
export {};

if (typeof MutationObserver !== "undefined") {
  const { onReset } = await import("@ailura/alpinejs-testing");
  const { resetRegistrationTracking } = await import("../src/guards");
  onReset(resetRegistrationTracking);
}
```

## SSR

> Test helpers run in `happy-dom` (or `jsdom`). They are not SSR-relevant: they
> assume a live `document`, and `html` / `mount` / `reset` would all throw in a
> Node process without a DOM. To test the SSR branches of a package, assert on
> `safeWindow()` / `safeDocument()` returning `undefined` from a node-environment
> test — which is what `packages/core` does.

## Integration

- **`@ailura/alpinejs-core`** — the two reset hooks every package that
  registers a guard or an id needs: `resetRegistrationTracking` and
  `resetIdCounter`.
- **`@ailura/alpinejs-ui`** — the storage and portal suites mount against
  `localStorage` and `document.body` from this same `happy-dom` document.
- **Every package** — `@testing-library/dom` for queries and
  `@testing-library/jest-dom` for the matchers; those are per-package
  devDependencies, not dependencies of this one.

## Limitations

- **Not published and not installable from npm.** `private: true`, no `build`
  script, no `dist`, and `exports` resolves to `src/*.ts`. It works as a
  workspace devDependency (or from a fork that transpiles it), and nothing else.
- **`reset()` does not know about your package's state.** It clears Alpine and
  runs `onReset` hooks, and that is all. If your controller keeps a module-level
  counter, a singleton, or a guard registry, nothing resets it unless you
  register a hook. A package that forgets will see its second test fail on a
  leftover from the first.
- **One `start()` per file, and it is not reversible.** There is no
  `stop()`. A suite that needs a different plugin registered cannot get one —
  split it into another file.
- **`html()` gives you a wrapper.** `html('<div x-data>…</div>')` returns the
  `div` it created, so `screen`-level queries work but `root.querySelector` is
  how you reach the markup you actually care about, and `root` itself is never
  the element you wrote.
- **No fake timers, no `waitFor`, no network stubbing, no `Alpine.raw` helper.**
  Those come from `vitest` (`vi.useFakeTimers`) and `@testing-library/dom`. The
  `mock` subpath covers _registration_ assertions only — it has no `reactive`,
  no `effect` and no `nextTick`, so it cannot run a directive body.
- **`settled()` is two ticks, not "until quiescent".** A component that awaits
  something outside Alpine's queue — a resolved promise, a `matchMedia` flip
  dispatched by hand — needs an explicit `await` in the test.

## Size

Dev-only — no `dist`, no `size-limit` entry, not published. There is no bundle
to budget: `exports` maps to the TypeScript source and the consumer's own test
runner transpiles it.

## Architecture

[Foundation layer](../../ARCHITECTURE.md) — shared test infra, and the reason
`ARCHITECTURE.md §9` lists this package as an intentional canon exception: no
`vite.config.ts`, no `plugin.ts`, no controller, and subpath exports used for a
_development_ reason rather than a bundling one. See
[ARCHITECTURE.md §8](../../ARCHITECTURE.md).

## Testing

This package has no test suite of its own — it is the thing the other 37
packages' suites are written against, and it is exercised by all of them. To
check it compiles:

```sh
pnpm exec tsc --noEmit -p packages/testing/tsconfig.json
```

## License

MIT
