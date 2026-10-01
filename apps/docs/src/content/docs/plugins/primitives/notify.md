---
title: Notify
---

@ailura/alpinejs-notify

A `$notify` magic for browser notifications, with the permission state handled for you
and a variant that stays quiet instead of throwing when the user has not allowed
notifications.

## Install

```sh
pnpm add alpinejs @ailura/alpinejs-notify
```

## Register the plugin

Do this once, before `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import notifyPlugin from "@ailura/alpinejs-notify";

Alpine.plugin(notifyPlugin());

Alpine.start();
```

That registers the `$notify` magic. There is no store.

## Minimal example

Ask for permission, then notify from a user gesture.

```html
<div x-data>
  <p>Permission: <span x-text="$notify.permission"></span></p>
  <p x-show="!$notify.isSupported">This browser cannot show notifications.</p>

  <button @click="$notify.requestPermission()">Allow notifications</button>
  <button
    @click="$notify.send('Build finished', { body: 'Your bundle is ready.' })"
    :disabled="$notify.permission !== 'granted'"
  >
    Notify me
  </button>
</div>
```

The method is `send(title, options?)` — the title is the first argument, not a `title`
property. Every variant of `send` takes it that way, and each returns the created
`Notification` or `null`.

## Choosing between `send` and `sendIfPermitted`

This is the decision that matters, and it is the reason to use this package at all.

- `send()` shows the notification. If permission was never granted, it does nothing
  and the user is never told why.
- `sendIfPermitted()` does the same thing but only when the permission is already
  `granted`, so you can fall back when it returns `null`.

For an event the user explicitly asked to be told about — "notify me when the deploy
finishes" — use `sendIfPermitted()` and handle the `null` by showing your own
in-app message.

```js
$notify.sendIfPermitted("Deployed", { body: "The build is live." });
```

**Return a promise when you need to know the outcome.** `sendAsync(title, options?)` is
the only variant that asks for permission when the state is still `default`; it resolves to
the `Notification`, or to `null` if the user declined or the browser refused.

```js
await $notify.sendAsync("Copied");
```

**Dismissing is not wired up.** `close(tag?)` exists for API symmetry, but the simple
`Notification` API has no way to take one back, so today it is a no-op. Do not build a
dismiss button on it.

```js
$notify.close(tag);
```

:::caution[Requesting permission needs a user gesture]
`requestPermission()` only works from a click or a keypress. Calling it during page
load, or from inside a promise chain, is rejected by the browser and the permission
stays `default` — so the buttons stay disabled forever.
:::

## API reference

| Name                                       | Type     | Purpose                                                                                                                                                                                            |
| ------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `$notify.isSupported`                      | getter   | Whether the Notification API is available.                                                                                                                                                         |
| `$notify.permission`                       | getter   | `granted`, `denied`, or `default`.                                                                                                                                                                 |
| `$notify.requiresHomeScreenInstall`        | getter   | Whether this browser needs the app installed for notifications.                                                                                                                                    |
| `$notify.requestPermission()`              | `method` | Ask the user. Must be called from a user gesture. Resolves to the new permission.                                                                                                                  |
| `$notify.send(title, options?)`            | `method` | Show a notification. Returns the `Notification`, or `null`.                                                                                                                                        |
| `$notify.sendAsync(title, options?)`       | `method` | Ask for permission if still `default`, then show one. Resolves to the `Notification`, or `null`.                                                                                                   |
| `$notify.sendIfPermitted(title, options?)` | `method` | Show only if already `granted`. Returns the `Notification`, or `null`.                                                                                                                             |
| `$notify.close(tag?)`                      | `method` | Present for symmetry; a no-op with the plain `Notification` API.                                                                                                                                   |
| `$notify.destroy()`                        | `method` | Host-owned teardown: unregisters the service worker registration this plugin created, and only that one — never a blanket sweep of the host application's registrations. Nothing calls it for you. |

## Plugin options

```ts
notifyPlugin({ magicKey: "notifyUser" });
```
