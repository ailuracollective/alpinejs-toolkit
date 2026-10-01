# @ailura/alpinejs-geo

<p align="center">

[![bundlephobia minzip](https://badgen.net/bundlephobia/minzip/@ailura/alpinejs-geo)](https://bundlephobia.com/package/@ailura/alpinejs-geo)

</p>

> Geolocation as a reactive store — `request()` for a single fix, `watch()` for a live position, an observable `loading` flag, and the browser's own error code rather than a flattened "denied". Ships a permission adapter for the `permissions` registry.

## Installation

```sh
pnpm add @ailura/alpinejs-geo alpinejs
# or
npm install @ailura/alpinejs-geo alpinejs
```

Requires `alpinejs@^3.0.0` as peer. `@ailura/alpinejs-core` is a **peer
dependency**, not a dependency: no package in this toolkit has a
`dependencies` block, so the host installs it too.

Geolocation additionally requires a **secure context** — HTTPS or
`localhost`. On plain HTTP the browser refuses, and this package's adapter
reports `availability: "insecure-context"` rather than letting the request fail
opaquely.

## Usage

### 1. Standalone (framework-agnostic)

```ts
import { createGeoController } from "@ailura/alpinejs-geo";

const geo = createGeoController(); // already mounted

if (geo.isSupported) {
  geo.on("loading", () => console.log("asking…"));
  geo.on("position", (p) => console.log(p.latitude, p.longitude, p.accuracy));
  geo.on("error", ({ code, message }) => console.warn(code, message));

  const ok = await geo.request({ enableHighAccuracy: true, timeout: 10_000 });
  if (ok) console.log(geo.latitude, geo.longitude, geo.hasPosition);

  geo.watch({ enableHighAccuracy: true }); // → boolean
  geo.unwatch();
  geo.reset(); // clears coordinates and error, keeps nothing
  geo.destroy(); // releases the watch
}
```

`createGeoController()` calls `mount()` for you, and takes `{ id }` — not a bare
string:

```ts
createGeoController({ id: "map" });
```

### 2. Alpine

```ts
import Alpine from "alpinejs";
import geoPlugin from "@ailura/alpinejs-geo";

Alpine.plugin(geoPlugin());
Alpine.start();
```

```html
<div x-data>
  <p x-show="!$store.geo.isSupported" x-cloak>This browser has no Geolocation API.</p>

  <button
    type="button"
    x-show="$store.geo.isSupported"
    x-bind:disabled="$store.geo.isLoading"
    @click="$store.geo.request({ enableHighAccuracy: true })"
  >
    <span x-text="$store.geo.isLoading ? 'Locating…' : 'Find me'"></span>
  </button>

  <button type="button" x-show="!$store.geo.isWatching" @click="$store.geo.watch()">Watch</button>
  <button type="button" x-show="$store.geo.isWatching" @click="$store.geo.unwatch()">
    Stop watching
  </button>

  <output x-show="$store.geo.hasPosition" x-cloak>
    <span x-text="$store.geo.latitude?.toFixed(4)"></span>,
    <span x-text="$store.geo.longitude?.toFixed(4)"></span>
    ±<span x-text="Math.round($store.geo.accuracy ?? 0)"></span> m
  </output>

  <p x-show="$store.geo.hasError" x-cloak>
    <span x-text="$store.geo.error"></span> (code <span x-text="$store.geo.errorCode"></span>)
  </p>
</div>
```

The plugin registers `$store.geo` — **and nothing else**. There is no `$geo`
magic here.

## API

| Export                               | Description                                                                                                                                     | Type             |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| `GeoController`                      | Controller class — `request`, `watch`, `unwatch`, `reset`, `toStore`; emits `position`, `error`, `loading`, `watchStart`, `watchStop`, `update` | `class`          |
| `createGeoController`                | `createGeoController(options?) => GeoController` — mounts it for you                                                                            | `function`       |
| `geoPlugin`                          | Alpine plugin factory — `geoPlugin(options?) => AlpineCallback`; registers `$store.geo`                                                         | `function`       |
| `DEFAULT_GEO_STORE_KEY`              | Default `$store` key — `"geo"`                                                                                                                  | `string` (const) |
| `createGeolocationPermissionAdapter` | A `PermissionAdapter` for the `geolocation` capability — secure-context aware, keeps the browser's error code                                   | `function`       |
| `GEOLOCATION_PERMISSION_NAME`        | The key that adapter registers under — `"geolocation"`                                                                                          | `string` (const) |
| `GeoStore`                           | The Alpine-facing surface: 12 coordinate/flag fields, 5 derived flags and 5 methods                                                             | `type`           |
| `GeoState`                           | `GeoPosition` plus `error`, `errorCode`, `loading`, `watching`, `hasPosition`, `isSupported`                                                    | `type`           |
| `GeoPosition`                        | `{ latitude, longitude, accuracy, altitude, altitudeAccuracy, heading, speed, timestamp }` — every field `number \| null`                       | `type`           |
| `GeoPositionOptions`                 | `{ enableHighAccuracy?, timeout?, maximumAge? }` — passed to the browser untouched                                                              | `type`           |
| `GeoControllerOptions`               | `{ id? }` for `createGeoController`                                                                                                             | `type`           |
| `CreateGeoOptions`                   | Plugin options — `{ id?, storeKey? }`                                                                                                           | `type`           |
| `GeoPermissionAdapter`               | The structural shape the geolocation adapter implements, declared here so `geo` keeps no dependency on the `permissions` package                | `type`           |
| `GeoPermissionState`                 | `"granted" \| "prompt" \| "denied" \| "unknown"`                                                                                                | `type`           |
| `GeoPermissionAvailability`          | `"available" \| "unsupported" \| "insecure-context" \| "policy-blocked" \| "platform-restricted"`                                               | `type`           |
| `GeoPermissionRequestResult`         | `{ permission, result?, error? }` — the adapter's `request()` return                                                                            | `type`           |
| `GeoEvents`                          | Event map for `controller.on(…)`                                                                                                                | `type`           |
| `GeoPositionDetail`                  | The 8 coordinates, as delivered with the `position` event                                                                                       | `type`           |
| `GeoErrorDetail`                     | `{ message, code }` — as delivered with the `error` event                                                                                       | `type`           |
| `GeoAlpine`                          | `Alpine & { store(name): unknown }`                                                                                                             | `type`           |
| `GeoPluginCallback`                  | `(alpine: Alpine) => void`                                                                                                                      | `type`           |

### Store API

```ts
$store.geo.request({ enableHighAccuracy: true, timeout: 10_000 }); // → Promise<boolean>
$store.geo.watch({ enableHighAccuracy: true }); // → boolean
$store.geo.unwatch(); // → boolean
$store.geo.reset(); // → boolean
$store.geo.destroy(); // host-owned teardown
```

| Member                    | Type                                | Description                                                                                                                                                                                                     |
| ------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `latitude` … `timestamp`  | `number \| null`                    | Copied verbatim from `GeolocationPosition.coords` and `.timestamp`. `null` until a fix arrives, and cleared again by `reset()` and by an error.                                                                 |
| `loading` / `isLoading`   | `boolean`                           | A request is in flight. Published **before** the browser is asked, not only when it answers.                                                                                                                    |
| `watching` / `isWatching` | `boolean`                           | A `watchPosition` subscription is open. `destroy()` releases it and flips this.                                                                                                                                 |
| `hasPosition`             | `boolean`                           | `latitude !== null && longitude !== null`                                                                                                                                                                       |
| `isSupported`             | `boolean`                           | Whether `navigator.geolocation.getCurrentPosition` existed **when the controller was constructed**.                                                                                                             |
| `hasError`                | `boolean`                           | `error !== null`                                                                                                                                                                                                |
| `error` / `errorCode`     | `string \| null` / `number \| null` | The browser's own `GeolocationPositionError.message` and `.code` — `1` PERMISSION_DENIED, `2` POSITION_UNAVAILABLE, `3` TIMEOUT. A distinct code deserves distinct advice, so nothing is flattened to "denied". |
| `request(options?)`       | `Promise<boolean>`                  | `true` on success. `false` — never a throw — when the API is missing, the user refuses, the fix times out, or a newer `request()` has already superseded this one.                                              |
| `watch(options?)`         | `boolean`                           | `false` when unsupported **or when already watching**; there is one watch at a time.                                                                                                                            |
| `unwatch()`               | `boolean`                           | `true` if a watch was open and is now closed, `false` if there was none.                                                                                                                                        |
| `reset()`                 | `boolean`                           | Clears every coordinate, timestamp and error. Returns `true`, always.                                                                                                                                           |
| `destroy()`               | `void`                              | Releases the watch the way `unwatch()` does and emits `watchStop`. **Nothing calls it for you** — the host does.                                                                                                |

### Options

```ts
type CreateGeoOptions = {
  id?: string; // controller id — default: generateId("geo")
  storeKey?: string; // $store key — default: "geo"
};
```

There is no `magicKey`: this package registers a store and nothing else.

### Avoiding name collisions

```ts
Alpine.plugin(geoPlugin({ storeKey: "position" })); // → $store.position
```

`DEFAULT_GEO_STORE_KEY` keeps the default discoverable from TypeScript.

## Events

```ts
import type { GeoPositionDetail, GeoErrorDetail } from "@ailura/alpinejs-geo";

geo.on("loading", () => showSpinner());
geo.on("position", (p: GeoPositionDetail) => console.log(p.latitude));
geo.on("error", (e: GeoErrorDetail) => console.warn(e.code, e.message));
geo.on("watchStart", () => console.log("watching"));
geo.on("watchStop", () => console.log("stopped"));
geo.on("update", () => console.log("reset"));
```

`loading` exists because `position` and `error` only ever report the _end_ of a
request. Without it there is no way to show a pending state — the flag is
observable at the far end only.

The plugin subscribes to all six and re-projects the whole store on each, which
is what keeps every field in `$store.geo` current.

## Requesting permission

`request()` is a geolocation call, not a permission call. To _ask_ first, use
the shipped adapter with the
[`@ailura/alpinejs-permissions`](https://www.npmjs.com/package/@ailura/alpinejs-permissions)
registry:

```ts
import permissionsPlugin from "@ailura/alpinejs-permissions";
import geoPlugin from "@ailura/alpinejs-geo";
import { createGeolocationPermissionAdapter } from "@ailura/alpinejs-geo";

Alpine.plugin(permissionsPlugin({ adapters: [createGeolocationPermissionAdapter()] }));
Alpine.plugin(geoPlugin());
```

```html
<button
  type="button"
  x-show="$permissions.registry.geolocation?.permission !== 'granted'"
  @click="await $permissions.request('geolocation')"
>
  Allow location
</button>
<button type="button" x-show="$store.geo.hasPosition" x-cloak @click="$store.geo.request()">
  Find me
</button>
```

The adapter reports `unsupported` when the API is missing and
`insecure-context` when the page is not served over HTTPS — checked _before_ the
request, so the failure has a name. Its `request()` passes `{ timeout: 10_000 }`
plus your options, and keeps the browser's error code in the message.

Note that the adapter is a **structural** type, not an import from `permissions`:
`geo` ships its own `GeoPermissionAdapter` interface and a conformance test in
`test/permission-adapter.test.ts` asserts the factory's return type is assignable
to the registry's `PermissionAdapter`. `geo` therefore never depends on
`permissions`, and the two sides still cannot drift.

## SSR

> Import-safe and inert on the server: no `window`/`document`/`navigator` is read
> at import time, and the support probe is a `typeof navigator !== "undefined"`
> guard in the constructor. On the server `isSupported` is `false`,
> `createGeoController()` constructs without throwing, and `request()` resolves
> `false` with `error: "Geolocation is not supported"` rather than throwing. The
> permission adapter reaches the DOM only through `safeWindow()`.

## Limitations

- **`isSupported` is latched at construction.** It answers "could this document
  ever geolocate", not "can it right now" — a browser that adds the API later
  will not flip an existing store.
- **Mutators are not frozen-guarded.** `request()`, `watch()`, `unwatch()` and
  `reset()` do not check the destroyed phase, so they still touch state after
  `destroy()`. `destroy()` is the release hook, not a freeze.
- **One watch at a time.** A second `watch()` returns `false` and leaves the
  first subscription alone.
- **`watch()` does not set `loading`.** Only `request()` publishes `loading`;
  during a watch, `isLoading` stays `false` and the position just arrives.
- **`reset()` leaves `watching` alone.** It clears the coordinates, timestamp
  and error, so a live watch empties the readout and refills it on the next fix.
- **The store is a flat snapshot, not a live view.** `controller.toStore()` gives
  getters, but the plugin registers a plain object refreshed on events — so a
  field the event list does not cover would keep its registration-time value.
  All 17 are covered.
- **`GeoState` is unused by the plugin** — it describes the controller's own
  fields, which the store mirrors one for one.
- **`packages/geo/test/ssr-safety.test.ts:70` does not typecheck.** It calls
  `createGeoController("geo-ssr")` with a string, while the factory takes
  `GeoControllerOptions`. The test passes at runtime (`options.id` on a string is
  `undefined`) and `vp test` is green, but `tsc --noEmit -p packages/geo` reports
  `TS2559` there. Pre-existing; not introduced by this package's current shape.

## Size

`6.21 kB raw / 2.00 kB gzip` · budget `3 kB` · externalized peers: `alpinejs`,
`@ailura/alpinejs-core` · `size-limit` + `publint` + `attw` verified.

The figures are measured on the built `dist/index.mjs`; the budget is the
`limit` in `.size-limit.json`. This package carries the most surface of the
primitives group (controller, store projection, events and a permission adapter),
and gzip is the number to watch — the raw figure is over the declared limit.

## Architecture

[Primitives layer](../../ARCHITECTURE.md) — controllers own state, Alpine owns reactivity. See canon, guards, and SSR rules in [ARCHITECTURE.md](../../ARCHITECTURE.md).

## Testing

```sh
pnpm test              # vp test (happy-dom) — 5 files
pnpm run typecheck     # tsc --noEmit
```

`test/` covers the loading/reaction sequence, the store projection, watch
teardown, SSR safety, and the permission-adapter conformance. See
[ARCHITECTURE.md §8](../../ARCHITECTURE.md).

## License

MIT
