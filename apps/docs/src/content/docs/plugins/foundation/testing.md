---
title: Testing
---

@ailura/alpinejs-testing

Helpers for testing Alpine plugins in Node with `happy-dom`. There is no browser and no
Alpine magic to learn: `start()` boots Alpine once, `html` + `mount` put a snippet on
the page, `settled()` waits for reactivity to flush, and `reset()` tears it all down.

**Dev-only.** Nothing here should be imported from runtime code, and this package is
never published to `dist`.

## Install

This package is `private`: it is a workspace devDependency, not a registry package, so it
resolves from the monorepo rather than from an install command.

```sh
pnpm install   # inside the monorepo; resolves @ailura/alpinejs-testing as a devDependency
```

## The four-line shape

Every plugin test follows the same shape.

```ts
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { html, mount, settled, start, resume, reset } from "@ailura/alpinejs-testing";
import { accordionPlugin } from "../src/plugin";

beforeAll(() => start(accordionPlugin()));
beforeEach(() => resume());
afterEach(() => reset());

it("opens on click", async () => {
  mount(html("<div x-data><button x-accordion:trigger>open</button></div>"));
  await settled();
  expect(document.querySelector("button")).toBeTruthy();
});
```

- `start(plugin)` registers the plugin and calls `Alpine.start()`. **Once per file** —
  Alpine is global, so a second `start()` in the same file is a duplicate registration.
- `resume()` restarts mutation observation. Alpine stops observing after `reset()`, and
  forgetting this is why the second test in a file does nothing.
- `reset()` tears down the DOM and runs the hooks registered with `onReset`.
- `settled()` awaits two Alpine ticks (`nextTick`), which is what reactivity needs to reach
  the DOM. A bare `await Promise.resolve()` is not enough and fails intermittently.

## `html()` and `mount()` are separate on purpose

`html()` builds a detached element. `mount(el)` moves it into `document.body` so Alpine
initialises it. The node is moved, not cloned, so `reset()` can remove it and a reference
you kept still points at the live element.

```ts
const el = html("<div x-data></div>");
mount(el);
expect(el.isConnected).toBe(true);
```

## Resetting guard state between files

The registration guards in [Core](/plugins/foundation/core/) remember which names a
package claimed. Without a reset hook, a second test file that registers the same store
name fails with a `RegistrationError` that has nothing to do with the test.

```ts
// test/setup.ts
import { onReset } from "@ailura/alpinejs-testing";
import { resetRegistrationTracking } from "@ailura/alpinejs-core/guards";

onReset(resetRegistrationTracking);
```

## API reference

| Name            | Type     | Purpose                                                      |
| --------------- | -------- | ------------------------------------------------------------ |
| `html(snippet)` | function | Build a detached element from an HTML string.                |
| `mount(el)`     | function | Append it to `document.body`. Returns nothing.               |
| `settled()`     | async    | Await reactivity flushing to the DOM. Two Alpine ticks.      |
| `start(plugin)` | function | Register the plugin and `Alpine.start()`. Once per file.     |
| `resume()`      | function | Restart mutation observation after a `reset()`.              |
| `reset()`       | function | Stop observing, destroy the tree, clear the body, run hooks. |
| `onReset(fn)`   | function | Register a hook that `reset()` runs; returns an unsubscribe. |

:::caution[A file without `resume()` fails on the second test]
`reset()` stops Alpine's mutation observer, so anything mounted after it is inert. The
first test passes, the second finds a detached-but-plausible DOM, and the failure points
at your component instead of at the missing `beforeEach`.
:::
