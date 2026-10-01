---
title: Child
---

@ailura/alpinejs-child

One directive, `x-child`, that moves the element's own attributes onto its first child.
It exists so a wrapper can carry the classes and ARIA that a third-party component
needs, without you leaking that markup into the component's internals.

## Install

```sh
pnpm add alpinejs @ailura/alpinejs-child
```

## Register the plugin

Do this once, before `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import childPlugin from "@ailura/alpinejs-child";

Alpine.plugin(childPlugin());

Alpine.start();
```

That registers the `x-child` directive. There is no store and no magic.

## Minimal example

A wrapper that donates its attributes to the button inside.

```html
<div x-child class="btn btn-primary" aria-label="Save changes" data-testid="save">
  <button>Save</button>
</div>
```

`class`, `aria-label`, and `data-testid` end up on the `<button>`, and the wrapper
renders as nothing at all. The component keeps its own markup; you keep the styling
and the accessible name.

This is the `asChild` idea from React libraries, as an attribute.

## When the first child is not the element you want

Only the **first** element child receives the attributes, and a text node or comment
before it does not count. With a nested first child the donation goes one level too
deep, so keep the target as the direct first element.

```html
<!-- goes to the span -->
<div x-child class="badge"><span>New</span></div>
```

:::caution[Attributes are moved, not copied]
`x-child` transfers them. The wrapper keeps nothing, so you cannot style the wrapper
and the child with the same rule, and anything you also want on the wrapper has to be
written on a parent element instead.
:::

## API reference

| Directive         | Type        | Purpose                                                                                      |
| ----------------- | ----------- | -------------------------------------------------------------------------------------------- |
| `x-child`         | `directive` | Moves this element's own attributes onto its first element child.                            |
| `x-child.merge`   | `directive` | Same, with `class` merged: child tokens are kept and the wrapper's unique tokens appended.   |
| `x-child.replace` | `directive` | Same, with `class` taken from the wrapper alone; every other attribute overwrites the child. |

`x-child` takes no value. `x-child.merge` and `x-child.replace` are the same directive with
a mode suffix — `.merge` is the default behaviour spelled out, `.replace` makes the
wrapper win.
