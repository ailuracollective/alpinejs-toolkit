---
title: Permissions
---

@ailura/alpinejs-permissions

A registry for browser permissions — geolocation, notifications, camera, microphone —
behind adapter functions, so you ask once and read the state everywhere.

## Install

```sh
pnpm add alpinejs @ailura/alpinejs-permissions
```

## Register the plugin

Do this once, before `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import permissionsPlugin from "@ailura/alpinejs-permissions";

Alpine.plugin(permissionsPlugin());

Alpine.start();
```

That registers a `permissions` store, so everything below is reachable at
`$store.permissions`. The same object is also handed out by the `$permissions` magic.

## Minimal example

Register a permission, query it, and request it from a click.

```html
<div x-data>
  <p>
    Notifications:
    <span x-text="$store.permissions.registry.notifications?.permission ?? 'unknown'"></span>
  </p>

  <button
    @click="$store.permissions.request('notifications')"
    :disabled="!$store.permissions.registry.notifications?.canRequest"
  >
    Allow notifications
  </button>
</div>
```

Bind through `registry`, which is a reactive record of every registered permission.
`get(name)` returns the same snapshot object for a one-off read, but it does not go
through the reactive record, so a template that binds to it will not re-render on
change. Calling `query()` on every render instead means asking the browser on every
render, which is slower and can prompt again.

## Register what you need up front

`register()` takes one adapter object — the name is a property on it, not a separate
argument — and returns a function that unregisters it again. The store can tell you
whether a request is even possible before you offer the button.

```js
const unregister = $store.permissions.register({
  name: "camera",
  isSupported: () => "mediaDevices" in navigator,
  getAvailability: () => "available",
  query: async () => (await navigator.permissions.query({ name: "camera" })).state,
  request: async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    return { permission: "granted", result: stream };
  },
});
```

Adapters can be passed to the plugin instead, which is where most applications put
them: `permissionsPlugin({ adapters: [cameraAdapter] })`. Registering the same name
twice throws, so pick one of the two.

Both routes can also be undone by name. `unregister(name)` drops the adapter and removes
its key from `registry` straight away, and it returns whether anything was removed, so
a double unregister is detectable:

```js
$store.permissions.unregister("camera"); // true, and registry.camera is gone
```

## Watch for revocation

A user can revoke a permission from the browser UI while your page is open. `watch()`
keeps the store in sync instead of leaving you showing a stale "allowed". It resolves to
the function that stops watching — there is no `unwatch()` on the store.

```js
const stop = await $store.permissions.watch("camera");
```

Call `stop()` when the component goes away, or the listener outlives it. Adapters only
subscribe if they implement `subscribe()`; one that does not hands you an inert function
that releases nothing.

## Ask without reading the snapshot

Four convenience reads sit over the state the registry already tracks. None of them is
a new permission model, and none of them is reactive — they read the controller, the
same way `get()` does. Call them from an event handler; keep `registry[name]` for
anything a template binds to.

```js
$permissions.can("camera"); // true only when granted — never "may I ask"
$permissions.all(["camera", "microphone"]); // true only if every one is granted
$permissions.any(["camera", "microphone"]); // true if at least one is
$permissions.when("camera", {
  granted: () => startPreview(),
  denied: () => showWhyNot(),
  prompt: () => showConsentHint(),
  unknown: () => showAskButton(),
});
```

`can()` answers "do I have it"; `canRequest` answers "may I ask". They disagree exactly
when a permission is requestable but not yet granted, and that pair is the useful one:
offer the affordance, keep the feature behind it hidden.

`when()` dispatches on the `PermissionState` names themselves, so every state is a
handler and there is no mapping to learn — only the matching handler runs. A name that
is not registered has no state at all, so nothing runs; it is not reported as `unknown`.

`all([])` is `true` and `any([])` is `false`, and a name that is not registered counts
as not granted, so a typo can never open a gate.

## API reference

| Name                                         | Type   | Purpose                                                                                                                      |
| -------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `$store.permissions.registry`                | store  | Reactive record of every registered permission, by name.                                                                     |
| `$store.permissions.get(name)`               | method | The last known snapshot for one permission, with no browser round-trip.                                                      |
| `$store.permissions.can(name)`               | method | Is this permission granted right now. Never `canRequest`. Not reactive.                                                      |
| `$store.permissions.when(name, handlers)`    | method | Runs only the handler matching the current state. Not reactive.                                                              |
| `$store.permissions.all(names)`              | method | `true` only when every named permission is granted; `all([])` is `true`.                                                     |
| `$store.permissions.any(names)`              | method | `true` when at least one named permission is granted; `any([])` is `false`.                                                  |
| `$store.permissions.query(name)`             | method | Ask the browser for the current state.                                                                                       |
| `$store.permissions.refresh(name)`           | method | Re-query one permission — the same call as `query()`.                                                                        |
| `$store.permissions.request(name, options?)` | method | Prompt the user. Call from a user gesture. `options` is handed to the adapter.                                               |
| `$store.permissions.watch(name)`             | method | Keep the state in sync; resolves to a function that stops watching.                                                          |
| `$store.permissions.register(adapter)`       | method | Declare a permission and how to ask for it. Returns an unregister function.                                                  |
| `$store.permissions.unregister(name)`        | method | Drop an adapter and its key. Returns whether anything was removed.                                                           |
| `$store.permissions.destroy()`               | method | Host-owned teardown: unsubscribes every permission subscription and drops the registered adapters. Nothing calls it for you. |

Each registered permission reports `permission` (`granted`, `prompt`, `denied` or
`unknown`), `availability`, `requestState`, `canRequest`, `requiresUserGesture`, `error`,
and `result`.

`requestState` is the lifecycle of one `request()`: `idle` → `requesting` → `succeeded`
or `failed`. A successful request leaves it at `succeeded` until the next `query()` or
`request()` moves it on.

:::caution[`request()` outside a user gesture fails as a permission error]
The browser refuses the prompt, and what comes back looks like the user said no. A
button that calls it from a `mounted` hook will appear permanently denied, and the
diagnostic that helps is `error` on the snapshot. `requiresUserGesture` comes from the
adapter — `adapter.requiresUserGesture ?? true` — so it can be `false` for a capability
that needs no click. Read it rather than assuming it is always `true`.
:::

:::caution[`register()` does not announce itself]
An adapter added through `register()` is readable from `get(name)` immediately, but it
only appears in the reactive `registry` when the next `change` event runs the
projection. `unregister()` announces itself, so its key disappears at once. Until the
two halves match, drive one `query()` if you need a just-registered adapter to show up
reactively.
:::

## Plugin options

```ts
permissionsPlugin({ storeKey: "perms", magicKey: "perm", adapters: [cameraAdapter] });
```
