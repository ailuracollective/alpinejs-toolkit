---
title: Transfer
---

@ailura/alpinejs-transfer

Three magics for getting data out of the page: `$clipboard`, `$share`, and `$export`.
Each is a function, and each one is rejected by the browser in some context, so each
one has a way to ask first.

## Install

```sh
pnpm add alpinejs @ailura/alpinejs-transfer
```

## Register the plugin

Do this once, before `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import transferPlugin from "@ailura/alpinejs-transfer";

Alpine.plugin(transferPlugin());

Alpine.start();
```

That registers three magics. There is no store.

## Minimal example

Copy a command, share the page, and export a config — each with its own check.

```html
<div x-data="{ copied: false }">
  <button
    @click="$clipboard('pnpm add alpinejs @ailura/alpinejs-accordion').then(() => (copied = true))"
  >
    Copy install command
  </button>
  <span x-show="copied">Copied.</span>

  <button
    x-show="$share.isSupported"
    @click="$share({ title: 'Alpine.js Toolkit', url: location.href })"
  >
    Share
  </button>

  <button
    @click="$export(JSON.stringify(config), { filename: 'config.json', mimeType: 'application/json' })"
  >
    Export
  </button>
</div>
```

All three are async and all three return a promise, so the `.then()` is real work
rather than decoration: a clipboard write fails silently on an insecure origin, and
this is how you find out. `$export()` resolves `false` instead of throwing when the
download cannot happen, and a string source without a filename is one of those cases.

## Each magic has two statics

These are properties on the function, not methods on an object. Read them as
properties.

| Magic     | Property         | Type     | Meaning                                        |
| --------- | ---------------- | -------- | ---------------------------------------------- |
| `$share`  | `isSupported`    | property | The Web Share API is available.                |
| `$share`  | `canShare(data)` | method   | Whether this particular payload can be shared. |
| `$export` | `isSupported`    | property | File download is available.                    |

`$clipboard` has no statics. It is a function and nothing else.

:::caution[`canShare` is the one people skip]
`$share.isSupported` only tells you the browser has the API. It can still refuse a
payload larger than a file, or one with a URL the browser will not treat as shareable.
When you are sharing structured data, ask `canShare(data)` and fall back to the
clipboard rather than offering a button that does nothing.
:::

## API reference

| Magic                       | Type     | Purpose                                                                                       |
| --------------------------- | -------- | --------------------------------------------------------------------------------------------- |
| `$clipboard(text, mode?)`   | function | Copy text. Returns a promise. `mode` is `'auto'`, `'clipboard'` or `'legacy'`, or `{ mode }`. |
| `$share(data)`              | function | Share via the Web Share API. Returns a promise.                                               |
| `$export(source, options?)` | function | Download a `string`, `Blob` or `File` as a file. Returns a promise.                           |

`options` for `$export()` is `{ filename, mimeType }` or just the filename as a string.
A `Blob` or `File` falls back to its own name (`export` for an unnamed blob), so it
needs no options; a plain string does.

## Plugin options

```ts
transferPlugin({
  clipboardKey: "copy",
  shareKey: "share",
  exportKey: "download",
});
```
