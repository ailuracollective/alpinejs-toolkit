---
title: Core
---

@ailura/alpinejs-core

The shared infrastructure every other package builds on: a base controller with a
lifecycle, a collision-guarded registration API, SSR-safe environment access, and
monotonic ids.

Core is **not** an Alpine plugin. There is no `Alpine.plugin(corePlugin())` and no
store. It is imported directly, usually by subpath so you only pay for what you use.

## Install

```sh
pnpm add alpinejs @ailura/alpinejs-core
```

## The base controller

Extend `BaseController` and you get a typed event emitter, a LIFO cleanup stack, and a
lifecycle that starts in `idle` and ends in `destroyed`.

```ts
import { BaseController } from "@ailura/alpinejs-core/controller";
import { generateId } from "@ailura/alpinejs-core/ids";

export class CounterController extends BaseController<{ change: [number] }> {
  readonly id = generateId("counter");
  #count = 0;

  get count() {
    return this.#count;
  }

  increment(): void {
    this.#count++;
    this.emit("change", this.#count);
  }

  // Runs once, on mount(). Every teardown step goes through onCleanup(),
  // so destroy() can reverse them in LIFO order.
  protected setup(): void {
    this.onCleanup(() => {
      /* undo whatever setup() wired */
    });
  }
}
```

`mount()` is idempotent and only runs once from `idle`. `destroy()` is idempotent too,
and final: the controller will not mount again.

The hooks are `setup()` and `teardown()`, both protected and both no-ops by default.
`destroy()` drains the cleanup stack first, then calls `teardown()`. `onCleanup()` is
the only way to register a step — the stack itself is not yours to dispose by hand, and
`on(event, listener)` registers its unsubscribe for you.

## Collision guards

`guardStore`, `guardMagic`, and `guardDirective` are how a package claims a name. If
another package already owns it, registration throws a `RegistrationError` instead of
silently overwriting it.

```ts
import { guardStore, guardMagic } from "@ailura/alpinejs-core/guards";

const packageName = "@ailura/alpinejs-accordion";

guardStore(alpine, "accordion", store, packageName);
guardMagic(alpine, "accordion", () => alpine.store("accordion"), packageName);
```

The `packageName` is a literal, not a computed string, so the guard can name the owner in
the error.

**Taking a name over on purpose** is possible and should be rare. `override: true` does
it, and it is the reason to think twice before changing a default store key.

```ts
guardStore(alpine, "accordion", store, packageName, { override: true });
```

`resetRegistrationTracking()` clears the claims, which is what test teardown needs.

## SSR-safe environment access

No package in the toolkit reads `window` or `document` at import time. These return
`undefined` outside the browser instead of throwing.

```ts
import { isBrowser, safeWindow, safeDocument, safeMatchMedia } from "@ailura/alpinejs-core/env";

if (isBrowser()) {
  safeDocument()?.querySelector("main");
}
```

## Ids and singletons

`generateId(prefix)` returns a monotonic base-36 id, so a controller can identify
itself without a counter of its own.

```ts
import { generateId } from "@ailura/alpinejs-core/ids";

generateId("counter"); // "counter-1", "counter-2", ...
```

`createSingleton(key, factory)` is per-document, which is what keeps instances from
leaking across SSR requests.

```ts
import { createSingleton } from "@ailura/alpinejs-core/singletons";

const store = createSingleton("app-store", () => createStore());
```

## Subpath exports

Import from the subpath you need, not from the barrel, so a consumer does not pull the
whole surface in.

| Subpath          | Provides                                                                                                                                                                                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.`              | Everything, re-exported.                                                                                                                                                                                                                                                        |
| `./controller`   | `BaseController`, `EventEmitter`, `CleanupStack`, `EventMap`.                                                                                                                                                                                                                   |
| `./guards`       | `guardStore`, `guardMagic`, `guardDirective`, `resetRegistrationTracking`.                                                                                                                                                                                                      |
| `./env`          | `isBrowser`, `safeWindow`, `safeDocument`, `safeMatchMedia`.                                                                                                                                                                                                                    |
| `./ids`          | `generateId`, `resetIdCounter`.                                                                                                                                                                                                                                                 |
| `./singletons`   | `createSingleton`, `releaseSingleton`, `clearAllSingletons`.                                                                                                                                                                                                                    |
| `./bridge`       | `bridgeControllerDirective`: wires a controller into an Alpine directive. Its teardown is element-bound — hand it to the directive's `cleanup()` and Alpine runs it when the element is removed. There is no store bridge: a store registration has no Alpine-invoked teardown. |
| `./sync`         | `syncRecordFromSnapshot`.                                                                                                                                                                                                                                                       |
| `./invariant`    | `invariant`.                                                                                                                                                                                                                                                                    |
| `./errors`       | `ToolkitError`, `RegistrationError`, `RegistrationKind`.                                                                                                                                                                                                                        |
| `./constants`    | `LIFECYCLE_IDLE`, `LIFECYCLE_MOUNTED`, `LIFECYCLE_DESTROYED`, `EVENT_CHANGE`, `SOURCE_USER`, `SOURCE_INITIALIZATION`.                                                                                                                                                           |
| `./registration` | `resolvePluginKeys`, `resolveStoreKey`, `readAlpineStore`: the key-resolution and typed store-read helpers every plugin factory uses.                                                                                                                                           |

:::caution[Importing from `.` in a published package defeats the subpaths]
The barrel exists for convenience and for tests. In code you ship, import from
`@ailura/alpinejs-core/guards` and friends — otherwise a plugin that only needs a guard
still pulls in the controller, the bridge, and the singletons.
:::
