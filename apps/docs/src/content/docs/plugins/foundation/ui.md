---
title: UI
---

@ailura/alpinejs-ui

The browser-facing helpers the feature packages share: storage adapters, a portal root,
and a media-query listener. UI is **not** an Alpine plugin — nothing is registered, and
there is no store. You import what you need and compose it yourself.

## Install

```sh
pnpm add alpinejs @ailura/alpinejs-core @ailura/alpinejs-ui
```

Core is a peer: the SSR guards the helpers read through live there, not in UI.

## Storage adapters

An adapter is `{ get, set, remove, subscribe }`. The memory one is for tests and for state
that should not outlive the page; the localStorage one persists and syncs across tabs.
`get()` returns `null` when nothing valid is stored, and `remove()` clears the entry.

```ts
import { createMemoryAdapter, createLocalStorageAdapter } from "@ailura/alpinejs-ui/storage";

// Tests, or state that resets on reload.
const draft = createMemoryAdapter<string>({ initial: "" });

// Persisted, and kept in sync with other tabs.
const theme = createLocalStorageAdapter<string>({
  key: "app-theme",
  parse: JSON.parse,
  serialize: JSON.stringify,
});
```

`createLocalStorageAdapter` needs `parse` and `serialize` because values come back as
strings. A `SecurityError` from a blocked storage is handled by degrading silently, so
a browser with storage disabled does not take the page down with it.

`subscribe()` on the local adapter wires the cross-tab `storage` event, which is what
makes a change in one tab reach the others. Pass `crossTab: false` to opt out when that
is not wanted.

## A portal root

Overlays need a container that is not inside a clipping or stacking context.
`createPortalRoot` returns it, creating it if needed and reusing it after that.

```ts
import { createPortalRoot } from "@ailura/alpinejs-ui/portal";

const root = createPortalRoot();
const portal = createPortalRoot({ id: "dialog-root", className: "z-50" });
```

`removePortalRoot(el)` detaches a container you already hold. It takes the element, not
the id, so it can never tear down a root another consumer created for the same id.

It returns `null` outside the browser, so it is safe to call during SSR.

## A media-query listener

`createMediaQueryListener` gives you the flip events for one query and hands back an
unsubscribe function.

```ts
import { createMediaQueryListener } from "@ailura/alpinejs-ui/media";

const stop = createMediaQueryListener("(prefers-reduced-motion: reduce)", (event) => {
  if (event.matches) pauseAnimations();
});

stop();
```

The returned function is a no-op when the browser has no `matchMedia`, so calling
`stop()` unconditionally is safe.

:::caution[A listener you never stop outlives its component]
`createMediaQueryListener` returns an unsubscribe, and nothing calls it for you. A
listener kept alive by a component that unmounted keeps the whole callback closure
reachable, which is a leak that grows one entry per navigation.
:::

## Subpath exports

| Subpath     | Provides                                                                                                             |
| ----------- | -------------------------------------------------------------------------------------------------------------------- |
| `.`         | Everything, re-exported.                                                                                             |
| `./storage` | `createMemoryAdapter`, `createLocalStorageAdapter`, the adapter types.                                               |
| `./portal`  | `createPortalRoot`, `removePortalRoot`, `PortalRootOptions`.                                                         |
| `./media`   | `createMediaQueryListener`.                                                                                          |
| `./types`   | `StorageAdapter`, `SubscribableStorageAdapter`, `Unsubscribe`, `LocalStorageAdapterOptions`, `MemoryAdapterOptions`. |
