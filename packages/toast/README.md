# @ailura/alpinejs-toast

<p align="center">

[![bundlephobia minzip](https://badgen.net/bundlephobia/minzip/@ailura/alpinejs-toast)](https://bundlephobia.com/package/@ailura/alpinejs-toast)

</p>

> Headless toast queue for Alpine.js — push, update, dedupe by key and auto-dismiss, with per-toast position, variant and duration. This package is the queue; rendering is yours.

## Installation

```sh
pnpm add @ailura/alpinejs-toast alpinejs
# or
npm install @ailura/alpinejs-toast alpinejs
```

Requires `alpinejs@^3.0.0` as peer. `@ailura/alpinejs-core` is a **peer
dependency**, not a dependency: no package in this toolkit has a
`dependencies` block, so the host installs it too.

## Usage

### 1. Standalone (framework-agnostic)

```ts
import { createToastController } from "@ailura/alpinejs-toast";

const queue = createToastController({ defaultDuration: 5000, maxToasts: 3 });
const id = queue.push({ title: "Saved", variant: "success" });
queue.update(id, { title: "Saved as draft" });
queue.items.filter((item) => !item.removed).forEach(console.log);
queue.on("change", ({ source, items }) => console.log(source, items.length));
queue.dismiss(id);
queue.destroy(); // clears every pending auto-dismiss timer
```

Read `queue.items` for the live list. `queue.toStore()` exists for the Alpine
plugin and its `items` getter always reads empty outside Alpine — use `items`
directly.

### 2. Alpine

```ts
import Alpine from "alpinejs";
import toastPlugin from "@ailura/alpinejs-toast";

Alpine.plugin(toastPlugin());
Alpine.start();
```

```html
<div x-data>
  <button type="button" @click="$store.toast.push({ title: 'Hello', variant: 'success' })">
    Notify
  </button>

  <!-- minimal: one row per live toast. See "Rendering" below for the
       animate-the-exit version, which deliberately does NOT filter `removed`. -->
  <template x-for="toast in $store.toast.items.filter((t) => !t.removed)" :key="toast.id">
    <div :data-variant="toast.variant" :data-position="toast.position">
      <strong x-text="toast.title"></strong>
      <p x-show="toast.description" x-text="toast.description"></p>
      <button
        type="button"
        x-show="toast.action"
        @click="toast.action?.onClick?.(); $store.toast.dismiss(toast.id)"
        x-text="toast.action?.label"
      ></button>
      <button type="button" @click="$store.toast.dismiss(toast.id)" aria-label="Dismiss">×</button>
    </div>
  </template>
</div>
```

The plugin registers `$store.toast` and the magic `$toast`. **The magic is the
store** — `$toast.push(…)` and `$store.toast.push(…)` are the same object, so a
component can take a toast function without knowing how it was produced.

## API

| Export                         | Description                                                                                                           | Type             |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ---------------- |
| `ToastController`              | Controller class — owns the queue, emits `change` with a `ToastChangeDetail`                                          | `class`          |
| `createToastController`        | `createToastController(options?) => ToastController`                                                                  | `function`       |
| `toastPlugin`                  | Alpine plugin factory — `toastPlugin(options?) => AlpineCallback`; registers `$store.toast` and `$toast`              | `function`       |
| `DEFAULT_TOAST_STORE_KEY`      | Default `$store` key — `"toast"`                                                                                      | `string` (const) |
| `DEFAULT_TOAST_MAGIC_KEY`      | Default magic key — the same `"toast"`                                                                                | `string` (const) |
| `ToastStore`                   | The Alpine-facing surface: 5 state fields plus the 7 queue methods                                                    | `type`           |
| `ToastItem`                    | One queued toast — `{ id, key, content, title, description, variant, position, duration, action, removed }`           | `type`           |
| `ToastOptions`                 | The `push()` payload — every field falls back to the controller default or `null`                                     | `type`           |
| `ToastPayload`                 | Legacy alias of `ToastOptions`                                                                                        | `type`           |
| `ToastAction`                  | `{ label, onClick? }` — a label is all the queue stores; running it is the renderer's job                             | `type`           |
| `ToastPosition`                | `"bottom-right" \| (string & {})` — the union keeps the built-in in the type while accepting your own                 | `type`           |
| `ToastVariant`                 | `"default" \| (string & {})` — a label for the renderer; the queue does not style anything                            | `type`           |
| `ToastDuration`                | Milliseconds, or `false` for a toast that never auto-dismisses                                                        | `type`           |
| `ToastChangeDetail`            | `change` payload — `{ source, items }`, `items` being the live array                                                  | `type`           |
| `ToastChangeSource`            | `"initialization" \| "push" \| "pushUnique" \| "update" \| "dismiss" \| "dismissAt" \| "dismissAll"`                  | `type`           |
| `CreateToastOptions`           | Controller and plugin options — `{ id, defaultPosition, defaultDuration, maxToasts, maxVisible, storeKey, magicKey }` | `type`           |
| `CreateToastControllerOptions` | Legacy alias of `CreateToastOptions`                                                                                  | `type`           |
| `ToastEvents`                  | Event map for `controller.on(…)` — `{ change: [ToastChangeDetail] }`                                                  | `type`           |
| `ToastAlpine`                  | The `Alpine` shape the store is registered on                                                                         | `type`           |
| `ToastPluginCallback`          | `(alpine: Alpine) => void`                                                                                            | `type`           |

### Store API

```ts
// Push
$store.toast.push({ title: "Saved", variant: "success", duration: 3000 }); // → id
$store.toast.pushUnique("sync", { title: "Syncing…", duration: false }); // → id, replaces the last one with that key

// Read
$store.toast.items; // live array, newest first
$store.toast.itemsAt("bottom-right"); // filtered by position, includes `removed`
$store.toast.defaultPosition; // "bottom-right"
$store.toast.stackPositions; // always [defaultPosition]
$store.toast.maxToasts;
$store.toast.maxVisible; // advisory — never enforced here

// Change
$store.toast.update(id, { title: "Saved as draft" }); // partial merge; re-arms the timer if `duration` is passed
$store.toast.dismiss(id);
$store.toast.dismissAt("top-center");
$store.toast.dismissAll();
```

| Method                      | Description                                                                                                                   |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `push(payload?)`            | Adds a toast at the front of the queue and returns its id. Enforces `maxToasts` for the target position, dropping the oldest. |
| `pushUnique(key, payload?)` | Dismisses every live toast with that `key`, then pushes a new one. The id-keyed dedupe you want for a long-running job.       |
| `update(id, payload?)`      | Merges the given fields into the item. Unknown ids are ignored. Passing `duration` restarts the full auto-dismiss countdown.  |
| `dismiss(id)`               | Marks one toast removed and schedules its purge. Unknown ids are ignored.                                                     |
| `dismissAt(position)`       | Dismisses every live toast at one position.                                                                                   |
| `dismissAll()`              | Dismisses every live toast, whatever its position.                                                                            |
| `itemsAt(position)`         | The items at a position, **including** ones already marked `removed`. Filter if you are rendering.                            |
| `destroy()`                 | Clears every pending auto-dismiss timer and freezes the queue. The host owns this; nothing calls it for you.                  |

### Options

```ts
type CreateToastOptions = {
  id?: string; // controller id — default: generateId("toast")
  defaultPosition?: ToastPosition; // default: "bottom-right"
  defaultDuration?: number; // default: 4000
  maxToasts?: number; // live toasts kept per position — default: 5
  maxVisible?: number; // default: maxToasts — advisory, see Limitations
  storeKey?: string; // $store key — default: DEFAULT_TOAST_STORE_KEY
  magicKey?: string; // $magic key — default: magicKey ?? storeKey
};
```

| Option            | Default          | Description                                                                                                                      |
| ----------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `defaultPosition` | `"bottom-right"` | Used when a `push()` payload omits `position`.                                                                                   |
| `defaultDuration` | `4000`           | Milliseconds before a toast auto-dismisses. `0` also means "never".                                                              |
| `maxToasts`       | `5`              | Enforced **per position** on every `push()`: past it, the oldest live toast at that position is dismissed. `0` disables the cap. |
| `maxVisible`      | `maxToasts`      | Exposed for a renderer. The controller never reads it.                                                                           |
| `storeKey`        | `"toast"`        | `$store` key the plugin registers under.                                                                                         |
| `magicKey`        | `storeKey`       | Magic key; rename one and the other follows.                                                                                     |

Per-toast `ToastOptions` fields: `title`, `description`, `content` (any value, for
a renderer that wants its own payload), `variant`, `position`, `duration`
(`false` for a persistent toast), `action`, `key`.

### Avoiding name collisions

```ts
Alpine.plugin(toastPlugin({ storeKey: "notices", magicKey: "notices" }));
// → $store.notices and $notices
```

`storeKey` is the only name to move, and the magic follows it. The exported
constants `DEFAULT_TOAST_STORE_KEY` / `DEFAULT_TOAST_MAGIC_KEY` keep the default
discoverable from TypeScript.

## Events

```ts
import type { ToastChangeDetail } from "@ailura/alpinejs-toast";

queue.on("change", (detail: ToastChangeDetail) => {
  detail.source; // which method ran
  detail.items; // the live array, reference-identical to queue.items
});
```

A dismissal emits **twice**: once with the item marked `removed`, and again 300
ms later when it is purged. `source` is `"dismiss"` on both, plus
`"dismissAt"` / `"dismissAll"` for the bulk forms.

## Auto-dismiss

`duration` is a plain `setTimeout` per toast, cancelled and re-armed by
`update(id, { duration })`. A toast is **persistent** when its resolved duration
is `false` or `0` — `push({ duration: false })`, and the demo's loading toasts use
it. `null` and `undefined` are _not_ the same thing: the item's duration is
`payload.duration ?? defaultDuration`, so they fall back to the default and
auto-dismiss like anything else. Setting `defaultDuration: 0` makes every toast
persistent unless it passes its own duration.

Timers need a browser. Under SSR the queue is importable and the store is
registered, but nothing auto-dismisses and the initial render has no items.

## Rendering

The package ships no markup, no CSS and no directive. A renderer is roughly one
container and a loop:

```html
<!-- @alpinejs/transition for x-transition -->
<div class="toaster">
  <template x-for="toast in $store.toast.items" :key="toast.id">
    <div :data-removed="toast.removed" x-show="!toast.removed" x-transition.opacity.duration.300ms>
      <strong x-text="toast.title"></strong>
      <button type="button" @click="$store.toast.dismiss(toast.id)">×</button>
    </div>
  </template>
</div>
```

Iterating `items` **without** filtering `removed` is what lets a dismissed toast
animate out: it is still in the array for 300 ms, and if you drop it the instant
it is dismissed the exit transition can never be seen. `x-show` holds it visible
while `data-removed` is true so the leave transition has something to run on, and
the item leaves the list when the 300 ms is up.

The demo playground's renderer (`apps/demo/src/demo/sonner-demo.ts`) is the
worked example of the other half — per-position stacks, measured heights and
swipe-to-dismiss. It is demo code, not part of this package.

## Limitations

- **No tests.** `packages/toast` has no `test/` directory, so nothing in this
  package is covered by `vp test` — including the 300 ms purge window, the
  `maxToasts` cap and the `pushUnique` dedupe. Treat the behaviour above as
  read-from-source, not as test-backed.
- **`toStore().items` is always empty.** The controller's store literal has no
  reactive array to read; only the plugin's store overrides the getter. Outside
  Alpine use `controller.items`.
- **`maxVisible` is never enforced.** It is a value on the store that the
  controller does not read. Cap your own render list with it.
- **`stackPositions` never grows.** It is `[defaultPosition]` for the life of the
  controller; a toast pushed with another `position` is not added to it. Use
  `itemsAt(position)` to find them.
- **`itemsAt()` includes removed items**, while `dismissAt()` only touches live
  ones. The asymmetry is deliberate but easy to trip over.
- **Dismissing emits two `change` events**, 300 ms apart, for one user action.
- **`update(id, { duration })` restarts the whole countdown**, it does not extend
  the remaining time.
- **Legacy types are unreachable.** `ToastManager`, `ToastPromiseOptions`,
  `ToastPluginOptions`, `DefaultToastPosition` and `DefaultToastVariant` are
  declared in `src/types.ts` but not re-exported from the package entry, so
  importing them fails. `toastPlugin()` takes `CreateToastOptions`.
- **`null` / `undefined` durations are unreachable on an item.** The
  auto-dismiss guard checks for them, but `push()` and `update()` resolve the
  value through `?? defaultDuration` first, so only `false` and `0` reach it.

## Size

`4.00 kB raw / 1.48 kB gzip` · budget `4 kB` · externalized peers: `alpinejs`,
`@ailura/alpinejs-core` · `size-limit` + `publint` + `attw` verified.

## Architecture

[Primitives layer](../../ARCHITECTURE.md) — controllers own state, Alpine owns reactivity. See canon, guards, and SSR rules in [ARCHITECTURE.md](../../ARCHITECTURE.md).

## Testing

```sh
pnpm test              # vp test (happy-dom) — no test files in this package yet
pnpm run typecheck     # tsc --noEmit
```

## License

MIT
