/**
 * Reading a demo page as data.
 *
 * Vitest cannot transform `.astro`, so no demo page is ever executed by the
 * demo app's own tests. Everything the demo suite knows about a page it learns
 * by parsing the file. That makes this module load-bearing in a way a normal
 * test helper is not: two tests that each carry their own copy of "what counts
 * as a binding" drift apart, and the weaker one silently stops catching things.
 *
 * So the rules live here, once, and both the scope test and the page-contract
 * test use them.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const DEMOS_DIR = resolve(import.meta.dirname, "../../src/components/demos");

export interface DemoSource {
  /** `Accordion`, from `AccordionDemo.astro`. */
  name: string;
  /** `accordion`, the catalog id the page is registered under. */
  id: string;
  /** `AccordionDemo.astro` */
  file: string;
  /** The raw file. */
  raw: string;
  /** Everything before the second `---`. */
  frontmatter: string;
  /** Everything after it, with block comments removed. */
  body: string;
}

/**
 * Split an `.astro` file into frontmatter and template body.
 *
 * Comments are stripped from the body because they are prose *about* the
 * markup and routinely quote the very attribute under test — a check for
 * `x-teleport` would otherwise match the comment explaining the teleport. Block
 * comments and `<!-- -->` alike, since both are used in these files to
 * explain a non-obvious expression.
 */
export function splitAstro(source: string): { frontmatter: string; body: string } {
  const end = source.indexOf("---", 3);
  if (end === -1) return { frontmatter: source, body: "" };
  // Drop the closing fence itself, so `body` starts at the first element and a
  // check for the page's root node is not defeated by three stray dashes.
  const afterFence = source.indexOf("---", end + 3);
  return {
    frontmatter: source.slice(0, end),
    body: source
      .slice(afterFence === -1 ? end + 3 : afterFence + 3)
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/<!--[\s\S]*?-->/g, ""),
  };
}

/** `AccordionDemo.astro` → `{ name: "Accordion", id: "accordion" }`. */
export function demoNameToId(name: string): string {
  return name
    .replace(/Demo$/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase();
}

/** Every demo page, in filename order. */
export function readDemos(): DemoSource[] {
  return readdirSync(DEMOS_DIR)
    .filter((file) => file.endsWith(".astro"))
    .sort()
    .map((file) => {
      const raw = readFileSync(join(DEMOS_DIR, file), "utf8");
      const name = file.replace(/\.astro$/, "");
      const { frontmatter, body } = splitAstro(raw);
      return { name, id: demoNameToId(name), file, raw, frontmatter, body };
    });
}

/** One demo page by catalog id. */
export function readDemo(id: string): DemoSource {
  const demo = readDemos().find((entry) => entry.id === id);
  if (!demo) throw new Error(`No demo page for "${id}" in ${DEMOS_DIR}`);
  return demo;
}

/** `state-machine` → `StateMachine`. */
export function pascal(kebab: string): string {
  return kebab
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

/** Top-level bindings declared in a demo's frontmatter. */
export function frontmatterConsts(frontmatter: string): Set<string> {
  return new Set(
    Array.from(
      frontmatter.matchAll(/^\s*(?:const|let)\s+([A-Za-z_$][\w$]*)/gm),
      (match) => match[1] as string
    )
  );
}

/** Every `x-data` expression in a file, which contributes scope keys. */
export function dataExpressions(body: string): string[] {
  return Array.from(
    body.matchAll(/x-data=(?:"([^"]*)"|\{([^}]*)\})/g),
    (match) => match[1] ?? match[2] ?? ""
  );
}

/**
 * The expressions Alpine evaluates in a template: bindings, not `x-data`.
 *
 * `x-data` is excluded because it *defines* the scope rather than reading it,
 * which is the distinction the scope test turns on.
 */
export function bindingExpressions(body: string): string[] {
  const found: string[] = [];
  const attributes =
    /(?:^|\s)(x-(?:text|html|show|if|for|model|bind:[\w-]+)|:[\w-]+|@[\w.-]+)="([^"]*)"/g;
  for (const match of body.matchAll(attributes)) found.push(match[2] as string);
  return found;
}

/** Every Alpine expression in a file, `x-data` included. */
export function allAlpineExpressions(body: string): string[] {
  const found: string[] = [];
  const attributes =
    /(?:^|\s)(x-(?:data|text|html|show|if|for|model|effect|init|bind:[\w-]+)|:[\w-]+|@[\w.-]+)=(?:"([^"]*)"|\{([^}]*)\})/g;
  for (const match of body.matchAll(attributes)) found.push((match[2] ?? match[3] ?? "") as string);
  return found;
}

/** Identifiers an expression reads, ignoring `$magics` and quoted text. */
export function identifiers(expression: string): Set<string> {
  const withoutStrings = expression.replace(/"[^"]*"|'[^']*'/g, " ");
  return new Set(
    Array.from(
      withoutStrings.matchAll(/(?<![\w$.])([a-z_$][\w$]*)(?=\s*(?:\?\.|\.|\[))/g),
      (match) => match[1] as string
    )
  );
}

/**
 * Line numbers for each 1-based line of a source, so a violation can be
 * reported as `FooDemo.astro:42` rather than a bare filename. Offsets are
 * computed once per string by a linear scan, which is cheaper and clearer than
 * a regex with a global flag whose `lastIndex` leaks between calls.
 */
export function lineOf(source: string, index: number): number {
  let line = 1;
  for (let at = 0; at < index; at += 1) {
    if (source.charCodeAt(at) === 10) line += 1;
  }
  return line;
}
