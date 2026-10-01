---
title: Attention
---

@ailura/alpinejs-attention

Two independent magics for screen attention: `$wakelock` keeps the screen awake, and
`$idle` tells you when the user stepped away. Neither one renders anything; both are
meant to change what your app does.

## Install

```sh
pnpm add alpinejs @ailura/alpinejs-attention
```

## Register the plugin

Do this once, before `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import attentionPlugin from "@ailura/alpinejs-attention";

Alpine.plugin(attentionPlugin());

Alpine.start();
```

That registers two magics, `$wakelock` and `$idle`. There is no store: both are
standalone magics you call directly.

## Minimal example

Keep the screen awake while a long task runs, and warn when the user comes back.

```html
<div x-data>
  <p x-show="$wakelock.isSupported">Screen kept awake: <span x-text="$wakelock.isActive"></span></p>
  <p x-show="!$wakelock.isSupported">This browser has no Wake Lock.</p>

  <p>User: <span x-text="$idle.userState"></span></p>
</div>
```

`isSupported` and `isActive` are getters, not methods. Reading them in an expression
is the whole API for the read-only side.

## Dismissing an error

`error` is the only writable field on either surface. Assigning to it is a real
operation: it sets the error on the underlying controller, and the write survives the
next state change instead of being overwritten.

```html
<button @click="$wakelock.error = null" x-show="$wakelock.error">Dismiss</button>
<button @click="$idle.error = null" x-show="$idle.error">Dismiss</button>
```

Every other exposed field (`isActive`, `isRequesting`, `isSupported`, `userState`,
`screenState`, `permission`, `threshold`, `isLoading`, `isWatching`, `isIdle`) is
read-only reported state. Assigning to them in a template has no effect on the
plugin: the next state change re-projects the real value over it.

## Using the wake lock

Requesting a wake lock has to be driven by a user gesture, so call it from a click.

```html
<button @click="$wakelock.request()" x-show="!$wakelock.isActive">Keep the screen on</button>
<button @click="$wakelock.release()" x-show="$wakelock.isActive">Let it sleep</button>
```

**Release it when you stop needing it.** A wake lock that is never released keeps the
screen on indefinitely and drains the battery.

```js
$wakelock.release();
```

## Using idle detection

Idle detection needs a threshold and, on browsers that require it, a permission the
user has to grant.

```js
$idle.start({ threshold: 60000 });
```

Requesting the permission and stopping the detector are both user actions.

```html
<button @click="$idle.requestPermission()">Enable idle detection</button>
<button @click="$idle.stop()">Stop detecting</button>
```

:::caution[Idle detection is often behind a permission prompt]
Browsers gate the Idle Detection API with their own permission, and `start()` never
asks for it. Call `requestPermission()` from a user gesture first: if the detector
still refuses, the message lands in `$idle.error` and `isWatching` stays `false`. On a
browser with no Idle Detector at all, `start()` falls back to a plain timer that reports
`"active"` and flips to `"idle"` once the threshold elapses.
:::

## API reference

**`$wakelock`**

| Name                     | Type                | Purpose                                                                |
| ------------------------ | ------------------- | ---------------------------------------------------------------------- |
| `$wakelock.error`        | `store` (writable)  | The last error message, or `null`. Assigning dismisses it.             |
| `$wakelock.isSupported`  | `store` (read-only) | Whether the browser has the Wake Lock API.                             |
| `$wakelock.isActive`     | `store` (read-only) | Whether a lock is currently held.                                      |
| `$wakelock.isRequesting` | `store` (read-only) | Whether a `request()` is in flight.                                    |
| `$wakelock.request()`    | `method`            | Take the lock. Must be called from a user gesture.                     |
| `$wakelock.release()`    | `method`            | Drop the lock.                                                         |
| `$wakelock.destroy()`    | `method`            | Host-owned teardown: releases the held lock. Nothing calls it for you. |

**`$idle`**

| Name                          | Type                | Purpose                                                                                   |
| ----------------------------- | ------------------- | ----------------------------------------------------------------------------------------- |
| `$idle.error`                 | `store` (writable)  | The last error message, or `null`. Assigning dismisses it.                                |
| `$idle.userState`             | `store` (read-only) | `"active"` or `"idle"`.                                                                   |
| `$idle.screenState`           | `store` (read-only) | `"locked"` or `"unlocked"`.                                                               |
| `$idle.threshold`             | `store` (read-only) | The configured idle threshold, in ms. Minimum `60000`; anything lower is raised to it.    |
| `$idle.permission`            | `store` (read-only) | The last `requestPermission()` result, or `null` before you ask.                          |
| `$idle.isSupported`           | `store` (read-only) | Whether the browser has the Idle Detection API.                                           |
| `$idle.isWatching`/`isActive` | `store` (read-only) | Whether `start()` is running. `isActive` is an alias.                                     |
| `$idle.isIdle`                | `store` (read-only) | Whether `userState` is `"idle"`.                                                          |
| `$idle.isLoading`             | `store` (read-only) | Whether the real detector is starting.                                                    |
| `$idle.start(options?)`       | `method`            | Begin detecting. Pass `{ threshold }` to set the timeout.                                 |
| `$idle.stop()`                | `method`            | Stop detecting.                                                                           |
| `$idle.requestPermission()`   | `method`            | Ask the user to allow the API.                                                            |
| `$idle.destroy()`             | `method`            | Host-owned teardown: stops detecting and clears the idle timer. Nothing calls it for you. |

## Plugin options

```ts
attentionPlugin({ wakelockKey: "screen", idleKey: "away" });
```
