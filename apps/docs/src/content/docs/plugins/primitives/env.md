---
title: Env
---

@ailura/alpinejs-env

One reactive magic for the browser environment: `$env`. It projects network, visibility,
battery, and platform as a single aggregate view, and it re-renders when the browser
changes. No store, no registration, no lifecycle. It is a projection over browser APIs,
and it updates itself.

## Install

```sh
pnpm add alpinejs @ailura/alpinejs-env
```

## Register the plugin

Do this once, before `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import envPlugin from "@ailura/alpinejs-env";

Alpine.plugin(envPlugin());

Alpine.start();
```

That registers one magic. There is nothing else to do — no `register()`, no ids.

## Minimal example

Read it straight in markup.

```html
<div x-data>
  <p x-show="!$env.network.online">You are offline. Changes will sync when you reconnect.</p>
  <p x-show="!$env.visibility.visible">Tab hidden — pausing uploads.</p>
  <p>Platform: <span x-text="$env.platform.platform"></span></p>
  <p>
    Battery:
    <span x-text="$env.battery ? Math.round($env.battery.level * 100) + '%' : 'unavailable'"></span>
  </p>
</div>
```

Nothing is polled by you: `$env.network.online` flips on the browser's own `online` and
`offline` events, `$env.visibility.visible` on the visibility change. The view is reactive,
so a real event re-renders the bindings that read it.

## `$env.battery` is the odd one out

The Battery Status API is not available everywhere: Firefox and Safari do not implement
it, and Chrome removed it from the desktop origin. So `$env.battery` is `null` on those
browsers rather than an object with a level — the same shape it has when you turn the
domain off with `envPlugin({ battery: false })`.

That null is why the example guards it. Bind to `$env.battery?.level` and you get a crash
in production on exactly the browsers you did not test.

```html
<span x-text="$env.battery?.level ?? null"></span>
```

## API reference

Every domain exposes read-only state plus a `supported` flag telling you whether the
plugin tracks it. The only method is `$env.destroy()`, the host-owned teardown.

| Name                        | Type                 | Purpose                                                                                                                             |
| --------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `$env.network`              | property (read-only) | Connection state: `online`, and `effectiveType`, `saveData`, `downlink`, `rtt` when the browser exposes them.                       |
| `$env.network.supported`    | property (read-only) | Whether the network domain is tracked.                                                                                              |
| `$env.visibility`           | property (read-only) | `visible`, `hidden`, and the raw `state` string.                                                                                    |
| `$env.visibility.supported` | property (read-only) | Whether the visibility domain is tracked.                                                                                           |
| `$env.battery`              | property (read-only) | A plain snapshot — `charging`, `level`, `chargingTime`, `dischargingTime` — or `null` where the API is absent or the domain is off. |
| `$env.platform`             | property (read-only) | The navigator platform state, including the `isIos` / `isAndroid` / `isMobile` / `isMac` / `isWindows` flags.                       |
| `$env.platform.supported`   | property (read-only) | Whether the platform domain is tracked.                                                                                             |
| `$env.destroy()`            | method               | Host-owned teardown: removes the `window` online/offline and `document` visibilitychange listeners. Nothing calls it for you.       |

## Plugin options

```ts
envPlugin({ envKey: "environment", battery: false });
```

| Option       | Type      | Default | Purpose                             |
| ------------ | --------- | ------- | ----------------------------------- |
| `envKey`     | `string`  | `"env"` | The magic name.                     |
| `id`         | `string`  | auto    | The controller id, for diagnostics. |
| `network`    | `boolean` | `true`  | Track the network domain.           |
| `visibility` | `boolean` | `true`  | Track the visibility domain.        |
| `battery`    | `boolean` | `true`  | Track the battery domain.           |
| `platform`   | `boolean` | `true`  | Track the platform domain.          |

Turning a domain off never removes it from the view: the aggregate stays complete, the
domain reports `supported: false` (or `null` for battery), and it stops re-rendering.

:::note[`$env.platform.platform` is a string, not a boolean]
`$env.platform.platform` gives you the raw `navigator.platform` value. Feature detection
through this magic tells you what the browser claims to be, not what it can do; for
capability checks prefer testing the API you actually need.
:::
