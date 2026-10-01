/**
 * The demo page contract.
 *
 * Every file in `src/components/demos/` is a published page for one package, so
 * the 37 of them are read far more often than they are written. A playground
 * that drifts is not a slow drift: the audit behind this test found ten raw
 * `<button>` variants, two coexisting design-token systems, a card nested in a
 * card, three packages' worth of hand-rolled copy-paste, and a page
 * (`CoreDemo`) whose output would be byte-identical if the package were
 * removed from the build. None of that is visible from any one file.
 *
 * The rules are therefore split in two.
 *
 * **Structure** — how a page is put together. One `DemoSection`, sourced from
 * the catalog, no page chrome, no props. All of it is decided by
 * `pages/[plugin].astro`, which already composes the header and the
 * pager, so a demo that adds its own is duplicating, not extending.
 *
 * **Genuineness** — whether the page proves anything. This is the part that
 * matters and the part that no existing check covered. A demo's whole claim is
 * "this is what the package does", and the failure mode is silent: a renamed
 * method, a dropped option, a hand-rolled stand-in for a capability the
 * package already ships. Each rule below is checked against the *packages' own
 * declarations* (see `helpers/package-surface.ts`), not against a list written
 * here, so the check cannot drift away from the thing it is checking.
 *
 * A rule that cannot be decided statically is not in this file. It is in
 * `agents/DEMO.template.md` under "Judged by review", which is the honest place
 * for it: an un-runnable rule in a test file is a rule nobody follows.
 *
 * Every rule has a code. Fix the violation rather than the code, and if a rule
 * is genuinely wrong for a real case, say so in `DEFERRED` below with the
 * reason — an exemption nobody can see the reasoning for is just a hole.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vite-plus/test";

import { getCatalogEntry, getPlaygroundCatalogEntries } from "../src/catalog/index.js";
import { allAlpineExpressions, demoNameToId, pascal, readDemos } from "./helpers/demo-source.js";
import {
  getPackageRegistry,
  hasDeclaredSurface,
  membersFor,
  PACKAGES_ROOT,
  SURFACE_OVERRIDES,
} from "./helpers/package-surface.js";

/** `src/demo/`, where a page may keep its Alpine state instead of inlining it. */
const DEMOS_SUPPORT_DIR = new URL("../src/demo/", import.meta.url).pathname;

let alpineDataNames: Set<string> | undefined;

/**
 * The `Alpine.data(…)` names the demo app registers, read from the source that
 * registers them rather than from a list here. `x-data="calendarDemo"` is only
 * meaningful if that exact name was handed to `Alpine.data`, and the app's own
 * `alpine-boot.ts` boots a fixed set of plugins — a name in a page that nothing
 * registers is a page that throws on the first binding it evaluates.
 */
function registeredAlpineData(): ReadonlySet<string> {
  if (alpineDataNames) return alpineDataNames;
  const names = new Set<string>();
  for (const file of readdirSync(DEMOS_SUPPORT_DIR)) {
    if (!file.endsWith(".ts")) continue;
    const source = readFileSync(join(DEMOS_SUPPORT_DIR, file), "utf8");
    for (const [, name] of source.matchAll(/Alpine\.data\(\s*"([\w$]+)"/g))
      names.add(name as string);
  }
  alpineDataNames = names;
  return names;
}

/**
 * Alpine's own magics. A `$name` that is neither here nor registered by a
 * package is a typo, and a typo in a magic name throws at evaluation time
 * inside a string that reads perfectly well.
 */
const ALPINE_MAGICS = new Set([
  "store",
  "el",
  "event",
  "refs",
  "id",
  "data",
  "dispatch",
  "watch",
  "nextTick",
  "root",
  "inspect",
  "alpine",
]);

/**
 * Alpine's own directives and helpers, which a demo may obviously use. The
 * `@alpinejs/*` companions (`anchor`, `collapse`, `morph`, `persist`) are
 * registered by `src/alpine-boot.ts` alongside the toolkit and are listed here
 * too, because they are genuinely not the demoed package.
 */
const ALPINE_BUILTINS = new Set([
  "cloak",
  "data",
  "text",
  "html",
  "show",
  "if",
  "for",
  "model",
  "modelable",
  "init",
  "effect",
  "ref",
  "id",
  "bind",
  "on",
  "transition",
  "inert",
  "teleport",
  "ignore",
  "anchor",
  "collapse",
  "morph",
  "persist",
  "trapsnap",
]);

/** Components that own page chrome. A demo importing one is duplicating the route. */
const PAGE_CHROME = [
  "PlaygroundLayout",
  "BaseLayout",
  "PlaygroundPageHeader",
  "PlaygroundPluginPager",
  "PlaygroundModuleCard",
  "DemoSidebar",
  "DemoOverview",
];

/** The shadcn tokens that leaked in from before the design system was iOS. */
const FOREIGN_TOKENS = [
  "bg-background",
  "text-foreground",
  "text-muted-foreground",
  "bg-muted",
  "border-input",
  "ring-primary",
  "ring-ring",
  "ring-offset",
  "hsl(var(--",
];

/**
 * Known violations, carried so the suite is green and the list doubles as the
 * worklist. Each entry is a demo id and the rule codes it breaks; a code
 * appearing here means "decided, not done", and deleting the entry is how a
 * page graduates. Nothing may be added here without a reason in the template's
 * "Migrating an existing page" section.
 */
const DEFERRED: Record<string, readonly string[]> = {};

const registry = getPackageRegistry();
const demos = readDemos();

/**
 * True when the match at `index` sits inside a `<template x-if>`.
 *
 * `x-if` content is never server-rendered, so it cannot flash: the element and
 * its condition appear in the same frame. `x-show` is the opposite — the
 * element is in the HTML and the hiding happens when Alpine boots.
 */
function insideXIf(body: string, index: number): boolean {
  const open = [...body.slice(0, index).matchAll(/<template\b[^>]*\bx-if(?:=|\s|>)/g)].at(-1);
  if (!open) return false;
  return !body.slice(open.index).includes("</template>");
}

/** `.a?.b.c` → `["a", "b", "c"]`. */
function chainOf(suffix: string): string[] {
  return Array.from(suffix.matchAll(/\??\.([A-Za-z_$][\w$]*)/g), (match) => match[1] as string);
}

/**
 * True when the match at `index` sits inside an `x-child` wrapper — that is,
 * after an `x-child`/`x-child.replace` opening tag and before the next one
 * closes. The child of `x-child` has to be a plain element, so a raw `<button>`
 * there is the demo working, not the demo drifting.
 */
function isInsideXChild(body: string, index: number): boolean {
  const before = body.slice(0, index);
  const open = [...before.matchAll(/<(span|div)\b[^>]*\bx-child(?:\.replace)?\b[^>]*>/g)];
  const last = open.at(-1);
  if (!last) return false;
  const tag = last[1] as string;
  const afterOpen = before.slice((last.index ?? 0) + last[0].length);
  const closes = (afterOpen.match(new RegExp(`</${tag}>`, "g")) ?? []).length;
  return closes === 0;
}

/**
 * Check the first member read off a store or a magic.
 *
 * First hop only, and deliberately. It is checked against the store's own
 * declared type, so `$store.toast.open` fails even when another package exports
 * something called `open` — which is the failure that matters, because it is
 * what a renamed or dropped method produces.
 *
 * Later hops are not checked. A flat list of member names cannot tell an
 * instance id in a `Record` (`$store.form.instances.demo`) from a type member,
 * an array method (`.join`, `.map`) from a package one, or a nested type
 * declared inline inside `EnvMagic` from a missing field. Checking them anyway
 * produced forty false positives on the existing pages and a rule nobody would
 * keep. A deep typo costs an `undefined` at evaluation time, which is loud.
 */
function checkChain(context: {
  label: string;
  chain: string[];
  owners: string[];
  surface: ReadonlySet<string>;
  owner: string;
  add: (code: string, detail: string) => void;
  used: Set<string>;
}): void {
  const { label, chain, owners, surface, owner, add, used } = context;
  const [head] = chain;
  if (head === undefined) return;
  if (!surface.has(head)) {
    add(
      "genuine/declared-member",
      `${label}.${head} is not in the public surface of ${owners.join(" or ")}`
    );
    return;
  }
  if (owners.includes(owner)) used.add(head);
}

/** Every rule broken by a demo, as `code: detail` strings. */
function violationsFor(demo: (typeof demos)[number]): string[] {
  const violations: string[] = [];
  const add = (code: string, detail: string) => violations.push(`${code} — ${detail}`);
  const entry = getCatalogEntry(demo.id);

  // ── structure ──────────────────────────────────────────────────────────

  const sections = demo.body.match(/<DemoSection[\s>]/g) ?? [];
  if (sections.length !== 1) {
    add(
      "structure/one-demo-section",
      `has ${sections.length} <DemoSection> elements; a page is exactly one section`
    );
  } else if (!/^\s*<DemoSection[\s>]/.test(demo.body)) {
    add("structure/section-is-root", "the page's root element is not <DemoSection>");
  }

  if (entry) {
    const lookup = new RegExp(`getPluginNavItem\\(\\s*"${demo.id}"\\s*\\)`).test(demo.frontmatter);
    if (!lookup) {
      add(
        "structure/catalog-lookup",
        `frontmatter does not look the plugin up as getPluginNavItem("${demo.id}")`
      );
    }
    for (const prop of [
      "id={plugin.id}",
      "title={plugin.title}",
      "api={plugin.api}",
      "description={plugin.description}",
    ]) {
      if (!demo.body.includes(prop)) {
        add("structure/section-from-catalog", `DemoSection is missing ${prop}`);
      }
    }
  } else {
    add("structure/registered", "no catalog entry has this id, so no page route exists for it");
  }

  if (/\bslot="title"/.test(demo.body)) {
    add(
      "structure/no-title-slot",
      'DemoSection slot="title" hand-writes the header; pass title/api so the card is uniform'
    );
  }

  for (const component of PAGE_CHROME) {
    if (new RegExp(`import\\s+${component}\\b`).test(demo.frontmatter)) {
      add("structure/no-page-chrome", `imports ${component}, which the route already renders`);
    }
  }
  if (/from\s+"@\/components\/ui\/Card/.test(demo.frontmatter)) {
    add(
      "structure/no-nested-card",
      "imports a Card primitive; DemoSection is already the card, so this nests one"
    );
  }
  if (/\bAstro\.props\b/.test(demo.raw) || /\binterface Props\b/.test(demo.raw)) {
    add(
      "structure/no-props",
      "declares props; a demo is rendered as <Demo /> with nothing, and reads the catalog instead"
    );
  }

  // ── genuineness ────────────────────────────────────────────────────────

  const owner = demo.id;
  const ownMembers = membersFor(registry, [owner]);
  const usedOwnMembers = new Set<string>();
  let exercisedOwnPackage = false;
  const usedKeys = new Set<string>();

  /**
   * Alpine magics are written `$name`, not `$.name` — `$env.network.online`,
   * `$notify.send()`. Anything `$`-prefixed that is neither a magic the
   * workspace registers nor one of Alpine's own is a typo, and a typo in a
   * magic name is the most expensive kind: it throws at evaluation time,
   * inside a string that reads perfectly well.
   */
  const checkMagic = (name: string, chain: string[]) => {
    if (ALPINE_MAGICS.has(name)) return;
    const owners = registry.magics.get(name);
    if (!owners) {
      add("genuine/known-magic", `\$${name} is a magic no package registers`);
      return;
    }
    usedKeys.add(`magic:${name}`);
    // A magic that is only ever *called* — `$machine({ … })`, `$share(…)`,
    // `$clipboard(text)` — exercises its package just as much as reading a
    // member off one. `$machine` has no members to read at the call site; the
    // handle it returns does, and that handle is local.
    if (owners.includes(owner)) exercisedOwnPackage = true;
    checkChain({
      label: `$${name}`,
      chain,
      owners,
      surface: membersFor(registry, owners),
      owner,
      add,
      used: usedOwnMembers,
    });
  };

  const checkStore = (name: string, chain: string[]) => {
    const owners = registry.stores.get(name);
    if (!owners) {
      add("genuine/known-store", `$store.${name} is a store no package registers`);
      return;
    }
    usedKeys.add(`store:${name}`);
    checkChain({
      label: `$store.${name}`,
      chain,
      owners,
      surface: membersFor(registry, owners),
      owner,
      add,
      used: usedOwnMembers,
    });
  };

  // Strings and template literals in the frontmatter are code samples, not
  // live expressions; only the template body is executed by Alpine.
  for (const expression of allAlpineExpressions(demo.body)) {
    // `$store.a.b` first, so `$store` is not read as a magic of its own.
    for (const [, name, chain] of expression.matchAll(
      /\$store\.([A-Za-z_$][\w$]*)((?:\??\.[A-Za-z_$][\w$]*)*)/g
    )) {
      checkStore(name as string, chainOf(chain as string));
    }
    // A magic name starts with a letter or `_`. `$` is excluded because a
    // template literal like `` `$${price}` `` — an escaped dollar in an
    // Alpine expression, not a magic — would otherwise read as a magic
    // called `$`.
    for (const [, name, chain] of expression.matchAll(
      /(?<![\w.$])\$([a-zA-Z_][\w$]*)((?:\??\.[A-Za-z_$][\w$]*)*)/g
    )) {
      checkMagic(name as string, chainOf(chain as string));
    }
    for (const [, name] of expression.matchAll(/(?:^|\s)x-([a-z][\w-]*)/g)) {
      if (ALPINE_BUILTINS.has(name)) continue;
      if (!registry.directives.has(name)) {
        add("genuine/known-directive", `x-${name} is a directive no package registers`);
      } else {
        usedKeys.add(`directive:${name}`);
      }
    }
  }

  // A directive can also be written `x-on:`, and the toolkit's own modifiers
  // (`.replace`, `.tap`, `.pinch`, …) hang off a registered name.
  for (const [, name] of demo.body.matchAll(/(?:^|\s)x-([a-z][\w-]*)[.=]/g)) {
    if (ALPINE_BUILTINS.has(name) || registry.directives.has(name)) continue;
    add("genuine/known-directive", `x-${name} is a directive no package registers`);
  }

  // A page that keeps its Alpine state in a component from `src/demo/*.ts`
  // rather than inline proves its package just as much — the store calls live
  // there. The rule is satisfied by the delegation, provided the component
  // named is actually registered, so the exemption cannot be a typo.
  //
  // Two forms count, and only two. `x-data="calendarDemo"` names an
  // `Alpine.data` component, and `x-data={countdownTimerData(1_000)}` calls a
  // factory imported from `src/demo/`. `x-data={menuData}` interpolates a
  // frontmatter value and is still this page's own Alpine data;
  // `x-data={JSON.stringify({ … })}` is not a component at all.
  const importedFromDemo = new Set(
    Array.from(
      demo.frontmatter.matchAll(/import\s*\{([^}]*)\}\s*from\s*"[^"]*demo\/[^"]*"/g),
      (match) => match[1] as string
    )
      .flatMap((clause) => clause.split(","))
      .map(
        (clause) =>
          clause
            .trim()
            .split(/\s+as\s+/)
            .pop() ?? ""
      )
      .filter((name) => /^[A-Za-z_$][\w$]*$/.test(name))
  );

  for (const [, literal] of demo.body.matchAll(/\bx-data="([^"]*)"/g)) {
    const name = /^\s*([A-Za-z_$][\w$]*)\s*(?:\(\s*\))?\s*$/.exec(literal)?.[1];
    if (!name) continue;
    if (!registeredAlpineData().has(name)) {
      add(
        "genuine/delegated-component-exists",
        `x-data="${name}" but no Alpine.data("${name}", …) is registered in src/demo`
      );
      continue;
    }
    usedKeys.add(`component:${name}`);
  }
  for (const [, call] of demo.body.matchAll(/\bx-data=\{([A-Za-z_$][\w$]*)\s*\(/g)) {
    if (importedFromDemo.has(call)) usedKeys.add(`factory:${call}`);
  }

  // A page that never touches its own package proves nothing about it. This is
  // the rule that would have caught `CoreDemo`, which rendered
  // `Object.keys($store)` — Alpine's store bag — and would look identical with
  // the package deleted.
  const delegatesOwnPackage = [...usedKeys].some(
    (key) =>
      key.startsWith("directive:") || key.startsWith("component:") || key.startsWith("factory:")
  );
  if (
    entry &&
    ownMembers.size > 0 &&
    usedOwnMembers.size === 0 &&
    !exercisedOwnPackage &&
    !delegatesOwnPackage
  ) {
    add(
      "genuine/uses-own-package",
      `never reads a member of ${demo.id}'s own surface; the page does not demonstrate the package`
    );
  }

  // ── consistency ────────────────────────────────────────────────────────

  for (const token of FOREIGN_TOKENS) {
    if (demo.body.includes(token)) {
      add("tokens/no-foreign-tokens", `uses "${token}"; the design system is the --ios-* scale`);
    }
  }

  // `DemoButton` is the demo's only button: it carries the focus ring, the
  // press effect and the sizing, so a raw `<button>` on a page means the next
  // page's button looks different again. Where a bespoke look is the point the
  // answer is `<DemoButton class={…}>`, not a raw element — the component takes
  // a `class`, and the variant is still consistent.
  //
  // Two exceptions, both because the package owns the element:
  //
  // - A `*Props()` binding or an ARIA `role` the package computes. An
  //   accordion trigger, a tab, a listbox option, a carousel indicator: a
  //   chrome variant would override exactly the attributes being demonstrated.
  // - A button that is the *child* of `x-child`. `x-child` merges classes and
  //   attributes from its wrapper onto one real element, so that child has to
  //   be a plain tag; an Astro component would not receive the merge. This is
  //   the one case where a raw button is the only way to show the feature.
  // `title` and `note` on a `<DemoExample>` are prose: they render as text, so
  // a tag name written in one is a word, not an element. Scanning them as
  // markup produces two false failures at once — a `note` mentioning
  // `<button>` trips `controls/use-demo-button`, and its `>` truncates the
  // `<DemoExample …>` match so the real `code` prop reads as missing.
  const markup = demo.body
    .replace(/\b(?:title|note)="(?:[^"\\]|\\.)*"/g, 'title=""')
    .replace(/\bcode="(?:[^"\\]|\\.)*"/g, 'code=""');

  for (const match of markup.matchAll(/<button\b([\s\S]{0,400}?)>/g)) {
    const attributes = match[1] as string;
    if (/\brole="/.test(attributes)) continue;
    if (/x-bind="\$store\.\w+\.\w*Props\(/.test(attributes)) continue;
    if (isInsideXChild(markup, match.index)) continue;
    add(
      "controls/use-demo-button",
      "writes a raw <button> as a page action; DemoButton carries the focus ring, the press effect and the sizing"
    );
    break;
  }

  if (
    /\bPackage:\s*$|<Package:/.test(demo.body) ||
    /Package:\s*<code>\{plugin\.package\}<\/code>/.test(demo.body)
  ) {
    add(
      "layout/no-package-footer",
      "prints the package name in a footer; PlaygroundPageHeader already renders it"
    );
  }

  // `x-show` sets `display` on init, so an element without `x-cloak` is visible
  // on first paint and hides itself a frame later — a flash of exactly the
  // thing the condition says is not there. `x-cloak` is `display: none
  // !important` in `global.css`, so it is always safe to add.
  //
  // The exception is an element inside a `<template x-if>`: that content is not
  // server-rendered at all, so there is no first paint to flash.
  for (const match of demo.body.matchAll(/<[a-zA-Z][^>]*?x-show=(?:"[^"]*"|\{[^}]*\})[^>]*?>/g)) {
    const element = match[0];
    if (/\bx-cloak\b/.test(element)) continue;
    if (insideXIf(demo.body, match.index ?? 0)) continue;
    add(
      "a11y/x-show-needs-cloak",
      "uses x-show without x-cloak, so it renders before Alpine hides it"
    );
    break;
  }

  // ── examples ───────────────────────────────────────────────────────────

  // Every example lives in a `<DemoExample>`. The alternative is a page of
  // sibling `<div>`s, which reads as a list of unrelated widgets: the reader
  // gets no title saying what a block demonstrates, no note on when to reach
  // for it, and no way to copy the calls that produced it. The rendered result
  // is not documentation of a library — a reader who cannot see `$store.x`
  // being called has learned that the page works, and nothing else.
  if (!/<DemoExample[\s>]/.test(markup)) {
    add(
      "examples/use-demo-example",
      "no <DemoExample> on the page; each example needs a title, a note and the code that produced it"
    );
  }

  // `code` is the whole point of the wrapper: it is the copy-pasteable source
  // of the example above it. `note` carries the one-line "reach for this
  // rather than plain Alpine" that makes a demo a recommendation, and it is the
  // line a reader skims when deciding whether to keep reading.
  for (const match of markup.matchAll(/<DemoExample\b([\s\S]*?)>/g)) {
    const attributes = match[1] as string;
    if (!/\btitle=/.test(attributes)) {
      add(
        "examples/example-has-title",
        "a <DemoExample> has no title, so nothing says what it demonstrates"
      );
      break;
    }
  }
  for (const match of markup.matchAll(/<DemoExample\b([\s\S]*?)>/g)) {
    const attributes = match[1] as string;
    if (!/\bcode=/.test(attributes)) {
      add(
        "examples/example-has-code",
        "a <DemoExample> has no code prop, so the example cannot be copied; the rendered result is not documentation"
      );
      break;
    }
  }

  // ── testability ────────────────────────────────────────────────────────

  if (!/data-testid=/.test(demo.body)) {
    add(
      "testable/has-testid",
      "exposes no data-testid, so no browser test can address this page's controls"
    );
  }

  // A `data-testid` outside any opening tag is a text node in JSX, not an
  // attribute: it renders as visible text on the page and hooks nothing. It
  // compiles cleanly and passes the rule above, so it has to be its own check.
  for (const match of demo.body.matchAll(/data-testid="[^"]*"/g)) {
    const at = match.index ?? 0;
    const openTag = demo.body.lastIndexOf("<", at);
    if (openTag === -1) continue;
    if (demo.body.slice(openTag, at).includes(">")) {
      add(
        "testable/testid-on-an-element",
        `"${match[0]}" sits outside any tag, so it renders as text instead of attaching to anything`
      );
      break;
    }
  }

  return violations;
}

describe("demo page contract", () => {
  it("every catalog demo has exactly one page", () => {
    const catalogIds = getPlaygroundCatalogEntries()
      .map((entry) => entry.id)
      .sort();
    const pageIds = demos.map((demo) => demo.id).sort();
    expect(pageIds).toEqual(catalogIds);
  });

  it("page filenames match the catalog ids", () => {
    const wrong = demos
      .map((demo) => ({ file: demo.file, id: demoNameToId(demo.name) }))
      .filter(({ file, id }) => file !== `${pascal(id)}Demo.astro`);
    expect(wrong).toEqual([]);
  });

  it("covers every package the demos show, or says why not", () => {
    // `core` is the substrate every controller is built on: it registers no
    // store, no magic and no directive, so a demo of it can only be checked
    // against the functions listed in `SURFACE_OVERRIDES`. Everything else the
    // playground shows owns a key and has a member surface — `json-api`
    // included, since it registers `$store.jsonApi` even though the client
    // class behind it is spelled out by hand. A second package landing in this
    // list is a package the lint cannot check, which is the failure worth
    // stopping for.
    const notChecked = getPlaygroundCatalogEntries()
      .map((entry) => entry.id)
      .filter(
        (id) =>
          ![
            ...registry.stores.values(),
            ...registry.magics.values(),
            ...registry.directives.values(),
          ].some((owners) => owners.includes(id))
      );
    expect(notChecked).toEqual(["core"]);
  });

  it("derives the registry from the packages, not from a hand-written list", () => {
    // If this fails, every genuineness rule below is comparing against
    // nothing, and would pass or fail at random. The sentinels are the
    // registries' load-bearing members: one store, one magic and one
    // directive from each layer, plus a directive whose name is not its
    // package's id, since a name-mapping slip would hide there.
    const sentinels: [Map<string, string[]>, string, string | undefined][] = [
      [registry.stores, "toast", "push"],
      [registry.stores, "collection", "instances"],
      [registry.stores, "jsonApi", "findAll"],
      [registry.magics, "env", "network"],
      [registry.magics, "wakelock", "isActive"],
      [registry.magics, "machine", "can"],
      // `child` is a directive and declares no members at all, so its
      // sentinel is the key itself.
      [registry.directives, "child", undefined],
      [registry.directives, "virtual-scroll", undefined],
    ];
    for (const [map, key, member] of sentinels) {
      const owners = map.get(key);
      expect(owners, `no package claims the key "${key}"`).toBeDefined();
      if (!member) continue;
      expect(
        membersFor(registry, owners).has(member),
        `${key} is claimed by ${owners?.join(", ")}, which do not declare "${member}"`
      ).toBe(true);
    }

    // Every owner named in the registry has to be a real package, or a
    // renamed folder would leave the lint comparing against an empty set.
    for (const map of [registry.stores, registry.magics, registry.directives]) {
      for (const owners of map.values()) {
        for (const folder of owners) {
          expect(
            existsSync(join(PACKAGES_ROOT, folder, "src/index.ts")),
            `${folder} owns a registered key but has no src/index.ts`
          ).toBe(true);
        }
      }
    }

    // Every package the demos demonstrate must end up with a surface the lint
    // can read, or every member on it would be reported as invented. Collected
    // first and asserted once: a `continue` chain of conditional expectations
    // reports the first failure and hides whether the rest hold.
    //
    // `child` is exempt — a pure directive has modifiers, not members, so an
    // empty surface is correct rather than a broken declaration. `state-machine`
    // is not exempt: `$machine` is generic over the caller's own state and event
    // unions, so it is spelled out in `SURFACE_OVERRIDES` against
    // `ScopedMachineHandle`.
    const surfaceless = getPlaygroundCatalogEntries()
      .map((entry) => entry.id)
      .filter(
        (id) =>
          id !== "child" &&
          (registry.stores.has(id) || registry.magics.has(id) || id === "state-machine") &&
          membersFor(registry, [id]).size === 0
      );
    expect(surfaceless).toEqual([]);

    // The overwhelmingly common case must stay automatic. If a package's
    // declarations stop resolving, its surface goes empty and every member on
    // it starts reading as invented — a loud failure, but one that looks like
    // a broken demo rather than a broken lint. This is the tripwire.
    //
    // Both sides are derived rather than written down. The automatic side is
    // the playground pages whose owning package declares a surface; the exempt
    // side is the pages whose package is listed in `SURFACE_OVERRIDES` with its
    // reason — `core`, `child`, `json-api`, `state-machine` and the three query
    // adapters, which register a store that belongs to `query` and are checked
    // through the delegated `Alpine.data` component that calls them instead.
    // Adding a demo for a package already on that list moves neither side, so
    // no arithmetic has to be redone next time; the first assertion rejects a
    // package that has no declared surface and no stated reason for it, which
    // is the failure the hand-written allowance used to wave through.
    const pages = getPlaygroundCatalogEntries();
    const automaticPages = pages.filter((entry) => hasDeclaredSurface(entry.folder));
    const exemptedPages = pages.filter((entry) => SURFACE_OVERRIDES[entry.folder] !== undefined);
    const unexplainedPages = pages.filter(
      (entry) => !hasDeclaredSurface(entry.folder) && SURFACE_OVERRIDES[entry.folder] === undefined
    );
    expect(unexplainedPages.map((entry) => entry.id)).toEqual([]);
    expect(automaticPages.length).toBeGreaterThanOrEqual(exemptedPages.length);
  });

  it("every page follows the contract", () => {
    const failures: string[] = [];
    for (const demo of demos) {
      const waived = new Set(DEFERRED[demo.id] ?? []);
      for (const violation of violationsFor(demo)) {
        const code = violation.split(" — ")[0] as string;
        if (waived.has(code)) continue;
        failures.push(`${demo.file}: ${violation}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("does not accumulate waivers", () => {
    // A waiver is a worklist item, not a configuration option. A page that
    // no longer breaks a waived rule has been fixed and the entry is stale.
    const stale: string[] = [];
    for (const [id, codes] of Object.entries(DEFERRED)) {
      const demo = demos.find((entry) => entry.id === id);
      if (!demo) {
        stale.push(`${id}: waived but the page does not exist`);
        continue;
      }
      const actual = new Set(violationsFor(demo).map((violation) => violation.split(" — ")[0]));
      for (const code of codes) {
        if (!actual.has(code))
          stale.push(`${demo.file}: waives ${code}, which it no longer breaks`);
      }
    }
    expect(stale).toEqual([]);
  });

  it("every package the demos claim to show is present on disk", () => {
    // Guards the whole registry: a renamed package folder would silently
    // empty its surface and turn every member on it into an "invented" one.
    for (const entry of getPlaygroundCatalogEntries()) {
      expect(existsSync(join(PACKAGES_ROOT, entry.folder, "src/index.ts"))).toBe(true);
    }
  });
});
