---
title: Scroll
---

@ailura/alpinejs-scroll

A `scroll` store for the page or any element: position, progress, whether you are at
an edge, and a body-scroll lock that nests correctly.

## Install

```sh
pnpm add alpinejs @ailura/alpinejs-scroll
```

## Register the plugin

Do this once, before `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import scrollPlugin from "@ailura/alpinejs-scroll";

Alpine.plugin(scrollPlugin());

Alpine.start();
```

That registers a `scroll` store, so everything below is reachable at `$store.scroll`.

## Minimal example

A read-progress bar and a "back to top" button.

```html
<div x-data>
  <p>Read: <span x-text="Math.round($store.scroll.progress * 100) + '%'"></span></p>
  <button @click="$store.scroll.toTop()" x-show="!$store.scroll.atTop">Back to top</button>
</div>
```

`progress` is from 0 to 1, so multiply before showing it. `atTop` and `atBottom` are
reactive, which is why the button can be bound with `x-show` instead of toggling a
flag by hand.

## Locking the body

Locking is counted, not boolean. `lock()` returns a handle and `unlock()` takes it
back, so two things locking at once do not unlock each other.

```html
<div x-data="{ handle: null }">
  <button @click="handle = $store.scroll.lock('modal')">Open</button>
  <button @click="$store.scroll.unlock(handle)" x-show="handle">Close</button>
  <p x-show="$store.scroll.locked">Locked <span x-text="$store.scroll.lockCount"></span> deep</p>
</div>
```

`lockCount` is the number of outstanding locks. If you set a flag to remember "the
modal is open" and pass that same flag as the reason, unlocking twice will not do
anything the second time — the count is what tells you whether it is safe.

**Release everything at once.** When a route changes and you cannot be sure every
lock was released, use `unlockAll()`.

```js
$store.scroll.unlockAll();
```

## Scrolling programmatically

```js
$store.scroll.toTop();
$store.scroll.toBottom();
$store.scroll.by({ y: 400 }); // 400px down from where you are
```

`by()` takes an offset object, not a number: `by({ y: 400 })` moves vertically,
`by({ x: 100 })` horizontally, and `by({ x: 100, y: 400 })` both.

`scrollIntoView()` is the one to reach for when you have an element rather than an
offset.

```js
$store.scroll.scrollIntoView(heading);
```

## API reference

| Name                                   | Type   | Purpose                                                                                          |
| -------------------------------------- | ------ | ------------------------------------------------------------------------------------------------ |
| `$store.scroll.x` / `y`                | store  | Current scroll offsets.                                                                          |
| `$store.scroll.progress`               | store  | From 0 to 1 across the scrollable range.                                                         |
| `$store.scroll.atTop` / `atBottom`     | store  | Whether you are at either edge.                                                                  |
| `$store.scroll.direction`              | store  | `"up"` or `"down"`.                                                                              |
| `$store.scroll.activeSection`          | store  | The id of the section currently in view.                                                         |
| `$store.scroll.visibleSections`        | store  | Every section id currently in view.                                                              |
| `$store.scroll.locked`                 | store  | Whether any lock is outstanding.                                                                 |
| `$store.scroll.lockCount`              | store  | How many locks are outstanding.                                                                  |
| `$store.scroll.lock(reason)`           | method | Take a lock; returns a handle.                                                                   |
| `$store.scroll.unlock(handle)`         | method | Release one lock by its handle.                                                                  |
| `$store.scroll.unlockAll()`            | method | Release every lock.                                                                              |
| `$store.scroll.toTop()` / `toBottom()` | method | Scroll to an edge.                                                                               |
| `$store.scroll.by(delta)`              | method | Scroll by an offset. `delta` is `{ x?, y? }`, not a number.                                      |
| `$store.scroll.scrollIntoView(el)`     | method | Scroll an element into view.                                                                     |
| `$store.scroll.destroy()`              | method | Host-owned teardown: disconnects the observer and releases every lock. Nothing calls it for you. |

:::caution[A lock that is never released freezes the page for everyone]
`locked` stays true until the count reaches zero, and the count only drops when
`unlock()` is called with the right handle. A component that locks on mount and
unlocks on a click that may never happen leaves the page unscrollable after a
navigation. Tie the release to teardown, not to a button.
:::

## Plugin options

```ts
scrollPlugin({ id: "app-scroll", storeKey: "scroller" });
```
