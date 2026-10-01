# @ailura/alpinejs-attention

<p align="center">

[![bundlephobia minzip](https://badgen.net/bundlephobia/minzip/@ailura/alpinejs-attention)](https://bundlephobia.com/package/@ailura/alpinejs-attention)

</p>

> Screen Wake Lock and Idle Detection magics for Alpine.js — two browser APIs with uneven support, wrapped so the unsupported case is a value you can render rather than a crash, on `@ailura/alpinejs-core`.

## Installation

```sh
pnpm add @ailura/alpinejs-attention alpinejs
# or
npm install @ailura/alpinejs-attention alpinejs
```

Requires `alpinejs@^3.0.0` as peer. `@ailura/alpinejs-core` is a **peer
dependency**, not a dependency: no package in this toolkit has a
`dependencies` block, so the host installs it too.

## Browser support — read this first

Both APIs behind this package are partial, and **neither is available in
Firefox or Safari.** What "unavailable" means differs per API, and the
difference matters:

| API              | Chrome / Edge (desktop)                       | Chrome (Android) | Firefox | Safari |
| ---------------- | --------------------------------------------- | ---------------- | ------- | ------ |
| Screen Wake Lock | yes, needs a user gesture                     | yes              | **no**  | **no** |
| Idle Detection   | yes, needs a user gesture + permission prompt | yes              | **no**  | **no** |

The package never throws for a missing API — it reports it — but it does not
invent capability either. The two behaviours you have to know:

- **`$wakelock.isSupported` is `false` and `request()` resolves `false`** with
  `error` set to `"Wake Lock not supported"`. Nothing happens. Render the
  unsupported state.
- **`$idle.isSupported` is `false`, and `requestPermission()` reports
  `"granted"` anyway.** There is no prompt to answer where there is no API, so
  reporting `"denied"` would leave you permanently unable to start a watch in
  exactly the browsers where a fallback is most useful. **Check `isSupported`,
  not `permission`** — a `"granted"` reading does not mean a prompt was shown.
  `start()` then falls back to a one-shot timer (see Limitations).

## Usage

### 1. Standalone (framework-agnostic)

```ts
import { createWakeLockController, createIdleController } from "@ailura/alpinejs-attention";

const wl = createWakeLockController();
console.log(wl.isSupported); // false on the server, and in Firefox
if (wl.isSupported) await wl.request(); // must be inside a user gesture
wl.isActive; // false until the sentinel is held
await wl.release();

const idle = createIdleController();
idle.on("idle:change", (detail) => {
  if (detail.userState === "idle") pauseExpensiveWork();
});
if (idle.isSupported) {
  const permission = await idle.requestPermission();
  if (permission === "granted") await idle.start({ threshold: 120_000 });
}
idle.stop();

wl.destroy();
idle.destroy();
```

Both factories call `mount()` for you. Neither touches the DOM at import time,
so a page can read `isSupported` during SSR and render the right state in the
first paint.

### 2. Alpine

```ts
import Alpine from "alpinejs";
import attentionPlugin from "@ailura/alpinejs-attention";

Alpine.plugin(attentionPlugin());
Alpine.start();
```

The plugin registers two magics, `$wakelock` and `$idle`, and nothing else — no
store, no directives. Both surfaces are reactive views of their controllers, so
every read in a template re-renders on its own.

```html
<div x-data>
  <!-- Screen Wake Lock: request() exige un gesto del usuario, así que la
       llamada vive en el @click, no en un x-effect. -->
  <template x-if="!$wakelock.isSupported">
    <p class="text-sm text-[var(--ios-label-secondary)]">
      Screen Wake Lock is not available in this browser.
    </p>
  </template>

  <button
    x-show="$wakelock.isSupported"
    x-cloak
    x-bind:disabled="$wakelock.isRequesting"
    @click="$wakelock.isActive ? $wakelock.release() : $wakelock.request()"
    x-text="$wakelock.isActive ? 'Release' : 'Keep screen on'"
  ></button>

  <p x-show="$wakelock.error" x-cloak x-text="$wakelock.error"></p>
</div>
```

## API

### Exports

| Export                            | Description                                                                                       | Type       |
| --------------------------------- | ------------------------------------------------------------------------------------------------- | ---------- |
| `WakeLockController`              | Owns one screen wake lock — support, sentinel, in-flight flag, error                              | `class`    |
| `IdleController`                  | Owns one idle watch — permission, threshold, user/screen state, fallback timer                    | `class`    |
| `AttentionController`             | Both of the above under one lifecycle, re-emitting their events. Not used by the plugin           | `class`    |
| `createWakeLockController`        | `createWakeLockController(options?) => WakeLockController`, already `mount()`ed                   | `function` |
| `createIdleController`            | `createIdleController(options?) => IdleController`, already `mount()`ed                           | `function` |
| `createAttentionController`       | `createAttentionController(options?) => AttentionController`, already `mount()`ed                 | `function` |
| `attentionPlugin`                 | `Alpine.plugin()` factory — registers `$wakelock` and `$idle`                                     | `function` |
| `createWakeLockPermissionAdapter` | `(name: "screen-wake-lock") => WakeLockPermissionAdapter` for a permissions registry              | `function` |
| `WAKE_LOCK_PERMISSION_NAME`       | `"screen-wake-lock"`                                                                              | `string`   |
| `DEFAULT_ATTENTION_WAKELOCK_KEY`  | Default magic key — `"wakelock"`                                                                  | `string`   |
| `DEFAULT_ATTENTION_IDLE_KEY`      | Default magic key — `"idle"`                                                                      | `string`   |
| `DEFAULT_IDLE_THRESHOLD`          | `60_000` ms. Equal to the minimum, because the API's floor is 60 s                                | `number`   |
| `MIN_IDLE_THRESHOLD`              | `60_000` ms. Below this the browser throws                                                        | `number`   |
| `IdleUserState`                   | `'active' \| 'idle'`                                                                              | `type`     |
| `IdleScreenState`                 | `'locked' \| 'unlocked'`                                                                          | `type`     |
| `WakeLockMagic`                   | The `$wakelock` surface (see below)                                                               | `type`     |
| `IdleMagic`                       | The `$idle` surface (see below)                                                                   | `type`     |
| `AttentionEvents`                 | Event map — `'wakelock:change'`, `'idle:change'`                                                  | `type`     |
| `WakeLockEvents` / `IdleEvents`   | `Pick<AttentionEvents, …>` — one event each, for a controller that only has one                   | `type`     |
| `WakeLockChangeDetail`            | `{ isActive, isRequesting, error }`                                                               | `type`     |
| `IdleChangeDetail`                | `{ userState, screenState, permission, error, threshold, isWatching }`                            | `type`     |
| `WakeLockPermissionAdapter`       | The adapter shape, declared structurally so this package never depends on `permissions`           | `type`     |
| `WakeLockPermissionState`         | `'granted' \| 'prompt' \| 'denied' \| 'unknown'`                                                  | `type`     |
| `WakeLockPermissionAvailability`  | `'available' \| 'unsupported' \| 'insecure-context' \| 'policy-blocked' \| 'platform-restricted'` | `type`     |
| `WakeLockPermissionRequestResult` | `{ permission, result?, error? }`                                                                 | `type`     |
| `WakeLockSentinelLike`            | Minimal shape of a Wake Lock sentinel                                                             | `type`     |
| `WakeLockLike`                    | Minimal shape of `navigator.wakeLock`                                                             | `type`     |
| `IdleDetectorLike`                | Minimal shape of an `IdleDetector`                                                                | `type`     |
| `IdleDetectorConstructor`         | `new () => IdleDetectorLike` plus `requestPermission()`                                           | `type`     |
| `CreateAttentionOptions`          | `{ wakelockKey?, idleKey? }`                                                                      | `type`     |
| `AttentionControllerOptions`      | `{ id? }`                                                                                         | `type`     |
| `AttentionAlpine`                 | Typed view of `Alpine` the plugin uses                                                            | `type`     |
| `AttentionPluginCallback`         | `Alpine.plugin()` callback signature                                                              | `type`     |

### Controller API

`WakeLockController`:

| Member            | Description                                                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `isSupported`     | `navigator.wakeLock` exists. `false` on the server and in Firefox/Safari                                                                         |
| `isActive`        | A sentinel is held **and** not revoked. Reads `sentinel.released`, so an OS revocation shows up here                                             |
| `isRequesting`    | A `request()` is in flight — set while awaiting, never left `true` on failure                                                                    |
| `error`           | The last failure message, or `null`. Writable through `setError()`                                                                               |
| `request()`       | `Promise<boolean>`. **`false` + `error` set** when unsupported; `false` + the browser's message when refused. Must be called from a user gesture |
| `release()`       | `Promise<boolean>`. `false` when no sentinel is held, including one the OS already revoked                                                       |
| `setError(error)` | Dismiss or set the surfaced error. The only writable member — every other field is reported state                                                |
| `destroy()`       | Releases the held sentinel, fire-and-forget                                                                                                      |

`IdleController`:

| Member                | Description                                                                                                 |
| --------------------- | ----------------------------------------------------------------------------------------------------------- |
| `isSupported`         | `window.IdleDetector` exists. **`false` in Firefox and Safari**                                             |
| `permission`          | Last `requestPermission()` result, or `null`. **Reports `"granted"` when the API is missing**               |
| `threshold`           | Current threshold in ms. Starts at `DEFAULT_IDLE_THRESHOLD` and is raised to the 60 s floor by `start()`    |
| `isLoading`           | A `start()` is in flight                                                                                    |
| `isWatching`          | The watch is running. Same value as `isActive`                                                              |
| `isIdle`              | `userState === 'idle'`. `false` when not watching, and also in the fallback until its one-shot timer fires  |
| `userState`           | `'active' \| 'idle' \| null` — `null` when stopped                                                          |
| `screenState`         | `'locked' \| 'unlocked' \| null`. The fallback always reports `'unlocked'`                                  |
| `error`               | The last failure message, or `null`. Writable through `setError()`                                          |
| `requestPermission()` | `Promise<PermissionState>`. Calls the browser's prompt when it exists; reports `"granted"` when it does not |
| `start(options?)`     | `Promise<boolean>` — `true` means _watching_, not _using the API_. `options.threshold` is clamped to ≥ 60 s |
| `stop()`              | `boolean`. `false` when not watching. Clears the fallback timer                                             |
| `setError(error)`     | Dismiss or set the surfaced error                                                                           |
| `destroy()`           | `stop()` plus the controller teardown                                                                       |

### Magic API

`$wakelock`:

```ts
$wakelock.isSupported; // boolean
$wakelock.isActive; // boolean
$wakelock.isRequesting; // boolean
$wakelock.error = null; // writable — dismisses the error
await $wakelock.request();
await $wakelock.release();
$wakelock.destroy();
```

`$idle`:

```ts
$idle.isSupported; // boolean
$idle.permission; // PermissionState | null
$idle.threshold; // number (ms)
$idle.isLoading;
$idle.isWatching;
$idle.isActive; // same as isWatching
$idle.isIdle;
$idle.userState; // 'active' | 'idle' | null
$idle.screenState; // 'locked' | 'unlocked' | null
$idle.error = null; // writable
await $idle.requestPermission();
await $idle.start({ threshold: 120_000 });
$idle.stop();
$idle.destroy();
```

Both magics are **read models, not emitters** — there is nothing to subscribe
to. The controllers emit; use them standalone if you need the events.

### Options

```ts
type CreateAttentionOptions = {
  wakelockKey?: string; // default 'wakelock'
  idleKey?: string; // default 'idle'
};
type AttentionControllerOptions = { id?: string };
```

That is the whole option surface. **Threshold is a `start()` argument, not a
plugin option** — two `$idle` consumers on one page want different thresholds
and there is only one `$idle`.

### Avoiding name collisions

```ts
Alpine.plugin(attentionPlugin({ wakelockKey: "screen", idleKey: "inactive" }));
// → $screen and $inactive
```

The exported constants `DEFAULT_ATTENTION_WAKELOCK_KEY` and
`DEFAULT_ATTENTION_IDLE_KEY` keep the renames discoverable. There is no store
key — this package registers no store.

### Events

```ts
import type { AttentionEvents } from "@ailura/alpinejs-attention";

wl.on("wakelock:change", (d) => {
  d.isActive;
  d.isRequesting;
  d.error;
});
idle.on("idle:change", (d) => {
  d.userState;
  d.screenState;
  d.permission;
  d.error;
  d.threshold;
  d.isWatching;
});
```

`AttentionController` re-emits both under one emitter. Nothing is emitted on
the magics.

## Permission registry adapter

A wake lock is the odd one out among browser permissions: there is no prompt
and no persisted grant. It is authorized by the user gesture that calls
`request()` and revoked by the OS whenever the page is hidden. The adapter
reports accordingly:

```ts
import {
  createWakeLockPermissionAdapter,
  WAKE_LOCK_PERMISSION_NAME,
} from "@ailura/alpinejs-attention";

const adapter = createWakeLockPermissionAdapter();
adapter.name; // 'screen-wake-lock'
adapter.requiresUserGesture; // true
await adapter.getAvailability(); // 'available' | 'unsupported' | 'insecure-context'
await adapter.query(); // 'granted' if the API exists, else 'denied'
const { permission, result, error } = await adapter.request();
```

`query()` reports `"granted"` whenever the API exists. Claiming otherwise would
make a registry permanently red for a capability that is in fact available;
`request()` is where the honest answer lives, and it returns the real sentinel
in `result`. The adapter is declared **structurally** rather than imported from
`@ailura/alpinejs-permissions`, so this package keeps zero dependency on it.

## SSR

> SSR-safe — no `window`/`document` at import time, and no `matchMedia`. Both
> support probes go through `safeWindow()`, so on the server `isSupported` is
> `false` for both surfaces and the page can render the unsupported state in
> the first paint instead of discovering it after hydration.

## Limitations

- **Neither API exists in Firefox or Safari.** `$wakelock.isSupported` and
  `$idle.isSupported` are `false` there. The package reports it; rendering
  something meaningful in that state is the page's job.
- **`$idle.requestPermission()` reports `"granted"` where the API is missing.**
  Deliberate — there is no prompt to deny — and it means **`permission` alone
  cannot tell you whether a real prompt was shown.** Always branch on
  `isSupported` first.
- **Without the Idle Detection API, `start()` falls back to a one-shot timer,
  not to idle detection.** It reports `userState: 'active'`, flips to `'idle'`
  after `threshold` milliseconds **once**, never returns to `'active'`, cannot
  see input, and always claims the screen is `'unlocked'`. It will call a user
  idle who never left. Do not spend money on it.
- **The 60-second minimum is real.** `MIN_IDLE_THRESHOLD === DEFAULT_IDLE_THRESHOLD
=== 60_000`, because the browser throws below 60 s. A `threshold: 5_000` is
  silently raised to 60 s rather than rejected — which means a caller asking for
  5 seconds gets 60 and is not told.
- **OS revocation of a wake lock is detected, not reported.** The OS releases
  the sentinel when the page is hidden, and `isActive` reads `sentinel.released`
  — so it turns `false` correctly, but no event fires, `error` stays `null`, and
  the only way to notice is a re-render. There is no
  `visibilitychange` re-request.
- **`request()` must be called from a user gesture.** Outside one the browser
  rejects it, and the rejection's message is what lands in `error`. There is no
  gesture detection here to give you a better message.
- **`$wakelock` and `$idle` are not emitters.** They are reactive read models.
  Subscribe on the controllers if you need the events, which means giving up
  the Alpine binding.
- **`destroy()` on both magics is host-owned.** Nothing calls it for you. In a
  normal page that is fine — the page outlives both — but in a test or a route
  teardown an unreleased wake lock or an uncleared timer is a leak.
- **The plugin builds two independent controllers, not an
  `AttentionController`.** `$idle.destroy()` does not release the wake lock, and
  `$wakelock.destroy()` does not stop the idle watch. Use the combined
  controller standalone if you want one handle.

## Size

`6.29 kB raw / 2.14 kB gzip` · budget `3 kB` · externalized peers: `alpinejs`, `@ailura/alpinejs-core` · `size-limit` + `publint` + `attw` verified.

## Architecture

[Features layer](../../ARCHITECTURE.md) — controllers own state, Alpine owns reactivity. Two independent `BaseController`s rather than the combined `AttentionController`, and the plugin projects each onto its own reactive magic surface. See canon, guards, and SSR rules in [ARCHITECTURE.md](../../ARCHITECTURE.md).

## Testing

```sh
pnpm test              # vp test (happy-dom)
pnpm run typecheck     # tsc --noEmit
```

Uses `@ailura/alpinejs-testing` — `html`/`mount`/`settled`/`start`/`resume`/`reset`. `happy-dom` has neither browser API, so the tests exercise the unsupported path and the fallback; the supported paths need a real browser. See [ARCHITECTURE.md §8](../../ARCHITECTURE.md).

## License

MIT
