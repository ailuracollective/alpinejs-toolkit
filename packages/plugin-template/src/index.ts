/**
 * Scaffold source. `scripts/new-plugin.mjs` copies this file and rewrites every
 * `plugin-template` / `pluginTemplate` token, so those two spellings are the
 * package name and must stay exactly as they are.
 */
import type { Alpine, DirectiveCallback } from "alpinejs";

/** Plugin name, useful for debugging and registration checks. */
export const pluginName = "plugin-template";

/** Shape of the example `pluginTemplate` store registered on Alpine. */
export interface PluginTemplateStore {
  ready: boolean;
}

/** Pure helper, kept DOM-free so it is trivially unit-testable. */
export function toUpper(value: string): string {
  return value.toUpperCase();
}

/**
 * Alpine plugin entry point.
 *
 * Deliberately the *shortest* possible plugin: it takes no `alpinejs-core`
 * peer, so the three registrations below go straight to `Alpine`. A real
 * package adds `@ailura/alpinejs-core` and routes each of them through
 * `guardDirective` / `guardMagic` / `guardStore` so a name collision between
 * two plugins throws instead of silently overwriting.
 *
 * @param Alpine - Alpine.js instance (passed by `Alpine.plugin()`).
 */
export default function pluginTemplate(Alpine: Alpine): void {
  // x-upper: uppercases once, when the directive initialises. Wrapping
  // `evaluate` in `effect()` is what would make it track later changes.
  const upperDirective: DirectiveCallback = (el, { expression }, { evaluate }) => {
    const render = () => {
      const value = expression ? String(evaluate(expression) ?? "") : (el.textContent ?? "");
      el.textContent = toUpper(value);
    };
    render();
  };
  Alpine.directive("upper", upperDirective);

  // $greet magic: `$greet('Ada')` -> 'Hello, Ada!'
  Alpine.magic("greet", () => (name: string) => `Hello, ${name}!`);

  // Example store so the template shows the store pattern.
  Alpine.store("pluginTemplate", { ready: true });
}
