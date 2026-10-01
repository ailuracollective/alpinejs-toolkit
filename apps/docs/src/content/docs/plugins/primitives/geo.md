---
title: Geo
---

@ailura/alpinejs-geo

A `geo` store for the Geolocation API: a one-shot read, a live watch, and the error
state when the user declines. The plugin owns the lifecycle; you render the coordinates.

## Install

```sh
pnpm add alpinejs @ailura/alpinejs-geo
```

## Register the plugin

Do this once, before `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import geoPlugin from "@ailura/alpinejs-geo";

Alpine.plugin(geoPlugin());

Alpine.start();
```

That registers a `geo` store, so everything below is reachable at `$store.geo`.

## Minimal example

Ask once, then show the coordinates or the reason they are missing.

```html
<div x-data>
  <p x-show="$store.geo.isSupported">
    <span x-text="$store.geo.latitude"></span>,
    <span x-text="$store.geo.longitude"></span>
    ±<span x-text="$store.geo.accuracy"></span> m
  </p>

  <p x-show="!$store.geo.isSupported">This browser has no Geolocation.</p>

  <p x-show="$store.geo.isLoading">Locating…</p>
  <p x-show="$store.geo.hasError">
    <span x-text="$store.geo.errorCode"></span>:
    <span x-text="$store.geo.error"></span>
  </p>

  <button @click="$store.geo.request()">Find me</button>
  <button @click="$store.geo.reset()">Clear</button>
</div>
```

Use the predicates, not the values. `hasPosition` and `hasError` are the two that tell
you which of three states you are in, and every value is `null` in the other two.

## One read or a live watch

`request()` reads once. `watch()` keeps reading while you are on screen, and
`unwatch()` stops. Watching without unwatching keeps the GPS running and drains the
battery.

```js
$store.geo.request({ enableHighAccuracy: true, timeout: 10000 });
$store.geo.watch();
$store.geo.unwatch();
```

`request()` and `watch()` both take the platform's position options:
`enableHighAccuracy`, `timeout` and `maximumAge`.

`isWatching` is the flag for the button state.

## The permission has to be requested from a gesture

`request()` and `watch()` both trigger a browser prompt, and the browser only allows
that from a user gesture. Calling either during page load is rejected, and the error
you get is a permission failure rather than a missing gesture.

:::caution[Distinguish "denied" from "unavailable" in the UI]
`errorCode` tells you why: the user said no, the position is unavailable, the request
timed out, or the browser has no Geolocation at all. Only the first is worth asking the
user to change, so branch on `errorCode` rather than showing the same message for all
four.
:::

## API reference

| Name                                                             | Type   | Purpose                                                                                                                                                   |
| ---------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `$store.geo.request()`                                           | method | Read the position once.                                                                                                                                   |
| `$store.geo.watch()`                                             | method | Start continuous updates.                                                                                                                                 |
| `$store.geo.unwatch()`                                           | method | Stop continuous updates.                                                                                                                                  |
| `$store.geo.reset()`                                             | method | Clear the position and the error.                                                                                                                         |
| `$store.geo.destroy()`                                           | method | Host-owned teardown: releases the `watchPosition` subscription a `watch()` started. Nothing calls it for you. `unwatch()` still stops a watch on its own. |
| `$store.geo.latitude` / `longitude`                              | store  | The coordinates.                                                                                                                                          |
| `$store.geo.accuracy`                                            | store  | Radius of the fix, in metres.                                                                                                                             |
| `$store.geo.altitude` / `altitudeAccuracy` / `heading` / `speed` | store  | The rest of `GeolocationPosition`, when the browser supplies it.                                                                                          |
| `$store.geo.timestamp`                                           | store  | When the reading was taken.                                                                                                                               |
| `$store.geo.isSupported`                                         | store  | Whether the browser has Geolocation.                                                                                                                      |
| `$store.geo.isLoading` / `loading`                               | store  | Whether a read is in flight.                                                                                                                              |
| `$store.geo.isWatching` / `watching`                             | store  | Whether a watch is running.                                                                                                                               |
| `$store.geo.hasPosition`                                         | store  | Whether there is a position to show.                                                                                                                      |
| `$store.geo.hasError` / `error` / `errorCode`                    | store  | Why the last attempt failed.                                                                                                                              |

## Plugin options

```ts
geoPlugin({ id: "app-geo", storeKey: "position" });
```
