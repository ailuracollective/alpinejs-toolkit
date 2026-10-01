---
title: Lang
---

@ailura/alpinejs-lang

A `lang` store for the current language, detected from the browser and changeable at
runtime. The plugin owns detection and normalization; you render the copy.

## Install

```sh
pnpm add alpinejs @ailura/alpinejs-lang
```

## Register the plugin

Do this once, before `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import langPlugin from "@ailura/alpinejs-lang";

Alpine.plugin(langPlugin());

Alpine.start();
```

That registers a `lang` store, so everything below is reachable at `$store.lang`.

## Minimal example

Detect on load, let the user switch, and fall back when the tag is not available.

```html
<div x-data>
  <p>
    Current: <span x-text="$store.lang.current"></span> (<span x-text="$store.lang.base"></span
    >-<span x-text="$store.lang.region"></span>)
  </p>
  <p>Detected from the browser: <span x-text="$store.lang.isDetected"></span></p>

  <button @click="$store.lang.set('es-AR')">Español</button>
  <button @click="$store.lang.set('en-US')">English</button>
  <button @click="$store.lang.reset()">Reset to detected</button>
</div>
```

`isDetected` is the one to branch on. It is `false` when the language came from your
own fallback rather than from the user, which means telling someone "English" when
they never chose it is a real risk.

## Normalizing tags

`normalize` decides what counts as the same language. With it on, `es`, `es-AR` and
`es-MX` are treated as the same base language, which is what you want for a site that
ships one Spanish translation.

```ts
langPlugin({ normalize: true });
```

Turn it off when region genuinely changes the copy — currency, date formats, or
different legal text.

## Checking before you branch

`is(tag)` and `includes(tag)` are what to use instead of comparing strings yourself,
because they honour the normalization you configured. `is()` answers about the active
tag; `includes()` answers about the browser's preferred-language list.

```js
$store.lang.is("es"); // true when the current language is Spanish, in any region
$store.lang.includes("es-AR"); // true when the user prefers es-AR at all
```

`base`, `region`, `languages`, and `fallback` are all readable, so you can build a
language switcher without hardcoding the list.

## API reference

| Name                        | Type   | Purpose                                                  |
| --------------------------- | ------ | -------------------------------------------------------- |
| `$store.lang.current`       | store  | The active language tag.                                 |
| `$store.lang.base`          | store  | The base language, e.g. `es` for `es-AR`.                |
| `$store.lang.region`        | store  | The region, or `null`.                                   |
| `$store.lang.languages`     | store  | The languages the user prefers, in order.                |
| `$store.lang.fallback`      | store  | The language used when nothing matches.                  |
| `$store.lang.isDetected`    | store  | Whether the current language came from the browser.      |
| `$store.lang.set(tag)`      | method | Change the language.                                     |
| `$store.lang.reset()`       | method | Go back to the detected language.                        |
| `$store.lang.is(tag)`       | method | Whether the current language is this one.                |
| `$store.lang.includes(tag)` | method | Whether the user's preferred languages include this one. |

## Plugin options

```ts
langPlugin({ fallback: "en-US", normalize: true });
```
