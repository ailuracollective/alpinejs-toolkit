# @ailura/alpinejs-notify

<p align="center">

[![bundlephobia minzip](https://badgen.net/bundlephobia/minzip/@ailura/alpinejs-notify)](https://bundlephobia.com/package/@ailura/alpinejs-notify)

</p>

> One reactive `$notify` magic over the browser `Notification` API — permission request, three send routes, iOS service-worker delivery, and a `@ailura/alpinejs-permissions` adapter, on `@ailura/alpinejs-core`.

## Installation

```sh
pnpm add @ailura/alpinejs-notify alpinejs
# or
npm install @ailura/alpinejs-notify alpinejs
```

Requires `alpinejs@^3.0.0` as peer. `@ailura/alpinejs-core` is a **peer
dependency**, not a dependency: no package in this toolkit has a
`dependencies` block, so the host installs it too.

> **Canon note.** This package is one of the seven deliberate exemptions in
> [ARCHITECTURE.md §9](../../ARCHITECTURE.md). There is no `BaseController` and
> no event map: notification state _is_ the browser's state, read through a
> getter on every access, so a controller would only hold getters. What the
> package does have is a wider surface than the usual magic — standalone
> capability probes, a delivery helper, and a permission adapter.

## Usage

This package is **magic-only**: it registers exactly one magic, `$notify`. There
is no store and no directives.

### 1. Alpine

```ts
import Alpine from "alpinejs";
import notifyPlugin from "@ailura/alpinejs-notify";

Alpine.plugin(notifyPlugin());
Alpine.start();
```

```html
<div x-data>
  <p x-text="`Permission: ${$notify.permission}`"></p>

  <!-- shown only where the platform will never grant it without an install -->
  <p x-show="$notify.requiresHomeScreenInstall" x-cloak>
    Add this site to your Home Screen and reopen it from there.
  </p>

  <button @click="await $notify.requestPermission()">Enable notifications</button>

  <!-- $notify.permission re-reads on focus / visibilitychange, so this
       switches from hidden to visible the moment the browser prompt is answered -->
  <button
    x-show="$notify.permission === 'granted'"
    @click="$notify.send('Saved', { body: 'Draft saved.' })"
  >
    Send
  </button>
</div>
```

With a service worker, which is what iOS requires:

```ts
Alpine.plugin(
  notifyPlugin({
    serviceWorkerUrl: "/notify-sw.js", // must call showNotification() on `push`
    autoRegisterServiceWorker: true, // default
  })
);
```

### 2. Standalone (framework-agnostic)

Every capability probe and the delivery helper are exported and usable without
Alpine:

```ts
import { createNotifyMagic, showNotify, isNotifySupported } from "@ailura/alpinejs-notify";

const notify = createNotifyMagic();

notify.isSupported; // false in a browser without Notification
notify.requiresHomeScreenInstall; // iOS, and not launched standalone
await notify.requestPermission(); // → 'granted' | 'denied' | 'default'

const shown = await showNotify("Build finished", { body: "12 tests passed." });
// → Notification on desktop/Android; null when the service-worker route was used

isNotifySupported(); // whether `Notification` exists at all
```

`showNotify()` is the only route that tries all three delivery paths; see
[Delivery routes](#delivery-routes) below.

## API

| Export                               | Description                                                                                                                          | Type       |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| `createNotifyMagic`                  | Builds the magic object — getters for state, methods for actions. No Alpine, no DOM at construction                                  | `function` |
| `showNotify`                         | `(title, options?) => Promise<Notification \| null>` — picks the route the platform allows. Never throws                             | `function` |
| `isNotifySupported`                  | `() => boolean` — whether `window.Notification` exists at all                                                                        | `function` |
| `getNotifyPermission`                | `() => 'granted' \| 'denied' \| 'default'` — `'default'` when the API is absent or reports nothing                                   | `function` |
| `isIosDevice`                        | `() => boolean` — UA/platform sniff for iPhone, iPad, iPod, or an iPad masquerading as `MacIntel`                                    | `function` |
| `isStandaloneDisplayMode`            | `() => boolean` — `(display-mode: standalone)` matches, or iOS `navigator.standalone`                                                | `function` |
| `requiresServiceWorkerNotifications` | `() => boolean` — iOS **and not** standalone: the _permission_ is not obtainable yet                                                 | `function` |
| `isServiceWorkerDeliveryRequired`    | `() => boolean` — iOS at all: _delivery_ must route through a service worker even once installed                                     | `function` |
| `createNotifyPermissionAdapter`      | The `NotifyPermissionAdapter` for a `permissions` registry — see [Permission adapter](#permission-adapter)                           | `function` |
| `NOTIFY_PERMISSION_NAME`             | The name this adapter registers under — `"notifications"`                                                                            | `const`    |
| `notifyPlugin`                       | `Alpine.plugin()` factory — `(options?) => (alpine) => void`; also the package's `default` export                                    | `function` |
| `DEFAULT_NOTIFY_MAGIC_KEY`           | Default magic key — `"notify"`                                                                                                       | `string`   |
| `NotifyMagic`                        | The `$notify` surface, minus the plugin's `destroy()`                                                                                | `type`     |
| `NotifySendOptions`                  | `{ body?, icon?, badge?, tag?, renotify?, requireInteraction?, silent?, data? }` — passed straight to `Notification`                 | `type`     |
| `NotifyPermission`                   | `NotificationPermission` — `'granted' \| 'denied' \| 'default'`                                                                      | `type`     |
| `NotifyPluginOptions`                | `{ serviceWorkerUrl?, autoRegisterServiceWorker?, magicKey? }`                                                                       | `type`     |
| `NotifyPluginCallback`               | `(alpine: Alpine) => void` — the `Alpine.plugin()` callback signature                                                                | `type`     |
| `NotifyPermissionAdapter`            | The structural adapter contract this package implements — no dependency on `permissions`                                             | `type`     |
| `NotifyPermissionState`              | `'granted' \| 'prompt' \| 'denied' \| 'unknown'` — deliberately _not_ `NotificationPermission`: `'prompt'` stands in for `'default'` | `type`     |
| `NotifyPermissionAvailability`       | `'available' \| 'unsupported' \| 'insecure-context' \| 'policy-blocked' \| 'platform-restricted'`                                    | `type`     |
| `NotifyPermissionRequestResult`      | `{ permission, result?, error? }` — `error` carries the _reason_ a grant failed                                                      | `type`     |
| `NotifyAlpine`                       | Alias for the `Alpine` type the plugin callback receives                                                                             | `type`     |

`NotifyServiceWorkerRegistration`, `NotifyTeardown` and `NotifyMagicWithTeardown`
are declared in `src/types.ts` but **not re-exported from the barrel** — see
[Limitations](#limitations).

### Magic API — `$notify`

| Member                             | Returns                         | Behaviour                                                                                                                                                     |
| ---------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `isSupported`                      | `boolean`                       | `true` when `window.Notification` exists. Does **not** check secure context                                                                                   |
| `requiresHomeScreenInstall`        | `boolean`                       | `isSupported && isIosDevice() && !isStandaloneDisplayMode()`                                                                                                  |
| `permission`                       | `NotifyPermission`              | `'default'` when the API is absent                                                                                                                            |
| `requestPermission()`              | `Promise<NotifyPermission>`     | Resolves the browser's answer; resolves `'denied'` with no window, no `Notification`, or a throw. **Must be called from a user gesture**                      |
| `send(title, options?)`            | `Notification \| null`          | Synchronous `new Notification(...)`. `null` when unsupported, not yet granted, or the constructor threw. **Cannot reach a service worker**                    |
| `sendAsync(title, options?)`       | `Promise<Notification \| null>` | Requests permission first if it is still `'default'`, then routes through `showNotify()`. **The only send method that reaches a service worker**              |
| `sendIfPermitted(title, options?)` | `Notification \| null`          | `send()` without the permission request, and without the early `permission !== 'granted'` check being bypassable — it returns `null` when not already granted |
| `close(tag?)`                      | `void`                          | **A no-op.** See [Limitations](#limitations)                                                                                                                  |
| `destroy()`                        | `void`                          | Unregisters the service worker registration _this plugin_ created. Nothing calls it for you                                                                   |

The three state values are plain data fields on a reactive object, so a template
re-renders when they move. They are refreshed by `requestPermission()` resolving
and by the browser `focus` and `visibilitychange` events — the two moments a
user can change the permission from outside the page. Nothing polls.

### Options

```ts
interface NotifyPluginOptions {
  serviceWorkerUrl?: string; // default — no registration happens without it
  autoRegisterServiceWorker?: boolean; // default true; false skips registration of a URL you registered yourself
  magicKey?: string; // default DEFAULT_NOTIFY_MAGIC_KEY ("notify")
}
```

| Option                      | Default    | Effect                                                                                                                                      |
| --------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `serviceWorkerUrl`          | —          | Registered with `navigator.serviceWorker.register()` on plugin registration, best-effort and **not awaited** — Alpine boot is never blocked |
| `autoRegisterServiceWorker` | `true`     | Set `false` to use a service worker the host registered itself. Registration only happens when a URL is also given                          |
| `magicKey`                  | `"notify"` | The only name this package claims. There is no store to rename                                                                              |

### Avoiding name collisions

```ts
Alpine.plugin(notifyPlugin({ magicKey: "alerts" })); // → $alerts
```

`DEFAULT_NOTIFY_MAGIC_KEY` keeps the rename discoverable from TypeScript. The
claim goes through `guardMagic`, so a second plugin taking `"notify"` throws a
`RegistrationError` rather than silently overwriting it.

## Delivery routes

`new Notification(title, options)` is illegal on iOS — Safari throws _"Illegal
constructor. Use ServiceWorkerRegistration.showNotification() instead"_ — and
Chrome throws from it whenever the document is not fully active, which a
backgrounded Android tab usually is. So there are three routes, and the package
picks between them:

| Method              | Unsupported | Not granted             | Granted, desktop/Android | iOS                                             |
| ------------------- | ----------- | ----------------------- | ------------------------ | ----------------------------------------------- |
| `send()`            | `null`      | `null`                  | `new Notification()`     | `null` — the constructor throws                 |
| `sendIfPermitted()` | `null`      | `null`                  | `new Notification()`     | `null`                                          |
| `sendAsync()`       | `null`      | requests, then as above | `new Notification()`     | service worker, falling back to the constructor |

`showNotify()` is the underlying helper, exported for standalone use. It tries
the service worker first on iOS, the constructor everywhere else, and falls back
to the service worker when the constructor is unavailable or throws. It never
throws: a caller in the middle of _granting_ a permission must not have that
grant turned into a failure by a cosmetic side effect.

**A service-worker-shown notification resolves `null`.** That is not a failure —
`registration.showNotification()` returns `void` by spec, so there is no
`Notification` object to hand back. Distinguish "nothing was shown" from "shown,
no handle" with the return value of the _route_, not of the call.

## Permission adapter

`createNotifyPermissionAdapter()` returns the adapter a
`@ailura/alpinejs-permissions` registry consumes. The contract is declared
structurally here rather than imported, so this package never depends on
`permissions`:

```ts
import { createNotifyPermissionAdapter } from "@ailura/alpinejs-notify";
import { permissionsPlugin } from "@ailura/alpinejs-permissions";

Alpine.plugin(permissionsPlugin({ adapters: [createNotifyPermissionAdapter()] }));
```

| Member                | Returns                                                | Behaviour                                                   |
| --------------------- | ------------------------------------------------------ | ----------------------------------------------------------- |
| `name`                | `"notifications"`                                      | The registry key                                            |
| `requiresUserGesture` | `true`                                                 | The registry will not request outside a click               |
| `isSupported()`       | `boolean`                                              | `window.Notification` exists                                |
| `getAvailability()`   | `NotifyPermissionAvailability`                         | See below                                                   |
| `query()`             | `Promise<NotifyPermissionState>`                       | The live permission; `'denied'` when the API is absent      |
| `request()`           | `Promise<NotifyPermissionRequestResult<Notification>>` | Prompts, then best-effort shows a confirmation notification |

`getAvailability()` exists because a bare `"denied"` on an iPhone sends the user
to a settings screen with nothing to offer:

| Availability          | Meaning                                                        | `request()` returns                                      |
| --------------------- | -------------------------------------------------------------- | -------------------------------------------------------- |
| `unsupported`         | No `Notification` API                                          | `{ permission: 'denied', error }` — "not available…"     |
| `insecure-context`    | Not a secure context (`isSecureContext` is false)              | `{ permission: 'denied', error }` — serve over HTTPS     |
| `platform-restricted` | iOS, not installed — the permission is not obtainable yet      | `{ permission: 'denied', error }` — "add to Home Screen" |
| `available`           | Prompting can succeed                                          | `{ permission: 'granted', result }`                      |
| `policy-blocked`      | Declared in the union but **never returned** — see Limitations | —                                                        |

The `error` message is the remedy, not a restatement. A granted request shows one
confirmation notification; that is cosmetic, and it is never allowed to turn a
real grant into a reported denial.

## SSR

> SSR-safe — no `window`/`document` at import time. Every access goes through
> `safeWindow()` from `@ailura/alpinejs-core/env`.

With no window the package degrades rather than throws:

| Read                                | Server value        |
| ----------------------------------- | ------------------- |
| `$notify.isSupported`               | `false`             |
| `$notify.requiresHomeScreenInstall` | `false`             |
| `$notify.permission`                | `"default"`         |
| `requestPermission()`               | resolves `"denied"` |
| `send()` / `sendIfPermitted()`      | `null`              |
| `sendAsync()` / `showNotify()`      | resolves `null`     |
| `close()` / `destroy()`             | no-ops              |

Nothing is registered and nothing is emitted, so a server render costs one
`safeWindow()` per call. **Permission is client-only by nature** — resolve it in
`onMounted`/`x-init` or after hydration, never during SSR.

## Accessibility

> This is a `Primitives` package and ships **no ARIA and no key bindings.** It is
> a capability wrapper; whether an opt-in needs a confirmation, a role or a
> `aria-live` region is the host's decision.

The one thing the package owns that a host should not reinvent: it never
triggers a prompt on load. `requestPermission()` is called from a gesture, and
`sendAsync()` requests only if you call it — nothing is asked for implicitly.
Browser-generated notifications are the platform's own surface and carry their
own semantics.

## Integration

- **@ailura/alpinejs-permissions** — `createNotifyPermissionAdapter()` is one
  adapter in that registry. It is the surface to prefer over calling
  `$notify.requestPermission()` directly when other permissions are tracked too,
  because it is the one that can say _why_ a request failed.
- **@ailura/alpinejs-toast** — orthogonal. A toast tells the reader something in
  the page; a notification reaches them when the page is not in front. Pair them
  for "your build finished", not for "you clicked Save".

## Limitations

- **`close()` is a silent no-op.** It accepts a `tag`, ignores it, and closes
  nothing — the browser's simple `Notification` API offers no close by tag, and
  closing would need a service-worker registration this package does not own.
  `void tag;` in `src/controller.ts` is the whole implementation. Do not ship a
  "dismiss" affordance that calls it.
- **`send()` cannot deliver on iOS, ever.** It is synchronous, so it cannot await
  `navigator.serviceWorker.getRegistration()`. On iOS it returns `null` and the
  permission already granted. Use `sendAsync()`.
- **`isSupported` ignores secure context.** `window.Notification` exists in an
  insecure context; the request then fails. Gate on
  `createNotifyPermissionAdapter().getAvailability() !== 'insecure-context'` if
  you care, or check `window.isSecureContext` yourself.
- **`'policy-blocked'` is declared and never returned.** `NotifyPermissionAvailability`
  includes it so the registry's union stays open for enterprise-managed browsers,
  but nothing in this package detects one. `request()` on such a browser falls
  through to the "denied without giving a reason" message.
- **`destroy()` only releases what the plugin created, and cannot tell that
  apart from a host registration.** With a `serviceWorkerUrl` the application
  already registered, `register()` resolves with the _same_ registration, so
  `destroy()` unregisters that too. It is a page-teardown handle, not a
  "release my own" handle. Nothing calls it for you.
- **`NotifyMagicWithTeardown`, `NotifyTeardown` and
  `NotifyServiceWorkerRegistration` are not exported from the barrel.** They are
  declared in `src/types.ts` and used by `plugin.ts`, but `src/index.ts` re-exports
  neither, so a consumer cannot name the _actual_ type of `$notify` — only
  `NotifyMagic`, which omits `destroy()`.
- **`sendAsync()`'s implicit permission request will be rejected outside a user
  gesture.** Browsers only honour `requestPermission()` from a gesture in many
  contexts, and it resolves `'denied'`. This is why the adapter declares
  `requiresUserGesture: true`.
- **`isIosDevice()` matches `MacIntel` + `ontouchend` in `globalThis`.** On a
  server `globalThis` has no `ontouchend`, so the check is false — which is
  correct for `isSupported`-gated reads and irrelevant otherwise.
- **`pnpm run typecheck` fails in this package.** Two errors, both in `showNotify()`
  and both pre-existing:
  - `src/controller.ts:128` — `if (!win) return null;` returns a bare `null`
    where the declared return type is `Promise<Notification | null>`. The value is
    correct for an `async` function's caller (`await` folds it), but it does not
    type-check.
  - `src/controller.ts:146` — `if (constructed) return constructed;` returns a
    `Notification` where `Promise<Notification | null>` is declared. Same shape:
    correct at runtime, rejected by `tsc`.
    Both are one-word fixes (`return Promise.resolve(null)` / `return Promise.resolve(constructed)`),
    but this audit does not change executable code, so they are recorded here
    instead. `vp test` is green; only `tsc` complains.
- **There are no events.** No `change` fires when the permission changes; the
  magic refreshes on `focus`/`visibilitychange` and after `requestPermission()`.
  A standalone consumer polling in another tab sees stale state until the tab is
  focused.

## Size

`4.52 kB raw / 1.70 kB gzip` · budget `2.5 kB` · externalized peers: `alpinejs`, `@ailura/alpinejs-core` · `size-limit` + `publint` + `attw` verified.

The budget is measured against the gzipped output (`size-limit` runs with
`gzip: true`), so 1.70 kB sits inside the 2.5 kB limit with room to spare. Both
figures are shown rather than rounding away the raw size, which is the larger.

## Architecture

[Primitives layer](../../ARCHITECTURE.md) — controllers own state, Alpine owns reactivity. See canon, guards, and SSR rules in [ARCHITECTURE.md](../../ARCHITECTURE.md), and the deliberate exemption in [§9](../../ARCHITECTURE.md).

## Testing

```sh
pnpm test              # vp test (happy-dom)
pnpm run typecheck     # tsc --noEmit
```

## License

MIT
