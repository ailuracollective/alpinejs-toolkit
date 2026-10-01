# @ailura/alpinejs-child

<p align="center">

[![bundlephobia minzip](https://badgen.net/bundlephobia/minzip/@ailura/alpinejs-child)](https://bundlephobia.com/package/@ailura/alpinejs-child)

</p>

> `x-child` — an asChild-style directive that moves a wrapper's classes and attributes onto its first element child, so one real element ends up carrying the parent's appearance and the child's semantics.

## Installation

```sh
pnpm add @ailura/alpinejs-child alpinejs
# or
npm install @ailura/alpinejs-child alpinejs
```

Requires `alpinejs@^3.0.0` as peer. `@ailura/alpinejs-core` is a **peer
dependency**, not a dependency: no package in this toolkit has a
`dependencies` block, so the host installs it too.

## Usage

This package registers **one directive and no store or magic**. There is no
controller to drive and nothing to bind to: you write `x-child` in markup and it
does the rest.

```ts
import Alpine from "alpinejs";
import childDirective from "@ailura/alpinejs-child";

Alpine.plugin(childDirective());
Alpine.start();
```

```html
<div x-data="{ open: false }">
  <span x-child class="px-4 py-2 rounded bg-blue-500 text-white" @click="open = !open">
    <button type="button" class="font-medium">Toggle</button>
  </span>
</div>
```

The `<span>` is a wrapper that does not survive. The directive transfers its
`class` and `@click` onto the `<button>` and then morphs the wrapper away, so
what stays in the DOM is a single `<button>` with both sets of attributes. That
is the point: the wrapper supplies styling and behaviour, the child supplies the
semantics, and you get one element rather than a `<div>` inside a `<button>`.

The child must be a **plain tag**, not a component. The merge happens against
the live DOM node, so an Astro/React/Vue component boundary would be in the way
— there is no element to write to until the component has rendered, and
`x-child` will not wait for it.

### What gets transferred

For every attribute on the wrapper, other than `x-child*` itself:

| Attribute                         | Behaviour                                                                                                                                                   |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`                           | Tokens are **unioned**, the child's tokens keeping their order. `x-child.replace` takes the wrapper's value and discards the child's.                       |
| `style`                           | Merged per property: a declaration whose property the child already sets is dropped, so the child wins on conflicts. One declaration per property survives. |
| anything else                     | Copied only if the child does not already have it, so a child-set `aria-label` is never clobbered. `x-child.replace` overwrites unconditionally.            |
| `x-child*`, `x-data*`, `x-ignore` | Never transferred — the wrapper's Alpine scope belongs to the wrapper, which is about to be removed.                                                        |

### `x-child.replace`

The plain `x-child` is a union. `x-child.replace` makes the wrapper
authoritative: its `class` replaces the child's outright, and any attribute it
carries overwrites the child's value instead of deferring to it.

```html
<span x-child.replace class="px-4 py-2 rounded bg-slate-800 text-white" aria-label="Wrapper label">
  <button type="button" class="px-8 py-4" aria-label="Child label">Replace mode</button>
</span>
```

The button keeps `px-8 py-4` only if it is not in the wrapper's `class` — with
`replace`, the wrapper's whole class string wins, so the button ends up with
`px-4 py-2 rounded bg-slate-800 text-white` and `aria-label="Wrapper label"`.
Use it when the child is a third-party component whose classes you cannot edit
and you need the wrapper's variant to win outright.

## API

### Exports

| Export                        | Description                                                                                                                                                            | Type       |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `childPlugin`                 | The directive registration — `childPlugin(options?) => (alpine) => void`, callable as `Alpine.plugin(childPlugin())`                                                   | `function` |
| `DEFAULT_CHILD_DIRECTIVE_KEY` | Default directive name, `"child"` — the string inside `DEFAULT_CHILD_DIRECTIVE_KEY` is the `x-child` part of `x-child`                                                 | `const`    |
| `parseChildDirective`         | Reads a wrapper's `x-child` attribute and returns `{ mode }`, or `null` when the element carries no `x-child` attribute at all                                         | `function` |
| `findFirstElementChild`       | First element child of a wrapper, or `null`. Ignores text and comment nodes, so whitespace between tags does not shift the result                                      | `function` |
| `countElementChildren`        | Number of element children on a wrapper. Exported because it is part of the surface; the directive calls it and discards the result                                    | `function` |
| `transferAttributes`          | Performs the merge: `transferAttributes(wrapper, target, mode)`. Mutates `target` in place and returns nothing                                                         | `function` |
| `clearTransferredAttributes`  | **Does nothing.** Takes a wrapper and returns immediately. It is exported and the plugin calls it, but there is no marker attribute to key off, so no teardown happens | `function` |
| `ChildPluginOptions`          | `{ id?, directiveKey? }` — only `directiveKey` is read; `id` is accepted and ignored                                                                                   | `type`     |
| `ChildMergeMode`              | `"default" \| "merge" \| "replace"`                                                                                                                                    | `type`     |
| `ChildDirectiveConfig`        | `{ mode: ChildMergeMode }` — the parse result                                                                                                                          | `type`     |
| `ChildMorphOptions`           | `{ added?: (node: Node) => void }` — the `Alpine.morph` option the plugin uses to identify the promoted element                                                        | `type`     |
| `ChildAlpine`                 | `Alpine` narrowed to include the optional `morph` the directive needs                                                                                                  | `type`     |
| `ChildPluginCallback`         | `(alpine: Alpine) => void` — the shape `Alpine.plugin()` expects                                                                                                       | `type`     |

`childPlugin` is also the package's `default` export, so
`import childDirective from "@ailura/alpinejs-child"` is the same function.

### Options

```ts
type ChildPluginOptions = {
  id?: string; // accepted, never read
  directiveKey?: string; // default: "child"
};
```

`directiveKey` renames the attribute, so `childPlugin({ directiveKey: "as" })`
registers `x-as` and `x-as.replace`:

```ts
Alpine.plugin(childDirective({ directiveKey: "as" }));
```

```html
<span x-as class="underline"><a href="/docs">Docs</a></span>
```

### Avoiding name collisions

`guardDirective` throws a `RegistrationError` if another package has already
claimed `x-child`, which surfaces the conflict at boot rather than leaving one
plugin's directive silently winning. Rename with `directiveKey` to move the
name instead:

```ts
Alpine.plugin(childDirective({ directiveKey: "as-child" }));
```

The exported constant `DEFAULT_CHILD_DIRECTIVE_KEY` keeps the default
discoverable from TypeScript.

## How the directive runs

`x-child` is not an ordinary Alpine directive callback — it cannot be, because
the wrapper has to stop being initialised _and_ have its attributes read. The
plugin uses `Alpine.interceptInit` to run before the element's directive stack is
built, marks both wrapper and child as ignored so Alpine skips them, transfers
the attributes on `nextTick`, then replaces the wrapper with the child's
markup via `Alpine.morph` inside `Alpine.mutateDom` and re-initialises the
promoted node with `Alpine.initTree`.

That is also why this package is exempt from the controller canon
([ARCHITECTURE.md §9](../../ARCHITECTURE.md)): the work needs Alpine internals
with no framework-agnostic equivalent. What _is_ framework-agnostic — parsing
the directive and moving attributes — lives in `controller.ts` and is exported
above, so it is unit-testable without booting Alpine.

## SSR

> SSR-safe — nothing in the package touches `window` or `document` at import
> time. The directive body only runs inside `Alpine.interceptInit`, which is a
> client-side init hook, so on the server the wrapper is left as ordinary markup
> and the child is rendered in place. Register the plugin on the client where
> `Alpine.start()` runs.

The element is transferred on the first client init, so the server-rendered HTML
is the un-merged form. Do not rely on the wrapper's class for first paint
without a matching style on the child.

## Accessibility

Not applicable — this is a Primitives-layer package and it produces no roles,
ARIA attributes or key bindings. It only moves attributes a consumer has
already written, so whatever `aria-*` the child declares survives the merge
(the child's own `aria-*` wins over the wrapper's in default mode, and the
wrapper's wins under `x-child.replace`).

## Integration

- **@ailura/alpinejs-ui** — a `Portal` or overlay target that needs a single
  focusable element is a common consumer of the wrapper/child split.
- **Any Alpine component that renders a bare `<button>`** — wrap it in
  `x-child` to apply a variant class without a `class` prop on the component.

## Limitations

- **Only the first element child survives.** The wrapper is replaced wholesale
  by `target.outerHTML`, so any additional siblings are discarded. Put exactly
  one element inside.
- **No element child means a silent no-op.** A wrapper containing only text
  returns early and transfers nothing. Nothing is thrown or warned — check the
  DOM, not the console.
- **Only static attributes transfer.** Anything attached at runtime to the
  wrapper — an `addEventListener` call, a ref, a `dataset` write after init —
  does not follow. Write handlers as `@click` attributes on the wrapper.
- **The child's own `x-data` is not the wrapper's.** `x-data*` is excluded from
  the transfer, so a handler on the wrapper resolves against the wrapper's
  scope. Put the scope on a parent, not on the wrapper itself.
- **`clearTransferredAttributes()` is a no-op.** The transfer leaves no marker,
  so there is nothing to clear and nothing to undo. Do not treat it as teardown.
- **Do not put `x-child` on an `x-for` or `x-if` wrapper.** Those directives
  manage the wrapper's own lifecycle, and the morph happens on `nextTick`,
  after the list or conditional has been reconciled.
- **The child must be a plain tag.** An Astro/React/Vue component has no DOM
  node to merge onto at init time.
- **`ChildPluginOptions.id` is accepted and ignored.**
- **Attribute order carries no CSS meaning.** `x-child` unions class tokens but
  cannot make the wrapper's utility outrank the child's — that is decided by
  the stylesheet. Use `x-child.replace` if the wrapper must win.

## Size

`2.52 kB raw / 1.06 kB gzip` · budget `2 kB` · externalized peers: `alpinejs`,
`@ailura/alpinejs-core` · `size-limit` + `publint` + `attw` verified.

## Architecture

[Primitives layer](../../ARCHITECTURE.md) — an Alpine directive package, exempt
from the controller canon by design (§9). The directive body needs Alpine
internals; the pure attribute logic is exported from `controller.ts`. See
canon, guards, and SSR rules in [ARCHITECTURE.md](../../ARCHITECTURE.md).

## Testing

```sh
pnpm test              # vp test (happy-dom)
pnpm run typecheck     # tsc --noEmit
```

This package has **no test directory** — `pnpm test` in `packages/child` reports
"No test files found" and exits non-zero. The exported helpers in
`controller.ts` are the unit-testable surface.

## License

MIT
