# @ailura/alpinejs-env

<p align="center">

[![bundlephobia minzip](https://badgen.net/bundlephobia/minzip/@ailura/alpinejs-env)](https://bundlephobia.com/package/@ailura/alpinejs-env)

</p>

> One reactive `$env` magic — network, page visibility, battery and platform — from a framework-agnostic `EnvController` on `@ailura/alpinejs-core`.

## Installation

```sh
pnpm add @ailura/alpinejs-env alpinejs
# or
npm install @ailura/alpinejs-env alpinejs
```

Requires `alpinejs@^3.0.0` as peer. `@ailura/alpinejs-core` is a **peer
dependency**, not a dependency: no package in this toolkit has a
`dependencies` block, so the host installs it too.

## Usage

This package is **magic-only**: it registers exactly one magic, `$env`. There
is no store and no directives.

### 1. Alpine

```ts
import Alpine from "alpinejs";
import envPlugin from "@ailura/alpinejs-env";

Alpine.plugin(envPlugin());
Alpine.start();
```

```html
<div x-data>
  <p x-text="$env.network.online ? 'Online' : 'Offline'"></p>
  <p x-text="$env.visibility.visible ? 'Tab is visible' : 'Tab is hidden'"></p>
  <p x-show="$env.battery" x-cloak>
    Battery: <span x-text="`${Math.round($env.battery.level * 100)}%`"></span>
    <span x-show="$env.battery.charging">(charging)</span>
  </p>
  <p x-show="!$env.battery" x-cloak>Battery: not reported by this browser</p>
  <p x-text="$env.platform.isMac ? 'On a Mac' : 'Elsewhere'"></p>
</div>
```

```ts
Alpine.plugin(envPlugin({ network: true, visibility: true, battery: false, platform: true })); // → $env.battery is permanently null
```

### 2. Standalone (framework-agnostic)

The controller takes no DOM work at import time and reads the environment in
its constructor, so the values are available immediately:

```ts
import { createEnvController } from "@ailura/alpinejs-env";

const ctrl = createEnvController(); // already mounted
ctrl.network.online; // true
ctrl.visibility.state; // "visible"
ctrl.battery; // null until navigator.getBattery() resolves — see Limitations

const off = ctrl.on("change", (detail) => {
  console.log(detail.network.online, detail.visibility.visible);
});

// ctrl.on('network:change' | 'visibility:change' | 'battery:change' | 'platform:change')
ctrl.refresh(); // re-read network / visibility / platform by hand
off();
ctrl.destroy(); // removes every page-level listener; later calls are silent no-ops
```

## API

| Export                  | Description                                                                                           | Type       |
| ----------------------- | ----------------------------------------------------------------------------------------------------- | ---------- |
| `EnvController`         | Controller class — owns the four domain snapshots, emits `change` plus one event per domain           | `class`    |
| `createEnvController`   | Factory — `(options?) => EnvController`; **mounts before returning**, so `ctrl.mount()` is not needed | `function` |
| `envPlugin`             | `Alpine.plugin()` factory — `(options?) => (alpine) => void`; also the package's `default` export     | `function` |
| `DEFAULT_ENV_MAGIC_KEY` | Default magic key — `"env"`                                                                           | `string`   |
| `EnvMagic`              | The `$env` view — four domains plus `destroy()`                                                       | `type`     |
| `EnvState`              | Controller-side snapshot — `{ network, visibility, battery, platform }`                               | `type`     |
| `EnvChangeDetail`       | `change` payload — identical to `EnvState`                                                            | `type`     |
| `EnvEvents`             | Event map: `change`, `network:change`, `visibility:change`, `battery:change`, `platform:change`       | `type`     |
| `EnvPluginOptions`      | Plugin options — `{ id, network, visibility, battery, platform, magicKey }`                           | `type`     |
| `EnvControllerOptions`  | Factory options — `{ id }`                                                                            | `type`     |
| `NetworkState`          | `{ online, effectiveType?, saveData?, downlink?, rtt? }`                                              | `type`     |
| `VisibilityState`       | `{ visible, hidden, state }` — `state` is the raw `DocumentVisibilityState`                           | `type`     |
| `BatteryState`          | `{ charging, level, chargingTime, dischargingTime }` — `level` is `0…1`                               | `type`     |
| `PlatformState`         | `{ userAgent, platform, vendor, isIos, isAndroid, isMobile, isMac, isWindows }`                       | `type`     |
| `EnvPluginCallback`     | `(alpine: Alpine) => void` — the `Alpine.plugin()` callback signature                                 | `type`     |
| `EnvAlpine`             | Alias for the `Alpine` type the plugin callback receives                                              | `type`     |

`EnvController` also exposes `network`, `visibility`, `battery` and `platform`
getters, plus `snapshot()`. `destroy()` is final: every mutator returns early
afterwards.

### Magic API — `$env`

| Member       | Description                                                                                                                                            |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `network`    | `NetworkState & { supported }` — `online`, and `effectiveType` / `saveData` / `downlink` / `rtt` where `NetworkInformation` exists                     |
| `visibility` | `VisibilityState & { supported }` — `visible`, `hidden`, `state`                                                                                       |
| `battery`    | `BatteryState \| null`. **`null` is the unsupported shape**, and it carries no `supported` flag — every other domain does                              |
| `platform`   | `PlatformState & { supported }` — the UA-derived flags plus the raw `userAgent` / `platform` / `vendor` strings                                        |
| `destroy()`  | Host-owned teardown: removes the `online`/`offline`, `visibilitychange`, `NetworkInformation` and `BatteryManager` listeners. Nothing calls it for you |

The four domains are always present. One switched off through the plugin options
reports `supported: false` and stays frozen at the value read at registration, so
the aggregate is never partial and nothing re-renders for a domain you turned off.

### Options

```ts
type EnvPluginOptions = {
  id?: string; // controller id — defaults to generateId("env")
  network?: boolean; // default true
  visibility?: boolean; // default true
  battery?: boolean; // default true
  platform?: boolean; // default true
  magicKey?: string; // $magic name — default DEFAULT_ENV_MAGIC_KEY ("env")
};
```

A domain is disabled only by the literal value `false` — the factory tests
`options.network !== false`, so `undefined` and every other falsy value keep the
domain on. Disabling `battery` reports `null`; disabling any other domain reports
that domain's registration-time read with `supported: false`.

```ts
type EnvControllerOptions = { id?: string };
```

### Avoiding name collisions

There is no store to rename, so `magicKey` is the only name this package claims:

```ts
Alpine.plugin(envPlugin({ magicKey: "system" })); // → $system
```

The exported constant `DEFAULT_ENV_MAGIC_KEY` keeps the rename discoverable from
TypeScript. The claim goes through `guardMagic`, so a second plugin taking `"env"`
throws a `RegistrationError` instead of silently overwriting it.

### Events

```ts
import type { EnvChangeDetail } from "@ailura/alpinejs-env";

const off = ctrl.on("change", (detail: EnvChangeDetail) => {
  detail.network; // NetworkState
  detail.visibility; // VisibilityState
  detail.battery; // BatteryState | null
  detail.platform; // PlatformState
});
```

The controller emits one aggregate `change` alongside every per-domain event, so
a single subscription covers all four. The order within a change is always
`network:change` → `visibility:change` → `platform:change` → `battery:change` →
`change`. `on()` returns an unsubscribe function and registers itself as a
cleanup, so `destroy()` drops it.

Only `change` reaches Alpine: the plugin syncs all four domains from a single
`change` subscription into one reactive object, so `$env` re-renders as a whole.

## SSR

> SSR-safe — no `window`/`document` at import time. Every read goes through
> `safeWindow()`/`safeDocument()` from `@ailura/alpinejs-core/env`.

There is nothing to hydrate: state is in-memory, so a server render and the
first client read can disagree and the client value wins. The server-side
defaults are deliberately optimistic rather than empty, because an
optimistic-but-wrong value renders one honest line where an "unknown" value
would render a warning that the client immediately takes away:

| Domain       | Server value                                         |
| ------------ | ---------------------------------------------------- |
| `network`    | `{ online: true }`                                   |
| `visibility` | `{ visible: true, hidden: false, state: "visible" }` |
| `battery`    | `null`                                               |
| `platform`   | every string `""`, every boolean `false`             |

`mount()` installs no listeners without a `window`. It also emits **no
initial `change`** on either side of the wire — `change` fires only when a
domain actually moves, so read the getters (or `snapshot()`) for the first
value rather than waiting for an event.

## Integration

- **@ailura/alpinejs-media** — also projects `prefers-color-scheme` and
  `prefers-reduced-motion`, but as a _store_ with breakpoints and viewport
  tracking. Use `$store.media` for layout, `$env.platform` for UA.
- **@ailura/alpinejs-theme** — owns the light/dark/system decision and persists
  it; `$env.platform` is only the platform half of that question.

## Limitations

- **`$env.battery` is `null` until `navigator.getBattery()` resolves.** The
  Battery Status API is async-only, so the magic is populated a tick or more
  after registration and is permanently `null` where the API is absent (iOS
  Safari, desktop Firefox, any insecure context). A template that reads
  `$env.battery.level` without a guard throws on those browsers.
- **Battery has no `supported` flag**, unlike the other three domains — it uses
  the API's own `null` instead. So `$env.battery.supported` is `undefined`, not
  `false`.
- **`platform` never changes.** It is derived from `userAgent`/`platform`/`vendor`
  once, in the constructor; no listener keeps it current, and a user agent
  override mid-session does not reach it.
- **`$env` has no store.** There is no `$store.env`, and no controller instance
  is reachable from the template — only the four domains and `destroy()`.
- **`destroy()` is never called by anything.** It is host-owned: nothing in the
  plugin or in Alpine invokes it, so a page that registers the plugin more than
  once keeps one live listener set per registration.
- **`refresh()` does not re-request the battery manager.** It re-reads the
  manager already held, so it cannot turn a `null` battery into a value.
- **No initial `change` event.** `mount()` emits nothing; `change` is only for
  transitions, so a standalone consumer that subscribes and waits sees nothing
  until the user changes a tab or pulls the plug.
- **Battery hydration can land after `destroy()`.** `getBatteryManager()` is
  awaited; the continuation returns early if the controller was destroyed in the
  meantime, so no event escapes — but the promise is still outstanding.
- The core `Notification`-style platform heuristics here are user-agent string
  matching. `isMac` matches `/mac/i` against the UA as well as the platform, and
  `isMobile` matches `/mobile|iphone|ipad|ipod/i`, which a desktop-mode iPad
  reports.

## Size

`4.58 kB raw / 1.65 kB gzip` · budget `5 kB` · externalized peers: `alpinejs`, `@ailura/alpinejs-core` · `size-limit` + `publint` + `attw` verified.

## Architecture

[Primitives layer](../../ARCHITECTURE.md) — controllers own state, Alpine owns reactivity. See canon, guards, and SSR rules in [ARCHITECTURE.md](../../ARCHITECTURE.md).

## Testing

```sh
pnpm test              # vp test (happy-dom)
pnpm run typecheck     # tsc --noEmit
```

## License

MIT
