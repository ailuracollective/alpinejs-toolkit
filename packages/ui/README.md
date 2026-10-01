# @ailura/alpinejs-ui

<p align="center">

[![bundlephobia minzip](https://badgen.net/bundlephobia/minzip/@ailura/alpinejs-ui)](https://bundlephobia.com/package/@ailura/alpinejs-ui)

</p>

> Framework-agnostic DOM primitives for the Alpine.js toolkit: value-polymorphic storage adapters, an SSR-safe `matchMedia` subscription, and a portal-root factory. No Alpine plugin, no store, no magic — you call these functions.

Depends only on `@ailura/alpinejs-core` (for its SSR-safe `env` helpers).

## Installation

```sh
pnpm add @ailura/alpinejs-ui alpinejs
# or
npm install @ailura/alpinejs-ui alpinejs
```

Requires `alpinejs@^3.0.0` as peer, plus `@ailura/alpinejs-core` — a **peer
dependency** too, since no package in this toolkit has a `dependencies` block.
ESM only.

## Usage

`ui` ships **four modules**, each importable on its own so a consumer that only
needs a storage adapter does not load the portal helper.

```ts
import { createLocalStorageAdapter } from "@ailura/alpinejs-ui/storage";
import { createPortalRoot } from "@ailura/alpinejs-ui/portal";
import { createMediaQueryListener } from "@ailura/alpinejs-ui/media";
import type { StorageAdapter } from "@ailura/alpinejs-ui/types";
```

The barrel — `@ailura/alpinejs-ui` — re-exports all four.

### Storage adapters

A factory takes your value type and the `parse`/`serialize` pair that pins the
persisted format, so string handling never leaks into your controller. `parse`
is the **validation gate**: returning `null` means "reject this stored value",
and the adapter reports `null` to you so you can fall back to your own default.

```ts
import { createLocalStorageAdapter } from "@ailura/alpinejs-ui/storage";
import type { StorageAdapter } from "@ailura/alpinejs-ui/types";

type Density = "compact" | "comfortable";

const density: StorageAdapter<Density> = createLocalStorageAdapter<Density>({
  key: "app:density",
  parse: (raw) => (raw === "compact" || raw === "comfortable" ? raw : null),
  serialize: (value) => value,
  crossTab: true, // default — omit to skip the `storage` listener entirely
});

density.get(); // 'comfortable' | 'compact' | null (absent, blocked, or rejected)
density.set("compact");
density.remove();

// Changes made in *another* tab:
const stop = density.subscribe?.((next) => {
  console.log(next); // null when the other tab cleared the key
});
stop?.();
```

For a hermetic layer — a test, or a server render that wants to seed a
controller with a precomputed value — the in-memory adapter has the same shape
and fires its own subscribers:

```ts
import { createMemoryAdapter } from "@ailura/alpinejs-ui/storage";

const mem = createMemoryAdapter<string>({ initial: "dark" });
const stop = mem.subscribe((next) => console.log(next));
mem.set("light"); // logs "light"
mem.remove(); // logs null
stop();
```

### Portal root

Idempotent: the first call for an id creates the container and appends it to
`document.body`; every later call returns the same element. Returns `null`
under SSR so a template can short-circuit.

```ts
import { createPortalRoot, removePortalRoot } from "@ailura/alpinejs-ui/portal";

const root = createPortalRoot({ id: "overlay-root", className: "z-50", as: "div" });
// → HTMLElement | null

removePortalRoot(root); // → true when a node was really detached
```

`createPortalRoot` never re-styles an element that already exists, and
`removePortalRoot` is reference-taking rather than id-taking on purpose — see
[Limitations](#limitations).

### Media query listener

```ts
import { createMediaQueryListener } from "@ailura/alpinejs-ui/media";

const stop = createMediaQueryListener("(prefers-reduced-motion: reduce)", (event) => {
  console.log(event.matches);
});

stop();
stop(); // idempotent
```

## API

### Subpaths

| Subpath               | Exports                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `@ailura/alpinejs-ui` | Barrel — re-exports all four modules below, no logic                                                                |
| `…/storage`           | `createLocalStorageAdapter`, `createMemoryAdapter`                                                                  |
| `…/portal`            | `createPortalRoot`, `removePortalRoot`                                                                              |
| `…/media`             | `createMediaQueryListener`                                                                                          |
| `…/types`             | `StorageAdapter`, `SubscribableStorageAdapter`, `LocalStorageAdapterOptions`, `MemoryAdapterOptions`, `Unsubscribe` |

### `/storage`

| Export                                      | Description                                                                                                                                                                                                                                                                                      |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `createLocalStorageAdapter<Value>(options)` | `localStorage`-backed adapter, value-polymorphic in `Value`. `parse` is the validation gate: a stored value it rejects comes back as `null`. `subscribe` is **always present** on the returned object — with `crossTab: false` it returns a no-op unsubscribe and registers no `window` listener |
| `createMemoryAdapter<Value>(options?)`      | In-process `Value \| null` cell with a real pub/sub. `set` notifies; `remove` notifies `null`; cross-tab sync is intentionally not supported                                                                                                                                                     |
| `StorageAdapter<Value>`                     | `{ get(), set(value), remove(), subscribe?(listener) }`. `subscribe` is **optional** in the contract — a backend with no event channel leaves it undefined. The two factories here both return the `SubscribableStorageAdapter` subtype, where it is required                                    |
| `SubscribableStorageAdapter<Value>`         | `StorageAdapter<Value> & { subscribe(...) }` — non-optional                                                                                                                                                                                                                                      |
| `LocalStorageAdapterOptions<Value>`         | `{ key, parse, serialize, crossTab? }`                                                                                                                                                                                                                                                           |
| `MemoryAdapterOptions<Value>`               | `{ initial? }`                                                                                                                                                                                                                                                                                   |
| `Unsubscribe`                               | `() => void` — idempotent by contract                                                                                                                                                                                                                                                            |

| Option      | Default    | Effect                                                                                                                                       |
| ----------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `key`       | _required_ | The `localStorage` key. One adapter owns one key                                                                                             |
| `parse`     | _required_ | Raw string → value, or `null` to reject. Also gates cross-tab events: a value the other tab writes that `parse` rejects is **not forwarded** |
| `serialize` | _required_ | Value → string                                                                                                                               |
| `crossTab`  | `true`     | `false` skips registering the `window` `storage` listener; `subscribe` still exists and is a no-op                                           |
| `initial`   | `null`     | Seed value for `createMemoryAdapter`; `null` (the default) leaves the cell empty                                                             |

### `/portal`

| Export                    | Description                                                                                                                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createPortalRoot(opts?)` | Returns the container for `opts.id ?? "overlay-root"`, creating a `opts.as ?? "div"` element with `opts.className` and appending it to `document.body` on first use. `null` when there is no `document` |
| `removePortalRoot(root)`  | Detaches the node **you hold a reference to**. `true` when a node was really removed; `false` for `null`, SSR, and an already-detached node. Idempotent and never throws                                |
| `PortalRootOptions`       | `{ id?, className?, as? }`                                                                                                                                                                              |

### `/media`

| Export                                                   | Description                                                                                                                                                                                                                                                      |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createMediaQueryListener(query, listener): Unsubscribe` | Subscribes to the `change` event of a `MediaQueryList`; the listener receives the raw `MediaQueryListEvent`, so `event.matches` and any future fields are both available. Returns an idempotent unsubscribe, or a no-op one when the runtime has no `matchMedia` |

### SSR

> SSR-safe — no `window`/`document` is read at import time, and every entry
> point returns a usable value on a server rather than throwing:
>
> - `createLocalStorageAdapter` reads and writes are no-ops, `get()` returns `null`, and `subscribe` returns a no-op unsubscribe
> - `createMemoryAdapter` is fully functional — it has no browser dependency at all
> - `createPortalRoot` returns `null`, `removePortalRoot` returns `false`
> - `createMediaQueryListener` returns a no-op unsubscribe
>
> All of them reach the DOM through `safeWindow` / `safeDocument` /
> `safeMatchMedia` from `@ailura/alpinejs-core/env`.

## Integration

- **`@ailura/alpinejs-theme`** — `createLocalStorageAdapter` for the persisted theme, `createMemoryAdapter` for SSR, and `createMediaQueryListener("(prefers-color-scheme: dark)")` for the `system` value. It is the reference consumer of all three.
- **`@ailura/alpinejs-overlay`** — `createPortalRoot` / `removePortalRoot` for the portal container its stacks are appended to.
- **Your own controller** — compose `StorageAdapter<Value>` into a typed shape rather than re-deriving the SSR-safe read / write / subscribe dance.

## Limitations

- **The `storage` event never fires in the tab that wrote.** A localStorage
  adapter only notifies for _other_ tabs, so `set()` does not self-notify. If
  your controller needs to react to its own writes, it already knows — it made
  them.
- **A cross-tab write that `parse` rejects is silent.** The `storage` listener
  drops the event rather than forwarding `null`, because `null` already means
  "the other tab removed the key". A corrupt value written by a third-party
  script on the same key therefore leaves your adapter on its previous value
  with no callback at all.
- **A stored `null` and a rejected value are indistinguishable.** `parse` uses
  `null` for both, so you cannot persist a literal `null` and later tell it
  apart from garbage. Model "absent" as absence, not as a value.
- **A blocked store looks like an empty one.** Every `localStorage` call is
  wrapped in `try/catch` and swallowed, so Safari private mode, a `SecurityError`
  and a first visit are the same observation: `get()` returns `null` and `set()`
  silently does nothing. There is no error channel by design.
- **`createPortalRoot` never re-styles an existing container.** A second caller
  for the same `id` with a different `className` or `as` gets the first
  caller's element unchanged. `removePortalRoot` is deliberately reference-taking
  for the same reason — it can only remove a node you already hold, so it can
  never tear down a root another consumer created.
- **`createMediaQueryListener` gives you no way to tell "subscribed" from
  "unsubscribed".** With no `matchMedia` the returned unsubscribe is a no-op that
  looks exactly like a real one, so a caller cannot report the degradation. Read
  the initial value separately with `safeMatchMedia(query)?.matches`.
- **`createMemoryAdapter.set()` always notifies,** even when the value is
  unchanged, and `remove()` is a no-op (no event) when the cell is already
  `null`.

## Size

`0.35 kB raw / 0.17 kB gzip` (barrel `dist/index.mjs`, minified, gzip 9) · barrel budget `750 B` · externalized peers: `alpinejs`, `@ailura/alpinejs-core` · `size-limit` + `publint` + `attw` verified.

Per-subpath budgets from `.size-limit.json`:

| Subpath     | Budget  |
| ----------- | ------- |
| `./storage` | `550 B` |
| `./portal`  | `260 B` |
| `./media`   | `250 B` |
| `./types`   | `50 B`  |

## Architecture

[Foundation layer](../../ARCHITECTURE.md) — framework-agnostic infra under the
Features layer. `ui` ships no `plugin.ts`: it has no store, no magic and no
directive, so there is no guard to call and no name to collide with. See the
canon, guards and SSR rules in [ARCHITECTURE.md](../../ARCHITECTURE.md).

## Testing

```sh
pnpm exec vp test packages/ui
pnpm exec tsc --noEmit -p packages/ui/tsconfig.json
```

Uses `@ailura/alpinejs-testing` — see
[ARCHITECTURE.md §8](../../ARCHITECTURE.md).

## License

MIT
