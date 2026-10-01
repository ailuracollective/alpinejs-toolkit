# @ailura/alpinejs-lang

<p align="center">

[![bundlephobia minzip](https://badgen.net/bundlephobia/minzip/@ailura/alpinejs-lang)](https://bundlephobia.com/package/@ailura/alpinejs-lang)

</p>

> A language store for Alpine.js — detects `navigator.language`, normalises BCP-47 tags, and gives you `is()` / `includes()` predicates that are reactive, so a template re-renders when the language changes.

## Installation

```sh
pnpm add @ailura/alpinejs-lang alpinejs
# or
npm install @ailura/alpinejs-lang alpinejs
```

Requires `alpinejs@^3.0.0` as peer. `@ailura/alpinejs-core` is a **peer
dependency**, not a dependency: no package in this toolkit has a
`dependencies` block, so the host installs it too.

## Usage

### 1. Standalone (framework-agnostic)

```ts
import { createLangController } from "@ailura/alpinejs-lang";

const lang = createLangController(); // already mounted

lang.current; // "pt-br" — normalised, detected from navigator
lang.base; // "pt"
lang.region; // "br"
lang.languages; // ["pt-br", "pt", "en-us", …] — navigator.languages, normalised
lang.fallback; // "en"
lang.isDetected; // true on a browser, false on a server

lang.is("pt"); // true — base match against a region-qualified current
lang.is("pt-BR"); // true — exact match
lang.includes("en"); // true — the browser lists it
lang.set("fr-CA"); // current becomes "fr-ca"
lang.on("change", ({ source, previous }) => console.log(source, previous?.current));
lang.reset(); // back to the detected (or fallback) language
lang.destroy();
```

Inject a fake browser to test the detection, or `null` to simulate a server:

```ts
createLangController({ navigator: { language: "de-AT", languages: ["de-AT", "de"] } });
createLangController({ navigator: null, fallback: "fr" }); // isDetected: false
```

### 2. Alpine

```ts
import Alpine from "alpinejs";
import langPlugin from "@ailura/alpinejs-lang";

Alpine.plugin(langPlugin());
Alpine.start();
```

```html
<div x-data>
  <button type="button" @click="$store.lang.set('en')" x-bind:data-active="$store.lang.is('en')">
    English
  </button>
  <button type="button" @click="$store.lang.set('es')" x-bind:data-active="$store.lang.is('es')">
    Español
  </button>
  <button type="button" @click="$store.lang.set('pt-BR')" x-bind:data-active="$store.lang.is('pt')">
    Português (BR)
  </button>
  <button type="button" @click="$store.lang.reset()">Reset</button>

  <p x-show="$store.lang.is('es')" x-cloak>Hola mundo</p>
  <p x-show="$store.lang.is('en')" x-cloak>Hello world</p>
  <p x-show="$store.lang.is('pt')" x-cloak>Olá mundo</p>
  <p x-show="!$store.lang.is('es') && !$store.lang.is('en') && !$store.lang.is('pt')" x-cloak>
    No translation for <span x-text="$store.lang.current"></span>
  </p>
</div>
```

The plugin registers `$store.lang` — **and nothing else**. There is no `$lang`
magic here.

## API

| Export                   | Description                                                                                              | Type             |
| ------------------------ | -------------------------------------------------------------------------------------------------------- | ---------------- |
| `LangController`         | Controller class — implements `LangManager`; emits `change` with a `LangChangeDetail`                    | `class`          |
| `createLangController`   | `createLangController(options?) => LangController` — mounts it for you                                   | `function`       |
| `langPlugin`             | Alpine plugin factory — `langPlugin(options?) => AlpineCallback`; registers `$store.lang`                | `function`       |
| `DEFAULT_LANG_STORE_KEY` | Default `$store` key — `"lang"`                                                                          | `string` (const) |
| `DEFAULT_LANG_FALLBACK`  | Fallback language — `"en"`                                                                               | `string` (const) |
| `LangStore`              | The Alpine-facing surface: 6 fields plus `is`, `includes`, `set`, `reset`                                | `type`           |
| `LangManager`            | The controller interface — the 6 fields, a `get()`, `is`, `includes`, `set`, `reset`, `on` and `destroy` | `type`           |
| `LangState`              | `{ current, base, region, languages, fallback, isDetected }` — what `get()` returns                      | `type`           |
| `LangChangeDetail`       | The `change` payload: the whole `LangState` plus `source` and `previous`                                 | `type`           |
| `LangChangeSource`       | `"initialization" \| "user" \| "reset"`                                                                  | `type`           |
| `CreateLangOptions`      | Controller options — `{ id?, fallback?, normalize?, navigator? }`                                        | `type`           |
| `LangOptions`            | Alias of `CreateLangOptions`                                                                             | `type`           |
| `LangPluginOptions`      | Plugin options — `{ fallback?, normalize?, storeKey? }`                                                  | `type`           |
| `NavigatorLike`          | The slice of `navigator` this package reads — `{ language?, languages? }`                                | `type`           |
| `LangEvents`             | `{ change: [LangChangeDetail] }`                                                                         | `type`           |
| `LangAlpine`             | `Alpine & { store(name): unknown }`                                                                      | `type`           |
| `LangPluginCallback`     | `(alpine: Alpine) => void`                                                                               | `type`           |

### Store API

```ts
$store.lang.current; // "pt-br"
$store.lang.base; // "pt"
$store.lang.region; // "BR" | null
$store.lang.languages; // readonly string[]
$store.lang.fallback; // "en" — readonly
$store.lang.isDetected; // boolean

$store.lang.is("pt"); // boolean
$store.lang.includes("en"); // boolean
$store.lang.set("fr-CA"); // void
$store.lang.reset(); // void
```

| Member            | Description                                                                                                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `current`         | The active language tag, normalised.                                                                                                                                                                         |
| `base`            | The primary subtag — `"pt"` for `pt-BR`.                                                                                                                                                                     |
| `region`          | The last subtag when it is exactly two characters, else `null`, lowercased by `normalize`. `zh-Hant-TW` reports `tw`; the script subtag is dropped. `de-1996` reports `null`.                                |
| `languages`       | `navigator.languages`, normalised. Empty when nothing was detected.                                                                                                                                          |
| `fallback`        | Read-only. The tag used when detection finds nothing, and the tag `reset()` falls back to.                                                                                                                   |
| `isDetected`      | `false` when the current language came from the fallback rather than from a navigator.                                                                                                                       |
| `is(value)`       | `true` for an exact match on `current`, or when a **base-only** candidate matches `base` — `is("pt")` is `true` while the current is `pt-BR`. A candidate that carries its own region is never a base match. |
| `includes(value)` | `true` when `value` is in `languages`, with the same base-only relaxation. Answers "would this browser accept it", not "is it active".                                                                       |
| `set(value)`      | Normalises and applies. **No-op** for an empty string or for the tag already active — clicking the active button in a language picker emits nothing.                                                         |
| `reset()`         | Re-runs detection and restores the detected (or fallback) language.                                                                                                                                          |

### Options

```ts
type CreateLangOptions = {
  id?: string; // controller id — default: generateId("lang")
  fallback?: string; // default: "en" (DEFAULT_LANG_FALLBACK)
  normalize?: boolean; // default: true — lowercase, and "_" becomes "-"
  navigator?: NavigatorLike | null; // undefined (default) = use the ambient navigator
};
```

| Option      | Default                          | Description                                                                                                                                                                      |
| ----------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `normalize` | `true`                           | `pt_BR` → `pt-br`, `PT-br` → `pt-br`. Turn it off to keep tags exactly as written or detected — at the cost of `is("PT")` no longer matching `pt`.                               |
| `fallback`  | `DEFAULT_LANG_FALLBACK` (`"en"`) | Normalised the same way when `normalize` is on. Used when there is no navigator, when `navigator.language` is empty, and as the target of `reset()` on a server.                 |
| `navigator` | `undefined`                      | A tri-state: `undefined` reads the ambient `navigator`; `null` means "there is none" and forces the fallback; an object is used verbatim. This is what makes detection testable. |
| `id`        | `generateId("lang")`             | Controller id. Not used by the store.                                                                                                                                            |

Plugin-level:

```ts
type LangPluginOptions = {
  fallback?: string;
  normalize?: boolean;
  storeKey?: string; // default: "lang"
};
```

The plugin never forwards a `navigator`, so a registered store always detects
from the ambient browser and `reset()` always restores what the browser said.

### Avoiding name collisions

```ts
Alpine.plugin(langPlugin({ storeKey: "locale" })); // → $store.locale
```

`DEFAULT_LANG_STORE_KEY` keeps the default discoverable from TypeScript.

## Events

```ts
import type { LangChangeDetail } from "@ailura/alpinejs-lang";

lang.on("change", (detail: LangChangeDetail) => {
  detail.current; // "fr-ca"
  detail.source; // "initialization" | "user" | "reset"
  detail.previous; // the LangState before, or null on the first one
});
```

`initialization` is emitted **once, on a microtask after `mount()`** — deferred
so a listener attached synchronously right after `createLangController()` or
after the plugin registers still receives it. `user` fires from `set()`, `reset`
from `reset()`.

## Reactivity

The predicates are the reason the store is not just the controller. `is()` and
`includes()` answer from a **reactive snapshot**, not from the controller's
fields, so calling them from a template registers a dependency on the values
they read and the surrounding effect re-runs on every language change. Answering
from the controller registered no dependency at all: `x-show="$store.lang.is('es')"`
evaluated once and then never again, and the translations froze on whichever
language rendered first.

`package/test/store-reactivity.test.ts` starts every case from the branch that is
**visible**, because a hidden branch that stays hidden looks correct by accident.

## SSR

> Import-safe and deterministic on the server: no `navigator` is read at
> construction, and detection is deferred to `mount()`. A server render sees
> `current === fallback`, `isDetected === false`, `languages === []` — so
> `x-show="$store.lang.is('en')"` can render a default-language page without
> guessing — and the client re-detects on hydration.

There is no persistence: the package does not read or write
`localStorage`, and a chosen language does not survive a reload. Pair it with
`@ailura/alpinejs-ui`'s storage helper if you want that.

## Limitations

- **It does not translate anything.** It is state and comparison, not an i18n
  engine. Pair it with your catalogue or `Intl`.
- **One test file** (`test/store-reactivity.test.ts`) covers the reactive
  predicates and the store projection. Detection, `parseTag` edge cases and the
  `change` payload are not under test.
- **Script subtags are dropped.** `zh-Hant-TW` reports `base: "zh"`,
  `region: "TW"`, and `current: "zh-hant-tw"`. There is no `script` field.
- **`is()` is asymmetric by design.** `is("pt")` matches the current `pt-BR`, but
  `is("pt-BR")` does not match a current of `pt-PT`. That is the point, and it
  will surprise anyone expecting set membership.
- **`includes()` answers about the browser, not the app.** It is `false` for a
  language you just called `set()` with, unless the browser also lists it.
- **No persistence.** Nothing is stored; `reset()` restores the detected value.
- **`LangManager` is wider than the store.** `get()`, `on()` and `destroy()` are
  on the controller, not on `$store.lang`.
- **`fallback` is readonly on the store** but settable at construction, so
  changing it means re-registering the plugin.

## Size

`3.48 kB raw / 1.35 kB gzip` · budget `3 kB` · externalized peers: `alpinejs`,
`@ailura/alpinejs-core` · `size-limit` + `publint` + `attw` verified.

The raw figure is over the `3 kB` limit declared in `.size-limit.json`; gzip is
under it.

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
