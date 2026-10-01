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

## API reference

| Name                                         | Type   | Purpose                                                                                                                      |
| -------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `$store.permissions.registry`                | store  | Reactive record of every registered permission, by name.                                                                     |
| `$store.permissions.get(name)`               | method | The last known snapshot for one permission, with no browser round-trip.                                                      |
| `$store.permissions.query(name)`             | method | Ask the browser for the current state.                                                                                       |
| `$store.permissions.refresh(name)`           | method | Re-query one permission — the same call as `query()`.                                                                        |
| `$store.permissions.request(name, options?)` | method | Prompt the user. Call from a user gesture. `options` is handed to the adapter.                                               |
| `$store.permissions.watch(name)`             | method | Keep the state in sync; resolves to a function that stops watching.                                                          |
| `$store.permissions.register(adapter)`       | method | Declare a permission and how to ask for it. Returns an unregister function.                                                  |
| `$store.permissions.destroy()`               | method | Host-owned teardown: unsubscribes every permission subscription and drops the registered adapters. Nothing calls it for you. |

Each registered permission reports `permission` (`granted`, `prompt`, `denied` or
`unknown`), `availability`, `requestState`, `canRequest`, `requiresUserGesture`, `error`,
and `result`.

:::caution[`request()` outside a user gesture fails as a permission error]
The browser refuses the prompt, and what comes back looks like the user said no. A
button that calls it from a `mounted` hook will appear permanently denied, and the
diagnostic that helps is `error` on the snapshot — `requiresUserGesture` is reported as
`true` on every permission, so it tells you nothing about a specific one.
:::

## Plugin options

```ts
permissionsPlugin({ storeKey: "perms", magicKey: "can", adapters: [cameraAdapter] });
```
