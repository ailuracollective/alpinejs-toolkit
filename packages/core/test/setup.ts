/**
 * Shared test setup for `@ailura/alpinejs-core`.
 *
 * Wires guard registration tracking into the `@ailura/alpinejs-testing`
 * lifecycle: `reset()` (called in `afterEach`) clears the per-process owner
 * map, so dom tests never need a manual `resetRegistrationTracking()` call.
 * Registered via `test.setupFiles` in `vite.config.ts`.
 *
 * The wiring only runs where a DOM exists: `@ailura/alpinejs-testing`
 * imports Alpine, which needs `MutationObserver` at module level, so
 * importing it unconditionally would break the node-environment unit tests.
 */
export {};

if (typeof MutationObserver !== "undefined") {
  const { onReset } = await import("@ailura/alpinejs-testing");
  const { resetRegistrationTracking } = await import("../src/guards");
  onReset(resetRegistrationTracking);
}
