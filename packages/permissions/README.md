# @ailura/alpinejs-permissions

<p align="center">

[![bundlephobia minzip](https://badgen.net/bundlephobia/minzip/@ailura/alpinejs-permissions)](https://bundlephobia.com/package/@ailura/alpinejs-permissions)

</p>

> A browser permission **registry**, not a permission API. Adapters — shipped by the packages that own each capability — report what is available, what was granted, and _why_ a request cannot succeed, and this package tracks them all in one reactive store.

## Installation

```sh
pnpm add @ailura/alpinejs-permissions alpinejs
# or
npm install @ailura/alpinejs-permissions alpinejs
```

Requires `alpinejs@^3.0.0` as peer. `@ailura/alpinejs-core` is a **peer
dependency**, not a dependency: no package in this toolkit has a
`dependencies` block, so the host installs it too.

This package knows how to _track_ a permission. It never obtains one: the
adapters that do that come from the capability packages, and none of them depends
on this one. Install the capability you actually want —
[`@ailura/alpinejs-notify`](https://www.npmjs.com/package/@ailura/alpinejs-notify),
[`@ailura/alpinejs-geo`](https://www.npmjs.com/package/@ailura/alpinejs-geo),
[`@ailura/alpinejs-attention`](https://www.npmjs.com/package/@ailura/alpinejs-attention)
— and hand their adapters here.

## Usage

### 1. Standalone (framework-agnostic)

```ts
import { createPermissionsController, type PermissionAdapter } from "@ailura/alpinejs-permissions";

const registry = createPermissionsController();

const unregister = registry.register({
  name: "geolocation",
  isSupported: () => "geolocation" in navigator,
  getAvailability: () => (window.isSecureContext ? "available" : "insecure-context"),
  query: async () => "prompt",
  request: async () => ({ permission: "granted" }),
});

registry.get("geolocation"); // snapshot, or undefined
await registry.query("geolocation"); // asks the adapter, no prompt
await registry.request("geolocation"); // may prompt — call it from a click
const stop = await registry.watch("geolocation"); // only if the adapter implements `subscribe`
registry.getRegistry(); // { geolocation: snapshot }
registry.on("change", ({ name, snapshot }) => console.log(name, snapshot.permission));
unregister(); // or registry.unregister("geolocation")
registry.destroy(); // releases every subscription `watch()` opened
```

### 2. Alpine

```ts
import Alpine from "alpinejs";
import permissionsPlugin from "@ailura/alpinejs-permissions";
import { createGeolocationPermissionAdapter } from "@ailura/alpinejs-geo";
import { createNotifyPermissionAdapter } from "@ailura/alpinejs-notify";

Alpine.plugin(
  permissionsPlugin({
    adapters: [createNotifyPermissionAdapter(), createGeolocationPermissionAdapter()],
  })
);
Alpine.start();
```

```html
<div x-data>
  <template x-for="name in Object.keys($store.permissions.registry)" :key="name">
    <div>
      <strong x-text="name"></strong>
      <span x-text="$store.permissions.registry[name].permission"></span>
      <span
        x-show="$store.permissions.registry[name].availability === 'platform-restricted'"
        x-cloak
      >
        <span x-text="$store.permissions.registry[name].error?.message"></span>
      </span>
      <button type="button" @click="await $permissions.query(name)">Check</button>
      <button
        type="button"
        x-show="$store.permissions.registry[name].canRequest"
        x-cloak
        @click="await $permissions.request(name)"
      >
        Allow
      </button>
    </div>
  </template>
</div>
```

The plugin registers `$store.permissions` and the magic `$permissions` — the
magic _is_ the store.

## The adapter contract

An adapter is a plain object. Implementing one is the whole extension story.

```ts
interface PermissionAdapter<TName extends string = string, TResult = unknown, TOptions = unknown> {
  readonly name: TName; // the registry key
  readonly requiresUserGesture?: boolean;
  isSupported(): boolean; // does the browser have the API at all
  getAvailability(): PermissionAvailability; // can it be granted *right now*
  query(): Promise<PermissionState>; // current state, must not prompt
  request(options?: TOptions): Promise<PermissionRequestResult<TResult>>;
  subscribe?(listener: PermissionListener<TResult>): Promise<() => void> | (() => void);
}
```

| Member                | Required | Contract                                                                                                                                    |
| --------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`                | yes      | The registry key. Registering it twice throws.                                                                                              |
| `isSupported()`       | yes      | Whether the API exists. Cheap, synchronous, called at register time via `getAvailability()`.                                                |
| `getAvailability()`   | yes      | Why a request can or cannot succeed **now**. Read at `register()` time to seed the snapshot, and re-read on every `query()` — never cached. |
| `query()`             | yes      | Current state, **without prompting**. Use `navigator.permissions.query()`; report `"prompt"` when it is unavailable.                        |
| `request(options?)`   | yes      | Obtains the permission. Pass `options` straight through from `request(name, options)`.                                                      |
| `subscribe(listener)` | no       | Push updates. When absent, `watch()` resolves an inert disposer instead of throwing.                                                        |
| `requiresUserGesture` | no       | Declared, but the registry does not read it — see Limitations.                                                                              |

`PermissionAvailability` is `"available" | "unsupported" | "insecure-context" |
"policy-blocked" | "platform-restricted"`, and the last two exist for a reason: on iOS a
notification request fails because the site is not installed to the Home Screen,
and telling that user to look in browser settings sends them nowhere. An
adapter that can only say `"denied"` is not meeting the contract.

`PermissionState` is `"granted" | "prompt" | "denied" | "unknown"`. `prompt`
doubles as _"nobody has asked yet"_ — the honest answer for a capability nobody
has requested, and what a browser without the Permissions API reports.

### Adapters that already exist

| Package                                                                                  | Factory                                | Permission name    |
| ---------------------------------------------------------------------------------------- | -------------------------------------- | ------------------ |
| [`@ailura/alpinejs-notify`](https://www.npmjs.com/package/@ailura/alpinejs-notify)       | `createNotifyPermissionAdapter()`      | `notifications`    |
| [`@ailura/alpinejs-geo`](https://www.npmjs.com/package/@ailura/alpinejs-geo)             | `createGeolocationPermissionAdapter()` | `geolocation`      |
| [`@ailura/alpinejs-attention`](https://www.npmjs.com/package/@ailura/alpinejs-attention) | `createWakeLockPermissionAdapter()`    | `screen-wake-lock` |

Each ships its own `*PermissionAdapter` _type_ as well as the factory, and each
has a conformance test asserting its shape is assignable to `PermissionAdapter` —
so the two sides cannot drift, without a single capability package taking a
dependency on this one. `geo` and `notify` also export their `*_PERMISSION_NAME`
constant.

## API

| Export                          | Description                                                                                                                                                       | Type             |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| `PermissionsController`         | Controller class — `register`, `unregister`, `get`, `can`, `when`, `all`, `any`, `getRegistry`, `query`, `request`, `refresh`, `watch`, `destroy`; emits `change` | `class`          |
| `createPermissionsController`   | `createPermissionsController() => PermissionsController` — takes no options                                                                                       | `function`       |
| `permissionsPlugin`             | Alpine plugin factory — `permissionsPlugin(options?) => AlpineCallback`; registers `$store.permissions` and `$permissions`                                        | `function`       |
| `DEFAULT_PERMISSIONS_STORE_KEY` | Default `$store` key — `"permissions"`                                                                                                                            | `string` (const) |
| `DEFAULT_PERMISSIONS_MAGIC_KEY` | Default magic key — `"permissions"`                                                                                                                               | `string` (const) |
| `PermissionAdapter`             | The adapter contract every capability package implements — see above                                                                                              | `type`           |
| `PermissionSnapshot`            | One tracked permission — `{ permission, availability, requestState, canRequest, requiresUserGesture, error, result }`                                             | `type`           |
| `PermissionRequestResult`       | What an adapter's `request()` returns — `{ permission, result?, error? }`                                                                                         | `type`           |
| `PermissionState`               | `"granted" \| "prompt" \| "denied" \| "unknown"`                                                                                                                  | `type`           |
| `NormalizedPermissionState`     | Deprecated alias of `PermissionState`                                                                                                                             | `type`           |
| `PermissionAvailability`        | `"available" \| "unsupported" \| "insecure-context" \| "policy-blocked" \| "platform-restricted"`                                                                 | `type`           |
| `PermissionRequestState`        | `"idle" \| "requesting" \| "succeeded" \| "failed"` — the lifecycle of one `request()`                                                                            | `type`           |
| `PermissionListener`            | `(snapshot) => void` — the `subscribe` callback                                                                                                                   | `type`           |
| `PermissionWhenHandlers`        | `Partial<Record<PermissionState, () => void>>` — the handler map `when()` dispatches on                                                                           | `type`           |
| `PermissionName`                | `string` — the registry key                                                                                                                                       | `type`           |
| `PermissionRegistry`            | `Readonly<Record<string, PermissionSnapshot>>`                                                                                                                    | `type`           |
| `PermissionsStore`              | The Alpine-facing surface: `PermissionsMagic` plus `register(adapter)`                                                                                            | `type`           |
| `PermissionsMagic`              | `{ registry, get, can, when, all, any, query, request, refresh, watch, unregister, destroy }` — what `$permissions` exposes                                       | `type`           |
| `PermissionsPluginOptions`      | `{ adapters?, storeKey?, magicKey? }`                                                                                                                             | `type`           |
| `PermissionOptions`             | Legacy alias of `PermissionsPluginOptions`; the two interfaces are identical                                                                                      | `type`           |
| `PermissionsEvents`             | `{ change: [{ name, snapshot }] }` — `snapshot` is `null` when the named permission was unregistered                                                              | `type`           |
| `PermissionsAlpine`             | `Alpine & { store(name): unknown }` — the narrowed Alpine shape the plugin registers against                                                                      | `type`           |
| `PermissionsPluginCallback`     | `(alpine: Alpine) => void`                                                                                                                                        | `type`           |

### Store API

```ts
$store.permissions.registry; // { geolocation: PermissionSnapshot, … } — the reactive view
$store.permissions.get("geolocation"); // the current snapshot, or undefined — never reactive
$store.permissions.can("geolocation"); // → true only if currently granted
$store.permissions.all(["geolocation", "camera"]); // → true if every one is granted
$store.permissions.any(["geolocation", "camera"]); // → true if at least one is
$store.permissions.when("geolocation", { granted: () => …, denied: () => … });
$store.permissions.query("geolocation"); // → Promise<PermissionSnapshot>, no prompt
$store.permissions.request("geolocation"); // → Promise<PermissionSnapshot>, may prompt
$store.permissions.refresh("geolocation"); // alias of query()
$store.permissions.watch("geolocation"); // → Promise<() => void>
$store.permissions.register(myAdapter); // → unregister disposer
$store.permissions.unregister("geolocation"); // → true if it existed; drops the key reactively
$store.permissions.destroy(); // host-owned teardown
```

| Method                    | Returns                           | Behaviour                                                                                                                                                                                                                                                   |
| ------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get(name)`               | `PermissionSnapshot \| undefined` | The last known snapshot. Synchronous and **not** reactive — bind to `registry[name]` in a template.                                                                                                                                                         |
| `can(name)`               | `boolean`                         | Is this permission **granted** right now. Never means `canRequest`: a permission nobody queried yet is `unknown` and therefore `false`, as is an unavailable or unregistered one. Not reactive — like `get`, it reads the controller.                       |
| `when(name, handlers)`    | `void`                            | Runs only the handler matching the current state, then returns — not reactive, not a watcher. An unregistered name has no state to dispatch on, so it runs nothing rather than reporting `unknown`.                                                         |
| `all(names)`              | `boolean`                         | `true` only when every named permission is granted; `all([])` is `true`. Unknown names count as not granted.                                                                                                                                                |
| `any(names)`              | `boolean`                         | `true` when at least one named permission is granted; `any([])` is `false`. Unknown names count as not granted.                                                                                                                                             |
| `query(name)`             | `Promise<PermissionSnapshot>`     | Asks the adapter for the current state. If `getAvailability()` is not `"available"`, resolves to `permission: "denied"`, `requestState: "failed"` and an `error` naming the availability — it never throws.                                                 |
| `request(name, options?)` | `Promise<PermissionSnapshot>`     | Publishes a `requesting` snapshot, then calls the adapter. Resolves to the adapter's own `permission` with `requestState: "succeeded"`; a rejected adapter resolves to `denied` + `"failed"` + `error`. Unknown name **throws**.                            |
| `refresh(name)`           | `Promise<PermissionSnapshot>`     | Exact alias of `query()`.                                                                                                                                                                                                                                   |
| `watch(name)`             | `Promise<() => void>`             | Subscribes the adapter's `subscribe` listener to `change` events. Resolves an **inert** disposer when the adapter has no `subscribe`. Unknown name throws; after `destroy()` it resolves an inert disposer rather than leaking.                             |
| `register(adapter)`       | `() => void`                      | Adds an adapter and returns its unregister disposer. Throws on a duplicate name, and on any call after `destroy()`.                                                                                                                                         |
| `unregister(name)`        | `boolean`                         | Drops the adapter and its snapshot. Returns whether anything was removed, so a double unregister is detectable. Announces the removal on `change`, which is what removes the key from `registry` immediately. The disposer `register()` returns calls this. |
| `destroy()`               | `void`                            | Releases every `watch()` subscription and drops the adapters. **Nothing calls it for you** — the host that registered the plugin does.                                                                                                                      |

### `can` is not `canRequest`

The two answer different questions, and conflating them is the easy mistake:

```ts
$permissions.can("geolocation"); // do I have it?
$permissions.registry.geolocation?.canRequest; // may I ask for it?
```

A permission nobody has queried yet is `can: false` and `canRequest: true`, which
is exactly right: the affordance should still be offered, and the feature it
guards should still be hidden.

### `when` and the four states

`when()` dispatches on the state name itself, so all four `PermissionState`
members are handlers and there is no mapping table to learn:

```ts
$permissions.when("camera", {
  granted: () => startPreview(),
  denied: () => showWhyNot(),
  prompt: () => showConsentHint(),
  unknown: () => showAskButton(), // registered, nobody has asked the browser yet
});
```

Only the handler for the current state runs; the rest are never touched, and an
omitted key simply does nothing. A permission that is **not registered** is not
in a state at all, so it runs nothing — it is not reported as `unknown`.

Like `get()` and `can()`, `when()` reads the state as it stands and returns. It
is not reactive: use `registry[name]` in a template and `watch()` when you need
to be told about a change.

### Options

```ts
type PermissionsPluginOptions = {
  adapters?: readonly PermissionAdapter[]; // registered before the first change event
  storeKey?: string; // $store key — default: "permissions"
  magicKey?: string; // $magic key — default: magicKey ?? storeKey
};
```

Adapters passed here are registered synchronously, and the store's `registry` is
seeded with their initial snapshots immediately — so `$store.permissions.registry`
is never empty for them, even though no `change` event has fired. That initial
snapshot is `{ permission: "unknown", requestState: "idle", canRequest: <availability === "available">, error: null }`:
no browser prompt runs until you call `request()`.

`requiresUserGesture` on that snapshot comes from the adapter —
`adapter.requiresUserGesture ?? true` — so a capability that needs no click says
so, and every later snapshot keeps the value it was registered with.

### Avoiding name collisions

```ts
Alpine.plugin(permissionsPlugin({ storeKey: "perms", magicKey: "perms" }));
// → $store.perms and $perms
```

`DEFAULT_PERMISSIONS_STORE_KEY` / `DEFAULT_PERMISSIONS_MAGIC_KEY` keep the default
discoverable from TypeScript.

## Events

```ts
import type { PermissionSnapshot } from "@ailura/alpinejs-permissions";

registry.on(
  "change",
  ({ name, snapshot }: { name: string; snapshot: PermissionSnapshot | null }) => {
    if (!snapshot) return; // unregistered — the permission is gone
    snapshot.requestState; // "idle" | "requesting" | "succeeded" | "failed"
  }
);
```

`change` fires on every `query()`, every `request()` step (including the
`requesting` one), every `subscribe` push, and every `unregister()`. The plugin
copies the whole registry into the store on each event, which is what makes
`registry[name]` reactive in a template.

A removal carries `snapshot: null`: there is no state left to publish, and a
listener that read the stale snapshot would act on a permission that no longer
exists.

## SSR

> Import-safe and inert on the server: no `window`/`document`/`navigator` is
> touched at import time, and the registry holds nothing but adapters. Every
> snapshot starts as `unknown` / `availability: "unsupported"` until an adapter
> that _can_ see the browser reports otherwise, so server-rendered markup can
> render a "check permission" affordance and let the client fill it in.

## Integration

- **@ailura/alpinejs-notify** — `createNotifyPermissionAdapter()`, including the
  iOS Home Screen detection that decides between `denied` and
  `platform-restricted`.
- **@ailura/alpinejs-geo** — `createGeolocationPermissionAdapter()`; secure-context
  aware, and it keeps the browser's own error code in `error.message`.
- **@ailura/alpinejs-attention** — `createWakeLockPermissionAdapter()`.

## Limitations

- **One test file** (`test/registry-projection.test.ts`) covers registration,
  duplicates, `query`/`request` outcomes, `watch` disposal and the reactive
  `registry` projection. The three shipped adapters are conformance-tested in
  their own packages, not here.
- **`watch()` is inert with the three shipped adapters.** None of
  `createNotifyPermissionAdapter`, `createGeolocationPermissionAdapter` or
  `createWakeLockPermissionAdapter` implements `subscribe`, so `watch()` resolves
  a disposer that releases nothing. It only does something for an adapter you
  write yourself.
- **`register()` does not announce itself.** An adapter added through
  `$store.permissions.register()` reaches the controller — `get(name)` sees it
  at once — but only lands in the reactive `registry` when the next `change`
  event runs the projection. `unregister()` announces itself, so its key is
  gone immediately. Changing this would alter `register()`'s documented
  behaviour, so it is left for a later version.
- **`get()` is not reactive.** It reads the controller, so a template must bind
  to `registry[name]`.
- **`can()` / `when()` / `all()` / `any()` are not reactive.** They read the
  controller's current state, exactly like `get()`. A template that needs to
  re-evaluate on every change binds to `registry[name]`, and `when()` is not a
  watcher — it runs once per call.
- **`watch()` on a destroyed controller resolves an inert disposer** instead of
  throwing — deliberate, so a late caller cannot leak a subscription, but it also
  will not tell you it did nothing.

## Size

`3.70 kB raw / 1.40 kB gzip / 1.27 kB brotli` · budget `1.5 kB` · externalized
peers: `alpinejs`, `@ailura/alpinejs-core` · `size-limit` + `publint` + `attw`
verified.

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
