# Demo page template

Every file in `apps/demo/src/components/demos/` is a published page: it is the
only documentation a reader gets for that package, and it is the only place the
package's behaviour is shown rather than described. This file is the contract
those pages follow.

The rules are split three ways, and the split matters:

| Where                          | What                           | Enforced by                                 |
| ------------------------------ | ------------------------------ | ------------------------------------------- |
| **This file**                  | How a page is put together     | `apps/demo/test/demo-page-contract.test.ts` |
| **This file**                  | Whether a page proves anything | `apps/demo/test/demo-page-contract.test.ts` |
| **"Judged by review"** (below) | What a test cannot decide      | A human reading the diff                    |

Paths are written from the repo root. Run commands from the repo root too; the
test lives at `apps/demo/test/demo-page-contract.test.ts` and its helpers at
`apps/demo/test/helpers/`.

There are 37 demo pages, one per catalog entry with `demo: { available: true }`.

An un-runnable rule does not belong in a test file — it is a rule nobody
follows. So everything checkable is checked, and everything else is written
down here and left to review.

---

## The one-paragraph version

A demo is a **fragment**, not a page. It renders exactly one `DemoSection`,
sourced entirely from the catalog, containing examples that **call the real
package** and nothing else. Each example is a `DemoExample` and carries the code
that produced it. It does not lay out, does not take props, does not print the
package name, and does not reimplement what it is demonstrating.

---

## Anatomy

```astro
---
import { getPluginNavItem } from "../../plugin-nav";
import DemoExample from "../DemoExample.astro";
import DemoSection from "../DemoSection.astro";

const plugin = getPluginNavItem("<catalog-id>")!;
---

<DemoSection id={plugin.id} title={plugin.title} api={plugin.api} description={plugin.description}>
	<DemoExample title="…" note="…" code={SOME_CODE}>
		<!-- the working markup -->
	</DemoExample>
</DemoSection>
```

That is the whole shell. `pages/[plugin].astro` already composes the
layout, the breadcrumbs, the page header, the kind/API/package badges, the
README link and the prev/next pager. A demo that renders any of them is
duplicating the route, and the two copies drift.

`import DemoButton from "../astro/DemoButton.astro"` belongs in the frontmatter
only if the page actually has a `DemoButton` — 4 of 37 pages (`ChildDemo`,
`AccordionDemo`, `EnvDemo`, `GestureDemo`) legitimately omit it. `DemoExample`
and `DemoSection` are always there.

### What the route gives you, so you do not

- title, description, package name, surface badge
- breadcrumbs, sidebar, prev/next pager
- the theme, the font, the overlay portal (`#overlay-root`), the toast renderer
- the Alpine boot: `src/alpine-boot.ts` registers 36 toolkit plugins plus 4
  `@alpinejs/*` companions on one Alpine instance before any page runs

### Registering the page

Five places, and only the first three are obvious:

1. `src/catalog/entries.ts` — `entry({ id, …, demo: { available: true } })`
2. `src/demo/playground-demos.ts` — the key in `PLAYGROUND_DEMOS`
3. `src/components/demos/<Pascal>Demo.astro` — the file itself
4. `src/plugin-nav-icon-names.ts` — the icon name
5. `src/alpine-boot.ts` — the import and the `alpine.plugin()` call

Nothing about the demo works without step 5: `genuine/known-store`,
`genuine/known-magic` and `genuine/known-directive` all resolve against what is
registered there, and the page is inert without it.

Step 2 is the one no test covers. `PLAYGROUND_DEMOS` is a map of `.astro`
components, and `apps/demo/test/playground-demos.test.ts` cannot import it — it
checks catalog→file and catalog→icon instead. A missing map entry is caught only
when `pages/[plugin].astro` throws `Missing playground demo for plugin` at
build time. Every other step above is asserted by a test.

If the page uses an `Alpine.data` component or a factory from `src/demo/`, that
has to be registered in `src/demo/demo-data-registration.ts` too, or
`genuine/delegated-component-exists` fails.

`demo.componentId` is not read by anything. Do not add it.

---

## Rules

### Structure

| Code                             | Rule                                                                                                                                         |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `structure/one-demo-section`     | Exactly one `<DemoSection>` per page.                                                                                                        |
| `structure/section-is-root`      | It is the page's root element.                                                                                                               |
| `structure/section-from-catalog` | It receives `id`/`title`/`api`/`description` from `plugin.*`.                                                                                |
| `structure/catalog-lookup`       | The id in `getPluginNavItem("…")` is the page's own catalog id.                                                                              |
| `structure/no-title-slot`        | Never `slot="title"` — it hand-writes a header the catalog already describes.                                                                |
| `structure/no-page-chrome`       | No `PlaygroundLayout`, `BaseLayout`, `PlaygroundPageHeader`, `PlaygroundPluginPager`, `PlaygroundModuleCard`, `DemoSidebar`, `DemoOverview`. |
| `structure/no-nested-card`       | No `Card*` from `@/components/ui/`. `DemoSection` is already the card.                                                                       |
| `structure/no-props`             | No `Astro.props`, no `interface Props`. A demo is rendered as `<Demo />`.                                                                    |
| `structure/registered`           | A page exists only for a catalog entry that says `demo.available`.                                                                           |

### Genuineness

These are the rules that matter. A demo's entire claim is _this is what the
package does_, and every one of these failures is silent: the page renders, the
markup reads correctly, and nothing warns you.

| Code                                 | Rule                                                                                                                                                                                                                          |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `genuine/uses-own-package`           | The page reads a member of **its own** package's surface, or calls its magic, or uses its directive, or delegates to an `Alpine.data` component. A page that would render identically with the package deleted is not a demo. |
| `genuine/declared-member`            | Every `$store.x.y` and `$x.y` names a member the **owning** package actually declares. Not "some package declares it" — the one that owns `x`.                                                                                |
| `genuine/known-store`                | Every `$store.x` is a store a package registers.                                                                                                                                                                              |
| `genuine/known-magic`                | Every `$x` is a magic a package registers, or one of Alpine's own.                                                                                                                                                            |
| `genuine/known-directive`            | Every `x-thing` is either Alpine's, an `@alpinejs/*` companion, or a directive a package registers.                                                                                                                           |
| `genuine/delegated-component-exists` | `x-data="name"` names an `Alpine.data` that `src/demo/` actually registers.                                                                                                                                                   |

Each of these is checked against the packages' own declarations — the
`*Store`/`*Magic` types and the `DEFAULT_*_KEY` constants, read with the
TypeScript compiler. Nothing in the test is a hand-written list of member names,
so it cannot go stale.

**The binding attributes that are scanned.** `allAlpineExpressions` in
`apps/demo/test/helpers/demo-source.ts` matches `x-data`, `x-text`, `x-html`,
`x-show`, `x-if`, `x-for`, `x-model`, `x-effect`, `x-init`, `x-bind:*`, every
`:attr` and every `@event`. All of them are read for stores, magics and
directives — so a `$machine(…)` call inside an `x-init` is checked, and
`StateMachineDemo` only passes because of it. (`x-data` is the one exception,
and deliberately: it _defines_ the scope rather than reading it, which is the
distinction the template-scope test turns on. `bindingExpressions` excludes it,
and `dataExpressions` reads it separately.)

The seven packages the convention does not cover are listed, with their reason,
in `SURFACE_OVERRIDES` in `apps/demo/test/helpers/package-surface.ts`: `child`,
`query-adapter-alpine`, `query-adapter-nanostores`, `query-adapter-zustand`,
`core`, `json-api` and `state-machine`. The three adapters are empty lists
because they register a store belonging to `query`, and none of them declares a
`*Store`/`*Magic` of its own. Adding a package there is a claim that its demos
are checked against that list instead.

### Consistency

| Code                            | Rule                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tokens/no-foreign-tokens`      | Nine strings from the old shadcn theme are banned: `bg-background`, `text-foreground`, `text-muted-foreground`, `bg-muted`, `border-input`, `ring-primary`, `ring-ring`, `ring-offset`, `hsl(var(--`. The design system is the `--ios-*` scale in `src/styles/global.css`. Tailwind's own palette utilities (`bg-sky-200`, `text-green-600`) are fine and used on real pages. |
| `controls/use-demo-button`      | Page actions go through `DemoButton`, which carries the focus ring, the press effect and the sizing.                                                                                                                                                                                                                                                                          |
| `layout/no-package-footer`      | Do not print the package name — `PlaygroundPageHeader` already does.                                                                                                                                                                                                                                                                                                          |
| `a11y/x-show-needs-cloak`       | An element with `x-show` also has `x-cloak`, or sits inside a `<template x-if>` (never server-rendered, so it cannot flash).                                                                                                                                                                                                                                                  |
| `examples/use-demo-example`     | Every example is wrapped in a `<DemoExample>`. A page is not a wall of sibling `<div>`s — that is a list of demos, and the reader gets no title, no note and no code for any of them.                                                                                                                                                                                         |
| `examples/example-has-title`    | Each `<DemoExample>` has a `title` saying what it demonstrates.                                                                                                                                                                                                                                                                                                               |
| `examples/example-has-code`     | Each `<DemoExample>` has a `code` prop holding the markup and calls that produce the example above it. See below.                                                                                                                                                                                                                                                             |
| `testable/has-testid`           | The page exposes at least one `data-testid`.                                                                                                                                                                                                                                                                                                                                  |
| `testable/testid-on-an-element` | A `data-testid` is an attribute on a tag, never a bare line. A bare one is a JSX text node: it compiles, it passes the rule above, and it renders as visible text while hooking nothing.                                                                                                                                                                                      |

That list is the complete set of codes `demo-page-contract.test.ts` enforces.
There are no others, and it enforces none that are not listed here.

**The `DemoButton` exceptions.** A raw `<button>` is correct — and required —
in two cases, both because the package owns the element:

- **The element's meaning is the package's.** An accordion trigger, a tab, a
  listbox option, a carousel indicator. They take their semantics from a
  `*Props()` binding or an ARIA `role` the package computes, and a chrome
  variant class would override exactly the attributes being demonstrated.
- **The button is the _child_ of `x-child`.** `x-child` merges classes and
  attributes from its wrapper onto one real element, so that child has to be a
  plain tag; an Astro component would not receive the merge. This is also why
  `ChildDemo`'s inline-style example cannot be a `DemoButton` — the component
  takes no `style`.

Everywhere else, use `DemoButton`. Where a bespoke look is the point, the answer
is `<DemoButton variant="ghost" class="…">`, not a raw element: the component
takes a `class`, and the variant is still consistent.

**Every example shows its code.** `DemoExample` renders a `<details>`: the
working example, and under it the source that produced it. Pass it for every
example on the page.

This is the rule that makes a demo usable rather than merely convincing. A
rendered result is not documentation of a library: `$store.collection` handing
back a page of filtered items, `$machine({…})` reading its own state, a
`register('faq')` call that an accordion needs before `toggle()` does anything —
none of that is inferable by looking at it. The reader's question is always
"what do I write?", and the answer has to be on the page, copy-pasteable, next
to the thing it produced.

`StateMachineDemo` is the reference: four examples, four `*_CODE` constants in
the frontmatter, each one the real `x-data` and the real calls of the example
underneath it, with a short comment on the line a reader would get wrong.

A page with no example at all is not exempt. If a package has one behaviour
worth showing, that is one example, and it carries its code too.

### What this does not check

- **Members past the first hop.** `$env.battery` is checked against `EnvMagic`;
  `$env.battery.voltage` is not. A flat list of names cannot tell an instance id
  in a `Record` (`$store.form.instances.demo`) from a type member, an array
  method (`.join`, `.map`) from a package one, or a nested type declared inline
  from a missing field. Checking them anyway produced forty false positives and
  a rule nobody would keep. A deep typo costs an `undefined` at evaluation time,
  which is loud.
- **Syntax.** The contract reads text, so it can pass on a file that does not
  compile. `pnpm --filter @ailura/demo check` is the second opinion, and it has
  caught things this could not.
- **Whether a `code` sample is the real thing.** `examples/example-has-code`
  checks that the prop is there. It cannot tell a sample lifted from the example
  above it from a plausible paraphrase, and it cannot tell markup from prose. If
  the sample drifts, it drifts silently — see "Judged by review".
- **Whether every _thing on the page_ is an example.** The lint sees whether a
  page uses `DemoExample` at all and whether each one is titled and coded. It
  cannot decide that a bare `<div>` at top level is a second example that
  escaped the wrapper, because "is this an example" is a judgement about intent.

### Judged by review

These are real and they are not machine-checkable. They are in this list
because leaving them out of the file would be dishonest about what the lint
covers.

- **Does the demo reimplement the package?** The clearest instance found so far
  was `src/demo/calendar-demo.ts`, which hand-built the 42-cell month grid and
  the `isToday`/`isRangeStart`/`isInRange` predicates that
  `CalendarController.weeks` already computes — and disagreed with it, being
  Monday-first where the package is Sunday-first. It did that because the store
  exposed only `month`/`mode`/`selected`, so the fix was in the package, not the
  demo: `weeks` and `weekdayLabels` are forwarded now and the demo reads them.
  **When you find yourself recomputing something a package owns, the package is
  usually missing a surface.** Ask what the page would look like with the
  package deleted; if the answer is "the same", the example is the demo's own
  work.
- **Is the demo using the package's own binding?** `CarouselDemo` used to carry
  its own `create()` + double-`$nextTick` + `querySelector` while the package
  shipped `x-carousel`, which does both in one attribute. Every call it made was
  real, so nothing was broken — the page just overstated how much wiring the
  package still asks for. All ten of its examples now use `x-carousel`. When a
  package has a directive for something, a demo demonstrating that directive
  should use it.
- **Are the examples distinct, or copy-paste?** `TooltipDemo` had eight copies
  of one block differing only in the `x-anchor` modifier, and that was wrong
  because the modifier _is_ the example; it is one generated block over a
  `PLACEMENTS` array inside a single `DemoExample` now. `CarouselDemo` has ten
  similar-looking blocks and they are right, because each shows a different
  feature and the side-by-side concrete view is the point. The test is whether
  collapsing them would make the reader compare config objects instead of seeing
  behaviour.
- **Is the claim still true?** Several demos document package defects
  deliberately (carousel's no-op `pause()`, dialog's absent focus management,
  overlay's `configure()` invariant). Those are the strongest thing in the set
  and they rot silently. Re-verify them when the package changes.
- **Does the code sample match the example above it?** `DemoExample`'s `code`
  is prose with a monospace font. Nothing checks it. The failure is specific and
  has happened here: `StateMachineDemo` shipped a `GUARD_CODE` whose last line
  was `<div x-text="gated.send('OPEN')"></div>`, which is not what the example
  renders, and whose `x-data` was missing the `last` the sample referenced. A
  sample that is a plausible-looking paraphrase is worse than none, because a
  reader copies it. Lift the real `x-data`, the real event bindings and the real
  store calls; if the example was built from a module in `src/demo/`, the sample
  has to show the markup that mounts it, not the module's internals.
- **Is the sample honest about the trap?** The best samples in the set carry a
  one-line comment on the line that bites: the guard that needs `x-init`
  because `this` is not the Alpine proxy inside an object literal; `can()` that
  checks the edge exists and not that the guard passes; a `register()` the
  `toggle()` silently no-ops without. If you found a trap while writing the
  example, it belongs in the sample — the reader hits it before you do.
- **Is the demo honest about browser support?** A demo that silently does
  nothing in Firefox is worse than one that says so.
- **Does the page own its layout?** Content inside a closed `<details>` has no
  box, so a virtualised list or a carousel viewport starts at zero height. Pass
  `open` to any example that measures itself.
- **Is every link real?** A dead `<a href>` in a demo is a 404 a reader finds
  before you do. A `/plugins/...` link must resolve to a real page under
  `apps/docs/src/content/docs/plugins/<layer>/`, and it should be built with
  `docsPageUrl()` from `src/config/urls.ts` rather than written as a literal —
  `ChildDemo` once pointed at `/docs/plugins/child/`, which has never existed.

---

## Writing an example

**Wrap it in `DemoExample` and give it the code.** A new example is a
`<DemoExample title=… note=… code={…}>` around the working markup, plus a
`const` in the frontmatter holding that same markup:

```astro
---
const ISOLATION_CODE = `x-data="{
  list: $machine({ initial: 'idle', transitions: [
    { name: 'LOAD',  from: 'idle', to: 'loading' },
    { name: 'READY', from: 'loading', to: 'ready' },
  ] }),
  detail: $machine({ initial: 'closed', transitions: [
    { name: 'OPEN', from: 'closed', to: 'open' },
  ] }),
}"

<button @click="list.send('LOAD')">list → <span x-text="list.state"></span></button>`;
// ──

<DemoExample
  title="Each $machine(config) is a different machine"
  note="…"
  code={ISOLATION_CODE}
>
  <div x-data="{ list: $machine({ … }) }">…</div>
</DemoExample>
```

- `title` — what this example demonstrates, as a claim, not a label. "Cancels
  the transition", not "Guards".
- `note` — one line on when to reach for this rather than plain Alpine. Omit it
  only when the title already says it.
- `code` — the real `x-data`, the real event bindings, the real store calls. If
  the example is built from a module in `src/demo/`, show the markup that mounts
  it, not the module's internals. Comments inside the sample are welcome and
  should mark the line a reader would get wrong.
- `open` — only for the page's headline example, and for any example that
  measures its own layout (a closed `<details>` has no box).

**Keep the Alpine state in `src/demo/*.ts` once it stops being two lines.** A
`x-data` string literal is fine for a boolean. Past that, move it to a module
and register it with `Alpine.data` in
`src/demo/demo-data-registration.ts` — the contract test then resolves the page
against that module instead of against the template, and `x-init` gets out of
the markup. The `code` sample still shows the `x-data` that mounts it, so
nothing is hidden from the reader.

**Wrap multi-statement `x-init` in an IIFE.** Alpine compiles `x-init` to
`let __result = <expression>`, so with several statements only the first one's
value lands in `__result` — and a registration function returns an unregister
disposer, which Alpine then invokes. A bare list of `register()` calls disposes
the first one on mount. See `KeyboardDemo.astro` for the worked example.

**Unregister before registering.** The playground uses Astro view transitions, so
`x-init` runs again on every visit, and `register()` throws on a duplicate id.

**Use `x-cloak` on anything conditionally visible.** `x-show` sets `display`
when Alpine boots, so without it the element is in the HTML and hides itself a
frame later. `a11y/x-show-needs-cloak` enforces it.

**Motion is handled once, globally.** Do not add `motion-reduce:` to a demo.
`x-transition` and `x-collapse` set `transition` inline, so a utility on the
element loses to the inline style; `src/styles/global.css` has a
`prefers-reduced-motion` block that zeroes their duration instead, and it
covers the chrome and every demo at the same time. What a page still owns is
whether it _animates at all_ — reach for a CSS transition over a JS one, and
never start an animation on load that the reader did not ask for.

---

## Migrating an existing page

Run the contract and fix what it reports:

```sh
pnpm exec vp test apps/demo/test/demo-page-contract.test.ts
```

Each failure carries a code and a one-line reason.

`DEFERRED` at the top of the test file waives a rule per page. It is a worklist,
not a configuration option: a second test fails if an entry waives a rule the
page no longer breaks, so an entry disappears the moment the page is fixed. Do
not add an entry to silence something you have not fixed. There are none today.

---

## Adding a package's demo

1. `entry({ …, demo: { available: true } })` in `src/catalog/entries.ts`
2. `src/components/demos/<Pascal>Demo.astro`, from the shape at the top of this file
3. the key in `PLAYGROUND_DEMOS` in `src/demo/playground-demos.ts`
4. an icon name in `src/plugin-nav-icon-names.ts`
5. the import and the `alpine.plugin()` call in `src/alpine-boot.ts`
6. anything in `src/demo/` the page needs, registered in
   `src/demo/demo-data-registration.ts`
7. `pnpm exec vp test apps/demo/test` — the catalog, navigation and contract
   tests cover steps 1, 2, 4 and 5, and will say which you missed

Step 3 is the only one no test can catch: `PLAYGROUND_DEMOS` is a map of
`.astro` components, so a missing entry surfaces as a
`Missing playground demo for plugin` throw at build time. Run
`pnpm --filter @ailura/demo build` if you want it checked rather than
discovered.

Some packages also appear in hand-written id lists inside the tests —
`catalog.test.ts` (the `permissions`, `query-stack` and `surfaces` groups) and
`playground-navigation.test.ts` (the `query-stack` order). If the new package
belongs to one of those families, add it there too.

## Adding a new rule

Put it in `demo-page-contract.test.ts` with a `group/name` code, a `testable/`
prefix if it is about hooks rather than structure, and a sentence saying what
failure it catches and why. If it cannot be decided from the file's text, it
belongs in "Judged by review" instead.

Add the code to the table at the top of this file in the same edit. The tables
above are meant to be the complete list of what the contract enforces; a rule
that is enforced but undocumented is one nobody follows.
