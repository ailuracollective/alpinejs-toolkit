/**
 * Shared Alpine integration-test helpers.
 *
 * Test-only: this package is a private workspace devDependency and must never
 * be imported from plugin runtime code (`src/index.ts`) or bundled into dists.
 */
import Alpine, { type Alpine as AlpineInstance } from "alpinejs";

/** An Alpine plugin function, as passed to `Alpine.plugin()`. */
export type AlpinePlugin = (alpine: AlpineInstance) => void;

/**
 * Build an element from an HTML snippet for `mount()`.
 *
 * @param snippet - HTML snippet containing Alpine directives.
 */
export function html(snippet: string): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = snippet;
  return root;
}

/**
 * Append an element to `document.body` so Alpine can initialize it.
 *
 * The node is moved into the body (not cloned); `reset()` removes it.
 *
 * @param el - Element containing Alpine directives to mount.
 */
export function mount(el: HTMLElement): void {
  document.body.append(el);
}

/**
 * Flush pending Alpine reactivity and DOM updates.
 *
 * Two ticks are required: the first lets Alpine process its reactive queue,
 * the second lets the resulting DOM mutations settle.
 */
export async function settled(): Promise<void> {
  await Alpine.nextTick();
  await Alpine.nextTick();
}

/**
 * Register a plugin and start Alpine. Call once per test file in `beforeAll`.
 *
 * Alpine holds global singleton state, so `Alpine.start()` must run exactly
 * once per file — starting twice warns and re-initializing mid-file leaks
 * observers between tests. Per-test isolation comes from `resume()` /
 * `reset()` instead.
 *
 * @param plugin - Alpine plugin function to register before starting.
 */
export function start(plugin: AlpinePlugin): void {
  Alpine.plugin(plugin);
  Alpine.start();
}

/**
 * Resume Alpine's mutation observer for the next test. Call at the start of
 * each test in `beforeEach` (after any store-state reset).
 *
 * The observer is stopped in `reset()` so teardown DOM removal does not
 * trigger Alpine re-initialization while the tree is being destroyed.
 */
export function resume(): void {
  Alpine.startObservingMutations();
}

/**
 * Teardown hooks run at the end of every `reset()`.
 *
 * Lets packages with per-process test state (e.g. `@ailura/alpinejs-core`
 * guard registration tracking) clear that state alongside the Alpine DOM
 * teardown, without `testing` depending on them: the owning package
 * registers its reset function once (typically in a shared test setup
 * file) via {@link onReset}.
 */
const resetHooks = new Set<() => void>();

/**
 * Register a teardown hook run by `reset()` after the DOM is cleared.
 *
 * @param hook - Zero-argument reset function (must not throw).
 * @returns An unsubscribe function removing the hook.
 */
export function onReset(hook: () => void): () => void {
  resetHooks.add(hook);
  return () => {
    resetHooks.delete(hook);
  };
}

/**
 * Tear down Alpine state after a test. Call in `afterEach`.
 *
 * Stops the mutation observer, destroys Alpine's component tree, and clears
 * `document.body` so the next test mounts into a clean DOM. Alpine observes
 * `document.body` globally, so without this reset components and stores leak
 * across tests within the file. Registered {@link onReset} hooks run last.
 */
export function reset(): void {
  Alpine.stopObservingMutations();
  Alpine.destroyTree(document.body);
  document.body.replaceChildren();
  for (const hook of resetHooks) hook();
}
