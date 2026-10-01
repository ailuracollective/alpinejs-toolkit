# @ailura/alpinejs-transfer

<p align="center">

[![bundlephobia minzip](https://badgen.net/bundlephobia/minzip/@ailura/alpinejs-transfer)](https://bundlephobia.com/package/@ailura/alpinejs-transfer)

</p>

> Three outbound magics for Alpine.js — `$clipboard`, `$share` and `$export` — wrapping `navigator.clipboard`, the Web Share API and a programmatic download, each with a fallback or an availability probe so a button degrades instead of throwing.

## Installation

```sh
pnpm add @ailura/alpinejs-transfer alpinejs
# or
npm install @ailura/alpinejs-transfer alpinejs
```

Requires `alpinejs@^3.0.0` as peer. `@ailura/alpinejs-core` is a **peer
dependency**, not a dependency: no package in this toolkit has a
`dependencies` block, so the host installs it too.

## Usage

### 1. Standalone (framework-agnostic)

```ts
import { createTransferController } from "@ailura/alpinejs-transfer";

const transfer = createTransferController();

await transfer.copy("https://example.com"); // auto: Clipboard API, else textarea fallback
await transfer.copy("forced", { mode: "clipboard" }); // Clipboard API only — throws if missing
await transfer.copy("forced", { mode: "legacy" }); // textarea only — throws if the copy is refused

transfer.isShareSupported(); // navigator.share AND a secure context
transfer.canShare({ title: "Alpine", url: "https://example.com" });
await transfer.share({ title: "Alpine", text: "Look at this" }); // → boolean

transfer.isExportSupported(); // URL.createObjectURL exists
await transfer.export("id,name\n1,a", { filename: "data.csv", mimeType: "text/csv" });
await transfer.export(new Blob(["hi"]), { filename: "hi.txt" });
```

Nothing here needs `mount()` — the controller is a thin wrapper over three
browser APIs, and it has no state to set up.

### 2. Alpine

```ts
import Alpine from "alpinejs";
import transferPlugin from "@ailura/alpinejs-transfer";

Alpine.plugin(transferPlugin());
Alpine.start();
```

```html
<div x-data="{ status: '' }">
  <button
    type="button"
    @click="transfer.copy('https://example.com').then(() => status = 'copied').catch(() => status = 'blocked')"
  >
    Copy link
  </button>

  <button
    type="button"
    x-bind:disabled="!$share.isSupported"
    @click="$share({ title: 'Page', url: location.href })"
  >
    Share
  </button>

  <button
    type="button"
    x-bind:disabled="!$export.isSupported"
    @click="$export('id,name\n1,a', { filename: 'data.csv', mimeType: 'text/csv' })"
  >
    Export CSV
  </button>

  <p x-text="status"></p>
</div>
```

`$clipboard` is a plain async function. `$share` and `$export` are functions
carrying an `isSupported` getter (and `$share` a `canShare()` method) so a
template can bind `disabled` against the real capability rather than guessing.

## API

| Export                           | Description                                                                                                       | Type             |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------- |
| `TransferController`             | Controller class — `copy`, `isShareSupported`, `canShare`, `share`, `isExportSupported`, `export`. Emits nothing. | `class`          |
| `createTransferController`       | `createTransferController(options?) => TransferController`                                                        | `function`       |
| `transferPlugin`                 | Alpine plugin factory — `transferPlugin(options?) => AlpineCallback`; registers `$clipboard`, `$share`, `$export` | `function`       |
| `DEFAULT_TRANSFER_CLIPBOARD_KEY` | Default clipboard magic key — `"clipboard"`                                                                       | `string` (const) |
| `DEFAULT_TRANSFER_SHARE_KEY`     | Default share magic key — `"share"`                                                                               | `string` (const) |
| `DEFAULT_TRANSFER_EXPORT_KEY`    | Default export magic key — `"export"`                                                                             | `string` (const) |
| `ClipboardMagic`                 | The `$clipboard` signature, overloaded on the copy mode                                                           | `type`           |
| `CopyToClipboard`                | The same call signature under its standalone name — `ClipboardMagic` is the alias                                 | `type`           |
| `ClipboardCopyText`              | What can be copied — `string \| number \| boolean \| bigint`, stringified before it is written                    | `type`           |
| `ClipboardCopyMode`              | `"auto" \| "clipboard" \| "legacy"`                                                                               | `type`           |
| `ClipboardCopyOptions`           | `{ mode?: ClipboardCopyMode }` — the second argument may be this object or a bare mode string                     | `type`           |
| `ShareMagic`                     | `((data: ShareData) => Promise<boolean>)` plus `readonly isSupported` and `canShare(data?)`                       | `type`           |
| `ExportMagic`                    | `((source, options?) => Promise<boolean>)` plus `readonly isSupported`                                            | `type`           |
| `ExportSource`                   | `string \| Blob \| File`                                                                                          | `type`           |
| `ExportOptions`                  | `{ filename?, mimeType? }` — also accepted as a bare filename string                                              | `type`           |
| `TransferMagic`                  | All three magics intersected. Nothing in the package produces it — the plugin registers them separately           | `type`           |
| `TransferPluginOptions`          | Plugin options — see below                                                                                        | `type`           |
| `TransferOptions`                | Legacy alias of `TransferPluginOptions`; the two interfaces are identical                                         | `type`           |
| `TransferControllerOptions`      | `{ id? }` — the controller id, generated as `generateId("transfer")` when absent                                  | `type`           |
| `TransferAlpine`                 | `Alpine` itself — the plugin takes no shape of its own                                                            | `type`           |
| `TransferPluginCallback`         | `(alpine: Alpine) => void`                                                                                        | `type`           |

### Controller API

| Member                       | Returns            | Behaviour                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `copy(text, modeOrOptions?)` | `Promise<void>`    | `"auto"` (default) uses `navigator.clipboard` when `writeText` exists and otherwise falls back to a hidden `textarea` + `execCommand("copy")`. `"clipboard"` uses the async API and **throws** `Clipboard API is not available` if it is missing. `"legacy"` forces the textarea and **throws** `Failed to copy to clipboard` if the copy is refused. |
| `isShareSupported()`         | `boolean`          | `navigator.share` is a function **and** `globalThis.isSecureContext === true`.                                                                                                                                                                                                                                                                        |
| `canShare(data?)`            | `boolean`          | `false` when unsupported. Otherwise `navigator.canShare(data)` where available, else a payload check that rejects `files` on browsers without `canShare`.                                                                                                                                                                                             |
| `share(data)`                | `Promise<boolean>` | `false` without calling `navigator.share` when `canShare(data)` is false; `true` after the sheet resolves; `false` if it rejects — **including when the user dismisses the sheet**.                                                                                                                                                                   |
| `isExportSupported()`        | `boolean`          | `URL.createObjectURL` is a function.                                                                                                                                                                                                                                                                                                                  |
| `export(source, options?)`   | `Promise<boolean>` | `false` when unsupported or when any step throws. A `Blob`/`File` downloads under `filename`, else the `File`'s own name, else `"export"`. A **string** with no `filename` returns `false` — it has no name to save as. A string is wrapped in a `Blob` of type `mimeType ?? "text/plain;charset=utf-8"`.                                             |

### Options

```ts
type TransferPluginOptions = {
  clipboard?: boolean; // default: true — false skips registering $clipboard
  share?: boolean; // default: true — false skips registering $share
  export?: boolean; // default: true — false skips registering $export
  clipboardKey?: string; // default: "clipboard"
  shareKey?: string; // default: "share"
  exportKey?: string; // default: "export"
};
```

Each magic is registered independently, so a page that has no share UI can leave
`$share` unregistered rather than guarding every call site:

```ts
Alpine.plugin(transferPlugin({ share: false, exportKey: "download" }));
// → $clipboard and $download; no $share at all
```

Renaming is the only collision escape here: unlike most of the toolkit, there is
no store to move, and the three magics are three independent names.

## Browser support

| Capability            | Where it works                                                                                                                             | What this package does about it                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `navigator.clipboard` | Chromium and Firefox, Safari 13.1+ — but **secure context only**                                                                           | Falls back to `textarea` + `execCommand("copy")` in `auto`                |
| `navigator.share`     | Mobile Safari and Chromium on Android. On desktop it is Chrome/Edge only — **not** Firefox, and not enabled by default in a desktop Safari | `$share.isSupported` / `canShare()` — bind `disabled` against them        |
| `URL.createObjectURL` | Everywhere, including Safari                                                                                                               | `$export.isSupported`; the anchor is created and clicked programmatically |

The clipboard fallback is the reason to use this package over
`navigator.clipboard.writeText()`: on an insecure origin (plain-HTTP LAN address)
or an older Safari the direct call throws, while the textarea path still works —
it needs only a user gesture, which a click handler already is.

`$share` also needs a **secure context**; the controller checks
`isSecureContext` explicitly rather than only probing for the function, because
some browsers expose `navigator.share` on an insecure origin and then throw when
it is used.

## SSR

> Import-safe: no `window`/`document` is touched at import time, and every
> capability check starts with a `typeof navigator !== "undefined"` guard, so
> `isShareSupported()`, `isExportSupported()` and `canShare()` all answer `false`
> on the server instead of throwing.
>
> `copy()` is the exception: with no Clipboard API the `auto` path reaches for
> `document.createElement`, so **calling** `copy()` on the server throws. Guard
> the call site (`onMount` / a click handler) — the import itself is fine.

## Limitations

- **No tests.** `packages/transfer` has no `test/` directory, so none of this is
  covered by `vp test`. Treat it as read-from-source.
- **`share()` cannot distinguish "sent" from "cancelled".** A user dismissing
  the share sheet and a platform rejecting the payload both resolve `false`.
  Call `canShare()` first if the distinction matters.
- **`copy()` in `auto` mode can resolve without copying.** When neither the
  Clipboard API nor `execCommand` is available, the fallback's failure is
  swallowed. Use `mode: "legacy"` when you need the outcome reported.
- **`copy()` is not user-gesture aware.** Both paths need a real user gesture;
  calling it from a timer or on load fails without saying so.
- **`export()` of a string without a `filename` returns `false`** and downloads
  nothing. There is no default name.
- **`export()` resolves the object URL on the next macrotask** (`setTimeout(…,
0)`), not synchronously after the click.
- **`export()` of a `Blob` ignores `mimeType`.** The blob carries its own type.
- **`TransferMagic` is a fiction with no producer.** The plugin never returns
  one object holding all three magics; do not expect a `transferPlugin()` result
  to be castable to it.
- **`TransferOptions` and `TransferPluginOptions` are duplicates.** Use
  `TransferPluginOptions`; it is what the factory is typed with.

## Size

`3.01 kB raw / 1.24 kB gzip` · budget `2.5 kB` · externalized peers: `alpinejs`,
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
