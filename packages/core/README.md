# @ailura/alpinejs-core

<p align="center">

[![bundlephobia minzip](https://badgen.net/bundlephobia/minzip/@ailura/alpinejs-core)](https://bundlephobia.com/package/@ailura/alpinejs-core)

</p>

> Shared substrate for every package in the toolkit: the controller lifecycle, the registration guards that stop two plugins silently fighting over one name, SSR-safe DOM access, and the helpers that make an Alpine directive correct. You do not install this to _use_ a feature — you install it to _write_ one.

Zero toolkit peers. Every other `@ailura/alpinejs-*` package depends on it.

## Installation

```sh
pnpm add @ailura/alpinejs-core alpinejs
# or
npm install @ailura/alpinejs-core alpinejs
```

Requires `alpinejs@^3.0.0` as peer. ESM only — there is no CommonJS build.

## Usage

`core` ships **twelve modules**. Import the barrel if you are writing an app and
want the lot; import a subpath if you are writing a package and only want — and
only want to pay for — one layer.

```ts
// The barrel: everything, one specifier.
import { BaseController, generateId, guardStore, safeWindow } from "@ailura/alpinejs-core";

// Or per layer, so the bundler drops the other eleven.
import { BaseController } from "@ailura/alpinejs-core/controller";
import { generateId } from "@ailura/alpinejs-core/ids";
import { guardStore, guardMagic, guardDirective } from "@ailura/alpinejs-core/guards";
import { safeWindow, safeDocument, safeMatchMedia } from "@ailura/alpinejs-core/env";
```

### 1. A controller, with no Alpine in sight

`BaseController` gives you a typed event bus, a LIFO teardown stack, and an
`idle → mounted → destroyed` lifecycle. Subclasses override `setup()` and push
every teardown into `cleanups`; `destroy()` reverses them.

```ts
import { BaseController, LIFECYCLE_DESTROYED, SOURCE_USER } from "@ailura/alpinejs-core";
import { generateId } from "@ailura/alpinejs-core/ids";

type CounterEvents = {
  change: [{ value: number; source: "user" | "initialization" }];
};

class CounterController extends BaseController<CounterEvents> {
  readonly id: string = generateId("counter");
  #value = 0;

  get value(): number {
    return this.#value;
  }

  increment(): void {
    // A destroyed controller is frozen: every mutation is a silent no-op.
    if (this.lifecycle === LIFECYCLE_DESTROYED) return;
    this.#value += 1;
    this.emit("change", { value: this.#value, source: SOURCE_USER });
  }

  protected setup(): void {
    // Runs once, from mount(). Push teardowns here, not in the constructor.
    this.onCleanup(() => console.log(`${this.id} torn down`));
  }
}

const ctrl = new CounterController();
ctrl.mount();
ctrl.on("change", (detail) => console.log(detail.value, detail.source));
ctrl.increment(); // 1 "user"
ctrl.destroy(); // "counter-1 torn down" — and increment() is now a no-op
```

### 2. The same controller, on Alpine

The bridge is four lines and it is the same four lines in every package:
resolve the key, register through the guard, mirror state on `change`, read
the store back off Alpine so the sync writes through the reactive proxy.

```ts
import Alpine from "alpinejs";
import type { Alpine as AlpineInstance } from "alpinejs";
import { guardStore } from "@ailura/alpinejs-core/guards";
import { readAlpineStore, resolveStoreKey } from "@ailura/alpinejs-core/registration";
import { syncRecordFromSnapshot } from "@ailura/alpinejs-core/sync";
import { DEFAULT_COUNTER_STORE_KEY } from "./constants.js";
import { CounterController } from "./controller.js";

const packageName = "@acme/alpinejs-counter";

type CounterStore = { state: { value: number }; increment(): void };

export function counterPlugin(options: { storeKey?: string } = {}) {
  const storeKey = resolveStoreKey(options, DEFAULT_COUNTER_STORE_KEY);

  return function registerCounter(alpine: AlpineInstance): void {
    const controller = new CounterController();
    const store: CounterStore = {
      state: { value: controller.value },
      increment: () => controller.increment(),
    };

    // `change` may fire before Alpine has wrapped `store` in a reactive
    // proxy, so the base object is the fallback.
    controller.on("change", (detail) => {
      syncRecordFromSnapshot(readAlpineStore<CounterStore>(alpine, storeKey, store).state, {
        value: detail.value,
      });
    });

    guardStore(alpine, storeKey, store, packageName);
  };
}

Alpine.plugin(counterPlugin());
Alpine.start();
```

```html
<div x-data>
  <button @click="$store.counter.increment()">+1</button>
  <span x-text="$store.counter.state.value"></span>
</div>
```

Note that only the **data** goes through `syncRecordFromSnapshot`. The store's
own methods are never part of a snapshot — see [Limitations](#limitations).

### 3. A directive that is actually reactive

Alpine wraps a `*Props()` record in object-form `x-bind` exactly once, and it
does not wrap a directive callback in an effect, so a naive directive reads its
expression once and never again. `@ailura/alpinejs-core/directives` is the set
of helpers that fix both.

```ts
import Alpine from "alpinejs";
import type { Alpine as AlpineInstance } from "alpinejs";
import { createDirectiveBinding, createValueReader } from "@ailura/alpinejs-core/directives";
import { guardDirective } from "@ailura/alpinejs-core/guards";

guardDirective(
  Alpine,
  "uppercase",
  (el, { expression }, utilities) => {
    // One idempotent LIFO queue per element, so a re-entrant cleanup()
    // cannot double-free the reader's effect.
    const binding = createDirectiveBinding();
    binding.add(
      createValueReader<string>(expression ?? "", utilities, (value) => {
        if (typeof value === "string") el.textContent = value.toUpperCase();
      })
    );
    utilities.cleanup(() => binding.release());
  },
  "@acme/alpinejs-uppercase"
);

Alpine.start();
```

```html
<div x-data="{ name: 'ada' }">
  <!-- reads `name` reactively: retyping it uppercases again -->
  <span x-uppercase="name"></span>

  <!-- an empty expression yields undefined, which the reader ignores -->
  <span x-uppercase></span>
</div>
```

If the expression is documented as an **id** rather than an expression — the
`x-virtual-scroll="rows"` shape — pass
`{ literalBareIdentifier: true }` and the bare identifier is read as the string
`"rows"` instead of being handed to Alpine, which would report `rows is not
defined` to its own error handler and leave the directive bound to nothing.

### 4. The directive bridge

`bridgeControllerDirective` registers a controller-backed directive through the
guard and hands back an idempotent teardown with a **fixed order**: event-bus
unsubscriptions, then adapter DOM cleanups, then `controller.destroy()`.

```ts
import Alpine from "alpinejs";
import type { Alpine as AlpineInstance } from "alpinejs";
import { bridgeControllerDirective } from "@ailura/alpinejs-core/bridge";
import { BaseController } from "@ailura/alpinejs-core/controller";

type UpperEvents = { change: [next: string] };

class UpperController extends BaseController<UpperEvents> {
  #value = "";
  get value(): string {
    return this.#value;
  }
  setValue(next: string): void {
    if (this.lifecycle === "destroyed") return;
    this.#value = next;
    this.emit("change", next);
  }
}

const controller = new UpperController();

const teardown = bridgeControllerDirective({
  alpine: Alpine,
  directiveKey: "upper",
  packageName: "@acme/alpinejs-upper",
  controller,
  eventCleanups: [controller.on("change", (next) => console.log("changed", next))],
  directive: (el, _directive, { cleanup }) => {
    el.textContent = (el.textContent ?? "").toUpperCase();
    // Alpine invokes this payload when the element leaves the tree.
    cleanup(teardown);
  },
});

Alpine.start();
```

The teardown is **element-bound** on purpose. There is no store bridge: in this
Alpine version `plugin()` discards the callback's return value and the Alpine
object exposes no `cleanup()`/`stop()`, so nothing in the runtime would ever
call a store bridge's teardown.

## API

Every row below is a real export of `src/`, reachable from the barrel and from
its own subpath.

### Subpaths

| Subpath                 | Exports                                                                                                                                                                                                        |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@ailura/alpinejs-core` | Barrel — re-exports all twelve modules below, no logic                                                                                                                                                         |
| `…/controller`          | `BaseController`, `EventEmitter`, `CleanupStack`, `EventMap`, `EventListener`, `LifecyclePhase`                                                                                                                |
| `…/guards`              | `guardStore`, `guardMagic`, `guardDirective`, `resetRegistrationTracking`, `GuardOptions`, `MagicCallback`, `DirectiveChain`                                                                                   |
| `…/registration`        | `resolvePluginKeys`, `resolveStoreKey`, `readAlpineStore`, `PluginKeyOptions`, `ResolvedPluginKeys`                                                                                                            |
| `…/env`                 | `isBrowser`, `safeWindow`, `safeDocument`, `safeMatchMedia`                                                                                                                                                    |
| `…/directives`          | `createDirectiveBinding`, `createValueReader`, `applyProps`, `bindProps`, `isLiteralDirectiveExpression`, `DirectiveBinding`, `DirectiveEvaluator`, `ValueReaderOptions`, `DirectiveProps`, `DirectiveElement` |
| `…/singletons`          | `createSingleton`, `releaseSingleton`, `clearAllSingletons`, `SingletonScope`, `SingletonOptions`                                                                                                              |
| `…/bridge`              | `bridgeControllerDirective`, `BridgeController`, `BridgeDirectiveOptions`                                                                                                                                      |
| `…/errors`              | `ToolkitError`, `RegistrationError`, `RegistrationKind`                                                                                                                                                        |
| `…/constants`           | `LIFECYCLE_IDLE`, `LIFECYCLE_MOUNTED`, `LIFECYCLE_DESTROYED`, `EVENT_CHANGE`, `SOURCE_USER`, `SOURCE_INITIALIZATION`                                                                                           |
| `…/ids`                 | `generateId`, `resetIdCounter`                                                                                                                                                                                 |
| `…/sync`                | `syncRecordFromSnapshot`                                                                                                                                                                                       |
| `…/invariant`           | `invariant`                                                                                                                                                                                                    |

`src/internal.ts` (`runLifo`) is deliberately **not** exported: it exists once
in the bundle for `controller.ts` and `bridge.ts` to share.

### `/controller`

| Export                          | Description                                                                                                                                                                                                          |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BaseController<TEvents>`       | Abstract base. `mount()` runs `setup()` once and is idempotent; `destroy()` drains `cleanups` LIFO, runs `teardown()`, and is final. A destroyed controller cannot be remounted and every mutation is a silent no-op |
| `BaseController.lifecycle`      | `'idle' \| 'mounted' \| 'destroyed'`                                                                                                                                                                                 |
| `BaseController.on(event, fn)`  | Subscribe; the unsubscribe is auto-registered on `cleanups`, so it runs at `destroy()`. Returns the unsubscribe too                                                                                                  |
| `BaseController.onCleanup(fn)`  | `protected` — push a teardown by hand                                                                                                                                                                                |
| `BaseController.emit(event, …)` | `protected` — dispatch to current listeners                                                                                                                                                                          |
| `EventEmitter<TEvents>`         | `on` / `once` / `off` / `emit` / `listenerCount`. `on` and `once` return an unsubscribe; `emit` iterates a snapshot, so a listener may unsubscribe mid-emit                                                          |
| `CleanupStack`                  | `push(fn)` (alias `add`), `size`, `disposed`, `dispose()`. LIFO; a throwing cleanup does not stop the rest, and the first error is rethrown after the drain                                                          |
| `EventMap`                      | `Record<string, unknown[]>` — event name to argument tuple                                                                                                                                                           |
| `EventListener<TArgs>`          | `(...args: TArgs) => void`                                                                                                                                                                                           |
| `LifecyclePhase`                | Union of the three literal phases                                                                                                                                                                                    |

### `/guards` and `/errors`

| Export                                         | Description                                                                                                                                                                                                                                                                       |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `guardStore(alpine, name, value, pkg, opts?)`  | Claims the store name, then `alpine.store(name, value)`. **Returns** the registered (reactive) store, which is not the object you passed in                                                                                                                                       |
| `guardMagic(alpine, name, cb, pkg, opts?)`     | Claims the magic name and calls `alpine.magic(name, cb)`                                                                                                                                                                                                                          |
| `guardDirective(alpine, name, cb, pkg, opts?)` | Claims the name **normalised to kebab-case** (`myDirective` → `my-directive`; the HTML parser lowercases attribute names, so a camelCase key would silently never match) and calls `alpine.directive(key, cb)`. Returns Alpine's directive chain so you can call `before()` on it |
| `resetRegistrationTracking()`                  | Forgets every claim. Wired into the test lifecycle via `onReset` in each package's `test/setup.ts`                                                                                                                                                                                |
| `GuardOptions`                                 | `{ override?: boolean }` — an intentional takeover of another package's name                                                                                                                                                                                                      |
| `MagicCallback`                                | `(el: ElementWithXAttributes, options: MagicUtilities) => unknown`                                                                                                                                                                                                                |
| `DirectiveChain`                               | `{ before(directive: string): void }` — the return of `Alpine.directive()`                                                                                                                                                                                                        |
| `ToolkitError`                                 | `Error` subclass with a stable `code` and an optional `cause`                                                                                                                                                                                                                     |
| `RegistrationError`                            | `code: 'REGISTRATION_COLLISION'`, carrying `kind`, `registrationName`, `packageName` and `existingPackageName`                                                                                                                                                                    |
| `RegistrationKind`                             | `'store' \| 'magic' \| 'directive'`                                                                                                                                                                                                                                               |

Re-registering a name **from the same package** is always allowed — that is
what makes a hot reload harmless. A _different_ package claiming it throws.
`guardStore` claims `store:<name>`, `guardMagic` `magic:<name>` and
`guardDirective` `directive:<name>`, so a store and a magic may share a name
without colliding.

### `/registration`

| Export                                                         | Description                                                                                                                                                                             |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `resolvePluginKeys(options, defaultStoreKey, defaultMagicKey)` | `{ storeKey, magicKey }`. The magic follows the store — renaming `storeKey` renames both — and an explicit `magicKey` wins over everything. `undefined`/`null` fall back; `''` does not |
| `resolveStoreKey(options, defaultStoreKey)`                    | The store-only sibling, for a plugin that registers no magic                                                                                                                            |
| `readAlpineStore<T>(alpine, key)`                              | `T \| undefined` — typed, so call sites do not hand-write a cast                                                                                                                        |
| `readAlpineStore<T>(alpine, key, fallback)`                    | `T` — falls back until Alpine has wrapped the object in a reactive proxy. A `change` handler can fire before `guardStore` has run, which is exactly when this overload is needed        |
| `PluginKeyOptions` / `ResolvedPluginKeys`                      | `{ storeKey?, magicKey? }` / `{ storeKey, magicKey }`                                                                                                                                   |

### `/env`

| Export                  | Returns                                                                                             |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| `isBrowser()`           | `true` only when **both** `window` and `document` exist                                             |
| `safeWindow()`          | `Window \| undefined`                                                                               |
| `safeDocument()`        | `Document \| undefined`                                                                             |
| `safeMatchMedia(query)` | `MediaQueryList \| undefined` — `undefined` when there is no `window` _or_ no `matchMedia` function |

### `/directives`

| Export                                                            | Description                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `createValueReader<T>(expression, utilities, receiver, options?)` | Evaluates inside `utilities.effect`, so `receiver` re-runs when the value changes. Returns a stop function. An empty/non-string expression delivers `undefined` once                                                                                                           |
| `ValueReaderOptions.literalBareIdentifier`                        | `true` reads a bare identifier as a string instead of evaluating it. A **trade, not a free win**: `x-carousel="id"` naming a real variable is legitimate markup, so leave it off for an expression-shaped directive                                                            |
| `isLiteralDirectiveExpression(expression)`                        | `true` when the trimmed expression is a bare identifier                                                                                                                                                                                                                        |
| `createDirectiveBinding()`                                        | `{ add(fn), release(), released }` — an idempotent LIFO release queue for one element. Hand `release` to the `cleanup()` utility Alpine supplies                                                                                                                               |
| `applyProps(el, props)`                                           | Writes a props record imperatively: `null`/`undefined`/`false` **remove** the attribute, `true` writes `""` (which is how boolean ARIA works), and `value`/`checked`/`selected`/`indeterminate`/`disabled` go on as DOM properties. Returns the **attribute** names it touched |
| `bindProps(el, utilities, compute)`                               | Re-applies `compute()` on every effect run and removes what it wrote on release. This is how live `aria-*` / `tabindex` / `hidden` work where `x-bind="{…}"` cannot                                                                                                            |
| `DirectiveEvaluator`                                              | `{ evaluateLater, effect }` — the minimum Alpine surface the helpers need, so a test can pass a stub                                                                                                                                                                           |
| `DirectiveBinding` / `DirectiveProps` / `DirectiveElement`        | `DirectiveProps` is `Readonly<Record<string, unknown>>`; `DirectiveElement` is Alpine's `ElementWithXAttributes`                                                                                                                                                               |

`release()` drains every teardown even when one throws, then rethrows the
first error — the same contract as `CleanupStack.dispose()`.

### `/singletons`

| Export                                      | Description                                                                                                                                                                                                      |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createSingleton(key, factory, { scope? })` | One instance per `key` per scope. The scope defaults to `document`; **with no document** (SSR / Node) each call gets a throwaway scope, so a new instance is built every time and nothing leaks between requests |
| `releaseSingleton(key, scope?)`             | Drops one entry. Returns `true` when something was removed; `false` when there is no scope at all                                                                                                                |
| `clearAllSingletons(scope?)`                | Clears one scope, or every scope that was ever tracked                                                                                                                                                           |
| `SingletonScope` / `SingletonOptions`       | `object` / `{ scope? }`                                                                                                                                                                                          |

The throwaway SSR scopes are deliberately left untracked: there is nothing
cross-request to share and nothing for `clearAllSingletons()` to find.

### `/bridge`, `/ids`, `/sync`, `/invariant`, `/constants`

| Export                                                   | Description                                                                                                                                                                                                            |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bridgeControllerDirective(options)`                     | `guardDirective` + an idempotent teardown. Teardown order: `eventCleanups` LIFO → `domCleanups` LIFO → `controller.destroy()`. Both arrays are read at teardown time, so the directive may keep pushing after bridging |
| `BridgeDirectiveOptions`                                 | `{ alpine, directiveKey, directive, packageName, controller?, eventCleanups?, domCleanups?, override? }`                                                                                                               |
| `BridgeController`                                       | `{ destroy(): void }` — the only surface a bridge needs                                                                                                                                                                |
| `generateId(prefix = 'id')`                              | `` `${prefix}-${n.toString(36)}` `` from a single module-level counter, so ids are short and ordered **within the process** — not across a page load or between server requests                                        |
| `resetIdCounter()`                                       | Counter back to 0                                                                                                                                                                                                      |
| `syncRecordFromSnapshot(target, snapshot)`               | Mutates `target` so it matches `snapshot` exactly: keys assigned only when changed, keys missing from the snapshot deleted. Returns `target`. In-place, so Alpine's reactive proxy survives                            |
| `invariant(condition, message)`                          | Throws a plain `Error` when `condition` is falsy; narrows the type for the caller                                                                                                                                      |
| `LIFECYCLE_IDLE` / `_MOUNTED` / `_DESTROYED`             | `'idle' \| 'mounted' \| 'destroyed'` — compare against `controller.lifecycle` rather than a bare string                                                                                                                |
| `EVENT_CHANGE` / `SOURCE_USER` / `SOURCE_INITIALIZATION` | `'change'`, `'user'`, `'initialization'`                                                                                                                                                                               |

## Registering without a silent overwrite

This is the one problem `core` exists to solve: Alpine happily lets two plugins
claim `$store.toast`, and the second one wins with no warning. `guardStore`
turns that into a `RegistrationError` naming both packages.

```ts
import type { Alpine as AlpineInstance } from "alpinejs";
import { RegistrationError } from "@ailura/alpinejs-core/errors";
import { guardStore } from "@ailura/alpinejs-core/guards";

declare const alpine: AlpineInstance;
declare const myToastStore: { push(message: string): void };

try {
  guardStore(alpine, "toast", myToastStore, "@acme/alpinejs-toast");
} catch (error) {
  if (error instanceof RegistrationError && error.code === "REGISTRATION_COLLISION") {
    console.error(error.kind, error.registrationName, error.existingPackageName);
  }
}
// store "toast" collision: "@acme/alpinejs-toast" owned by
// "@ailura/alpinejs-toast" (use { override: true })
```

An intentional takeover passes `{ override: true }`.

## SSR

> SSR-safe **by design** — nothing in this package reads `window`, `document` or
> `matchMedia` at import time, and there is no module-level DOM state. All
> environment access goes through `safeWindow()` / `safeDocument()` /
> `safeMatchMedia()`, which return `undefined` instead of throwing.
>
> The one environment-shaped piece of state, `createSingleton`, falls back to a
> fresh scope per call when there is no `document`, so a server render cannot
> share an instance between requests.

## Integration

- **`@ailura/alpinejs-ui`** — depends on `core/env` for every DOM access
- **`@ailura/alpinejs-state-machine`** — `BaseController` + `generateId`, nothing else
- **Feature packages** (`accordion`, `tabs`, `dialog`, `menu`, `tooltip`, `carousel`, `virtual`, `selection`, `keyboard`, …) — `controller.ts` extends `BaseController`; `plugin.ts` uses `guardStore`/`guardMagic`/`guardDirective` + `resolveStoreKey`/`readAlpineStore` + `syncRecordFromSnapshot`; element-bound directives use `createDirectiveBinding` + `createValueReader`, and `menu` uses `bindProps`
- **`@ailura/alpinejs-testing`** — `reset()` runs `resetRegistrationTracking()` and `resetIdCounter()` for you when each package registers them through `onReset`

## Limitations

- **`syncRecordFromSnapshot` deletes every key the snapshot does not contain.**
  That is what makes it exact, and it is also the trap: run it against a record
  that holds methods and it deletes them. Feature packages therefore always sync
  a **nested data record** (`store.instances`), never the store object itself.
- **`applyProps` cannot undo a property write.** Its return value lists the
  attributes it touched, but the `value` / `checked` / `selected` /
  `indeterminate` / `disabled` keys are set on the DOM node and never appear in
  that list — so `bindProps`'s release function removes the attributes it wrote
  and leaves the properties as they are.
- **`bridgeControllerDirective` is a directive bridge only.** There is no store
  bridge, and adding one would be dead code: `Alpine.plugin()` discards its
  callback's return value, so nothing would ever call the teardown.
- **Guard tracking is per process, per module instance.** Two copies of `core`
  in one bundle graph (a duplicated dependency, or a server that re-evaluates
  the module per request) each keep their own `owners` map, so a collision
  across those two copies is not detected.
- **`generateId` is not unique across processes.** It is a module-level counter
  rendering in base-36, so it is unique within a browser session and ordered
  within a render — not across a page load, and not across concurrent server
  requests.
- **The barrel is the only entry over its soft budget.** `core barrel` measures
  `2.3 kB` gzipped against a `2.4 kB` limit, so it passes, but every subpath has
  real headroom and the barrel is nearly full. Adding an export to `index.ts`
  costs against that `100 B` of remaining room.

## Size

`2.3 kB gzip` (barrel `dist/index.mjs`, with dependencies, minified) · declared budget `2.4 kB` · externalized peers: `alpinejs` · `size-limit` + `publint` + `attw` verified.

`core` is the one package here with a barrel **and** twelve subpath budgets, so
the numbers are a table rather than a line. Limits are on the gzipped file:

| Subpath          | Budget   | Measured | Subpath        | Budget  | Measured |
| ---------------- | -------- | -------- | -------------- | ------- | -------- |
| barrel           | `2.4 kB` | `2.3 kB` | `./bridge`     | `750 B` | `629 B`  |
| `./controller`   | `630 B`  | `600 B`  | `./constants`  | `260 B` | `225 B`  |
| `./directives`   | `1.5 kB` | `703 B`  | `./env`        | `240 B` | `224 B`  |
| `./errors`       | `350 B`  | `335 B`  | `./guards`     | `580 B` | `572 B`  |
| `./ids`          | `180 B`  | `166 B`  | `./invariant`  | `200 B` | `120 B`  |
| `./registration` | `220 B`  | `189 B`  | `./singletons` | `350 B` | `331 B`  |
| `./sync`         | `180 B`  | `175 B`  |                |         |          |

Run `pnpm run size` in `packages/core` to reproduce. `./directives` has the
loosest budget relative to its size and `./bridge` the tightest, so those are the
two to watch.

## Architecture

[Foundation layer](../../ARCHITECTURE.md) — `core` has zero toolkit peers and
every other package depends on it. Controllers own state, Alpine owns
reactivity. See the canon, guards and SSR rules in
[ARCHITECTURE.md](../../ARCHITECTURE.md).

## Testing

```sh
pnpm exec vp test packages/core
pnpm exec tsc --noEmit -p packages/core/tsconfig.json
```

Uses `@ailura/alpinejs-testing` — see
[ARCHITECTURE.md §8](../../ARCHITECTURE.md).

## License

MIT
