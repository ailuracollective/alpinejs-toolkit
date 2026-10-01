# @ailura/alpinejs-theme

<p align="center">

[![bundlephobia minzip](https://badgen.net/bundlephobia/minzip/@ailura/alpinejs-theme)](https://bundlephobia.com/package/@ailura/alpinejs-theme)

</p>

> Light / dark / system theme controller for Alpine.js — `MachineController`-backed, SSR-safe, with pluggable DOM strategy, persistence and cross-tab sync, on `@ailura/alpinejs-core`.

## Installation

```sh
pnpm add @ailura/alpinejs-theme alpinejs
# or
npm install @ailura/alpinejs-theme alpinejs
```

Requires `alpinejs@^3.0.0` as peer. `@ailura/alpinejs-core`,
`@ailura/alpinejs-state-machine` and `@ailura/alpinejs-ui` are **peer
dependencies** too — no package in this toolkit has a `dependencies` block, so
the host installs them.

## Usage

### 1. Standalone (framework-agnostic)

```ts
import { createThemeController, createMemoryThemeStorage } from "@ailura/alpinejs-theme";

// `createThemeController` is a singleton per scope, so two calls return the
// same controller — which is what keeps two of them from fighting over one
// `<html>` class and one storage key.
const theme = createThemeController({
  defaultTheme: "system",
  storage: createMemoryThemeStorage(), // or omit for localStorage
  strategy: "class", // default
});

theme.on("change", (detail) => {
  detail.current; // 'light' | 'dark' | 'system' — your preference
  detail.system; // what the OS reports
  detail.resolved; // what was applied to the DOM
  detail.source; // 'initialization' | 'user' | 'system' | 'storage' | 'reset'
  detail.previous; // null on initialization
});

theme.set("dark");
theme.toggle();
theme.reset(); // back to defaultTheme, storage key removed
theme.destroy();
```

`setup()` runs on the first `get()`-free call to `mount()` inside the factory,
so the first `change` event arrives one microtask later — register the listener
straight away and you will see it.

### 2. Alpine

```ts
import Alpine from "alpinejs";
import themePlugin from "@ailura/alpinejs-theme";

Alpine.plugin(themePlugin());
Alpine.start();
```

The plugin registers `$store.theme` **and** `$theme` (the same object), and
nothing else — no directives.

```html
<div x-data>
  <button @click="$theme.set('light')">Light</button>
  <button @click="$theme.set('dark')">Dark</button>
  <button @click="$theme.set('system')">System</button>

  <span x-text="$theme.current"></span>
  <span x-text="$theme.resolved"></span>

  <!-- The button label flips with the resolved theme, not the preference:
       on `system` both resolve to the same thing, and that is the point. -->
  <button @click="$theme.toggle()" x-text="$theme.resolved === 'dark' ? 'Light' : 'Dark'"></button>
</div>
```

Your stylesheet keys off the class the controller writes to `<html>`:

```css
.dark {
  --bg: #000;
}
.light {
  --bg: #fff;
}
body {
  background: var(--bg);
}
```

## API

### Exports

| Export                           | Description                                                                                          | Type       |
| -------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------- |
| `ThemeController`                | Framework-agnostic controller — owns the preference graph, the DOM handle, storage and the observers | `class`    |
| `createThemeController`          | `createThemeController(options?) => ThemeController`; a **singleton per scope**, already `mount()`ed | `function` |
| `themePlugin`                    | `Alpine.plugin()` factory — registers `$store.theme` + `$theme`                                      | `function` |
| `createThemeStore`               | `(manager, release?) => ThemeStore` — the store projection, exported for a hand-rolled boot          | `function` |
| `createLocalStorageThemeStorage` | `localStorage` adapter under key `"theme"`, cross-tab by default. `{ key?, crossTab? }`              | `function` |
| `createMemoryThemeStorage`       | In-memory adapter, `initial` preference defaults to `null`. No cross-tab, no persistence             | `function` |
| `createSystemObserver`           | `(listener) => unsubscribe` on `(prefers-color-scheme: dark)`; a no-op unsubscribe on the server     | `function` |
| `readSystemTheme`                | `'light' \| 'dark'` from `matchMedia` right now. `'light'` when `matchMedia` is missing              | `function` |
| `isThemePreference`              | Type guard: `value is ThemePreference`                                                               | `function` |
| `coerceThemePreference`          | `(value, fallback) => ThemePreference` — anything unrecognised becomes `fallback`                    | `function` |
| `defaultThemePreference`         | `() => 'system'`                                                                                     | `function` |
| `resolveTheme`                   | `(current, system) => ResolvedTheme` — `system ? system : current`                                   | `function` |
| `toThemeEvent`                   | `('light'\|'dark'\|'system') => 'SET_LIGHT'\|'SET_DARK'\|'SET_SYSTEM'`                               | `function` |
| `ThemePreference`                | `'light' \| 'dark' \| 'system'` — the explicit choice                                                | `type`     |
| `ResolvedTheme`                  | `'light' \| 'dark'` — what is actually applied                                                       | `type`     |
| `ThemeDomStrategy`               | `'class' \| 'attribute' \| 'none'`                                                                   | `type`     |
| `ThemeState`                     | `{ current, system, resolved }`                                                                      | `type`     |
| `ThemeChangeDetail`              | `ThemeState & { source, previous }`                                                                  | `type`     |
| `ThemeChangeSource`              | `'initialization' \| 'user' \| 'system' \| 'storage' \| 'reset'`                                     | `type`     |
| `ThemeEvents`                    | Event map — a single `change` event                                                                  | `type`     |
| `ThemeListener`                  | `(detail: ThemeChangeDetail) => void`                                                                | `type`     |
| `ThemeEvent`                     | `'SET_LIGHT' \| 'SET_DARK' \| 'SET_SYSTEM'` — the machine's events, not a public API                 | `type`     |
| `ThemeStorage`                   | `SubscribableStorageAdapter<ThemePreference>` from `@ailura/alpinejs-ui`; `subscribe` is optional    | `type`     |
| `ThemeStore`                     | The `$store.theme` surface (see below)                                                               | `type`     |
| `CreateThemeOptions`             | Every option (see below)                                                                             | `type`     |
| `DomApplyHandle`                 | `{ apply(resolved, force?), destroy() }` — what `createDomHandle` returns                            | `type`     |
| `ThemePluginCallback`            | `Alpine.plugin()` callback signature                                                                 | `type`     |

`DEFAULT_THEME_STORE_KEY` and `DEFAULT_THEME_MAGIC_KEY` both hold `"theme"`, but
they are **not** re-exported from the barrel — see Limitations.

### Controller API

| Member       | Description                                                                                                                              |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `current`    | The preference: `'light' \| 'dark' \| 'system'`. Machine-owned, so it cannot be anything else                                            |
| `system`     | What `prefers-color-scheme` reports right now                                                                                            |
| `resolved`   | `current === 'system' ? system : current` — the value written to the DOM                                                                 |
| `get()`      | All three as one `ThemeState`                                                                                                            |
| `set(value)` | Coerce, then move. Unrecognised values fall back to `defaultTheme`. Setting the current value is a no-op and writes nothing              |
| `toggle()`   | `resolved === 'dark' ? 'light' : 'dark'`. Based on **resolved**, not preference, so it always writes an explicit choice — never `system` |
| `reset()`    | Back to `defaultTheme` and remove the storage key. Removes the key even when already at the default                                      |
| `apply()`    | Re-write the resolved theme to the DOM, forcing past the "already applied" check. This is the recovery hook                              |
| `destroy()`  | Drain cleanups, remove the class/attribute, destroy the machine, release the singleton                                                   |
| `lifecycle`  | `'idle' \| 'mounted' \| 'destroyed'` from `BaseController`                                                                               |

### Store API

```ts
$store.theme.current; // 'light' | 'dark' | 'system'
$store.theme.system; // 'light' | 'dark'
$store.theme.resolved; // 'light' | 'dark'

$store.theme.set("dark");
$store.theme.toggle();
$store.theme.reset();
$store.theme.apply();
$store.theme.destroy();
```

| Method      | Description                                                                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `set(v)`    | Coerced, not validated — an unknown string becomes `defaultTheme` rather than throwing                                                                  |
| `toggle()`  | Flips on `resolved`. On `system` with a dark OS, it writes `light` — an explicit choice, not `system`                                                   |
| `reset()`   | Returns to `defaultTheme` and clears storage                                                                                                            |
| `apply()`   | Force re-write to the DOM. Call it after anything that replaced `<html>`                                                                                |
| `destroy()` | **Host-owned.** Nothing calls it for you. It releases the system observer, the cross-tab subscription, the `reapplyEvents` listeners, and the singleton |

`$theme` is the same object as `$store.theme` — the magic is a getter for the
store, not a second projection.

### Options

```ts
type CreateThemeOptions = {
  id?: string; // controller id — defaults to generateId('theme')
  defaultTheme?: "light" | "dark" | "system"; // default 'system'
  storage?: ThemeStorage; // default createLocalStorageThemeStorage()
  strategy?: "class" | "attribute" | "none"; // default 'class'
  darkClass?: string; // default 'dark'
  lightClass?: string; // default 'light'
  attribute?: string; // default 'data-theme' — strategy: 'attribute' only
  target?: HTMLElement | null; // default document.documentElement
  watchSystem?: boolean; // default true
  crossTab?: boolean; // default true
  scope?: SingletonScope; // default: the document
  storeKey?: string; // default 'theme'
  magicKey?: string; // default magicKey ?? storeKey
  reapplyEvents?: readonly string[]; // default none
};
```

| Option                     | Default                    | Effect                                                                                                 |
| -------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------ |
| `defaultTheme`             | `'system'`                 | Also the fallback for `set()` with an unknown value, and the target of `reset()`                       |
| `strategy`                 | `'class'`                  | `'class'` swaps `dark`/`light` on the target; `'attribute'` sets `data-theme`; `'none'` writes nothing |
| `darkClass` / `lightClass` | `'dark'` / `'light'`       | **Both are removed** before the new one is added, so a leftover class cannot win                       |
| `target`                   | `document.documentElement` | Resolved lazily on first apply, so a `null` on the server still finds the document later               |
| `watchSystem`              | `true`                     | `false` stops following OS changes. An explicit `light`/`dark` ignores them either way                 |
| `crossTab`                 | `true`                     | Requires the storage adapter to have a `subscribe`; a memory adapter has none, so it delivers nothing  |
| `scope`                    | the `document`             | The singleton key. Pass your own for a second, independent instance                                    |
| `reapplyEvents`            | none                       | `document` event types that trigger `apply()`. See below                                               |

### Avoiding name collisions

```ts
Alpine.plugin(themePlugin({ storeKey: "appearance", magicKey: "appearance" }));
// → $store.appearance and $appearance
```

`magicKey` falls back to `storeKey`, so renaming the store alone renames both —
unless you set `magicKey: undefined` to drop the magic entirely. Re-registering
the same keys from this package is allowed; a _different_ package claiming
`theme` throws `RegistrationError`.

### Events

```ts
import type { ThemeChangeDetail, ThemeChangeSource } from "@ailura/alpinejs-theme";

theme.on("change", (detail: ThemeChangeDetail) => {
  if (detail.source !== "user") return;
  console.log(detail.previous?.current, "→", detail.current);
});
```

`source` is worth branching on, because each one has a different side effect:

| Source           | What happened                                                                                | Storage           | DOM                           |
| ---------------- | -------------------------------------------------------------------------------------------- | ----------------- | ----------------------------- |
| `initialization` | `setup()` read storage and resolved the theme. One microtask after `createThemeController()` | read only         | applied once                  |
| `user`           | `set()` or `toggle()`                                                                        | **written**       | applied if `resolved` changed |
| `system`         | The OS changed, and `current === 'system'`                                                   | untouched         | applied                       |
| `storage`        | Another tab wrote the preference                                                             | read by the event | applied if `resolved` changed |
| `reset`          | `reset()`                                                                                    | **removed**       | applied if `resolved` changed |

`previous` is `null` on `initialization` and a full `ThemeState` otherwise.

## Surviving a router swap

The controller writes the class to `<html>` once. A client-side router that
replaces the `<html>` element — Astro's `ClientRouter`, View Transitions, a
full re-render — throws that class away, and the server-rendered default comes
back. `reapplyEvents` is the fix:

```ts
Alpine.plugin(themePlugin({ reapplyEvents: ["astro:after-swap"] }));
```

Each named `document` event calls `apply()`, which forces past the "already
applied" check. Equivalently, call `$theme.apply()` yourself after a swap.

**The class is not enough on first load.** The controller only runs after
Alpine boots, so a hard reload on a dark theme paints light first. The fix is an
inline script in `<head>`, before any stylesheet — host code, not something this
package ships:

```html
<script is:inline>
  (function () {
    var saved = localStorage.getItem("theme");
    var mode = saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
    var dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.add(mode === "system" ? (dark ? "dark" : "light") : mode);
  })();
</script>
```

## Custom storage

Any `SubscribableStorageAdapter<ThemePreference>` works — the contract is
`@ailura/alpinejs-ui`'s, re-exported as `ThemeStorage`.

```ts
import { createThemeController } from "@ailura/alpinejs-theme";
import type { ThemeStorage } from "@ailura/alpinejs-theme";

const cookieStorage: ThemeStorage = {
  get: () => (document.cookie.match(/theme=(\w+)/)?.[1] as never) ?? null,
  set: (value) => {
    document.cookie = `theme=${value}; path=/; max-age=31536000; samesite=lax`;
  },
  remove: () => {
    document.cookie = "theme=; path=/; max-age=0";
  },
  // Optional. Without it, `crossTab: true` delivers nothing.
};

const theme = createThemeController({ storage: cookieStorage });
```

`createMemoryThemeStorage(initial?)` is the batteries-included option for tests
and for a page that should forget on reload.

## SSR

> SSR-safe — no `window`/`document` at import time. `matchMedia` goes through
> `safeMatchMedia` and the DOM target through `safeDocument()`, both from
> `@ailura/alpinejs-core/env`. On the server the controller constructs, hydrates
> from the storage adapter and resolves to `'light'` (no `matchMedia`), applies
> nothing, and its observer unsubscribe is a no-op.

Without a `scope`, the singleton falls back to a fresh object per request, so
two SSR requests never share a controller.

## Limitations

- **The declared budget is not met.** `.size-limit.json` says `2 kB`; the
  build gzips to `2.08 kB` (`5.71 kB` raw). The budget has not been raised and
  is reported here rather than papered over.
- **`DEFAULT_THEME_STORE_KEY` and `DEFAULT_THEME_MAGIC_KEY` are not exported.**
  They are declared in `types.ts` and used by `plugin.ts`, but the barrel only
  re-exports _types_ from `./types`, so `import { DEFAULT_THEME_STORE_KEY } from
"@ailura/alpinejs-theme"` does not resolve. Hard-code `"theme"` if you need
  the default in TypeScript.
- **The first paint is the host's problem.** The controller runs after Alpine
  boots, so a hard reload flashes the default theme unless you add the inline
  bootstrap above. `reapplyEvents` fixes a _router swap_, not the initial load.
- **`createThemeController` is a singleton.** Two calls return the same
  controller, so a second `destroy()` is not scoped to the second caller and a
  test that creates two without a `scope` gets the first one's teardown. Pass
  a `scope` for an independent instance.
- **`crossTab: true` silently delivers nothing** when the storage adapter has
  no `subscribe` — which is every adapter the package ships except the
  `localStorage` one. `ThemeStorage.subscribe` is optional, so TypeScript will
  not warn you.
- **`toggle()` always leaves an explicit preference.** On `system` with a dark
  OS it writes `light`. There is no way to toggle back to `system` without
  calling `set('system')` or `reset()`.
- **`destroy()` on the store is host-owned.** Alpine 3 has no plugin-level
  teardown, so nothing releases the observers, the `reapplyEvents` listeners or
  the singleton for you. In a normal page that is correct — it lives as long as
  the document does — but in a test or an SPA route it is a leak unless you
  call it.
- **An explicit preference ignores the OS.** With `current === 'light'`, a
  system change updates `system` and nothing else. That is the intent, and it
  also means a user who flips their OS at sunset sees no change until they
  choose `system`.
- **No multi-theme support.** Two states and a preference. There is no
  `sepia`, no `high-contrast`, no per-route theme, and no way to swap the class
  names at runtime.

## Size

`5.71 kB raw / 2.08 kB gzip` · budget `2 kB` — **the build exceeds the declared budget** · externalized peers: `alpinejs`, `@ailura/alpinejs-core`, `@ailura/alpinejs-state-machine`, `@ailura/alpinejs-ui` · `size-limit` + `publint` + `attw` verified.

## Architecture

[Features layer](../../ARCHITECTURE.md) — controllers own state, Alpine owns reactivity. The preference itself is a `MachineController` graph (`light`/`dark`/`system`, 6 `SET_*` edges, no self-loops); `system` and `resolved` are derived from it. See canon, guards, and SSR rules in [ARCHITECTURE.md](../../ARCHITECTURE.md).

## Testing

```sh
pnpm test              # vp test (happy-dom)
pnpm run typecheck     # tsc --noEmit
```

Uses `@ailura/alpinejs-testing` — `html`/`mount`/`settled`/`start`/`resume`/`reset`, with `clearAllSingletons` on reset so each test gets a fresh controller. See [ARCHITECTURE.md §8](../../ARCHITECTURE.md).

## License

MIT
