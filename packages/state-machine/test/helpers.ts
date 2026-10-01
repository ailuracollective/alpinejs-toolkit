import { html, mount, reset, resume, settled, start } from "@ailura/alpinejs-testing";
/**
 * Shared test-only scaffolding for the state-machine factory suites.
 *
 * Test-only: never imported by `src/`, so no public-API or size-gate impact.
 * The single contained cast lives in `facadeOf` (with its reason comment);
 * everything else is fully typed — zero `any`, zero `as never`, zero globals.
 */
import Alpine from "alpinejs";
import { afterEach, beforeAll, beforeEach } from "vite-plus/test";

import { stateMachine, type MachineFacade } from "../src/plugin";
import type { MachineConfig } from "../src/types";

/** Registers the start/resume/reset lifecycle trio shared by every machine suite. */
export function setupMachineSuite(): void {
  beforeAll(() => {
    start(() => {});
  });

  beforeEach(() => {
    resume();
  });

  afterEach(() => {
    reset();
  });
}

/**
 * Markup for one `$machine(config)` component. The `defineMachine` config
 * inlines as JSON (single-quoted `x-data` so the JSON double quotes survive
 * parsing); the evaluated facade is published on the element for test-local
 * reads — no globals, no shared stash.
 */
export function machineHtml<S extends string, E extends string>(
  id: string,
  config: MachineConfig<S, E>,
  extraInit = ""
): string {
  return `<div id="${id}" x-data='{ m: $machine(${JSON.stringify(config)}) }' x-init="$el._facade = m${extraInit}"><span data-testid="${id}-state" x-text="m.state"></span></div>`;
}

/** Test-local handle for facades published via `x-init="$el._facade = m"`. */
interface FacadeHost extends HTMLElement {
  _facade?: unknown;
}

/** Read back a facade published by one markup evaluation, typed by the caller. */
export function facadeOf<S extends string, E extends string>(
  root: HTMLElement,
  selector: string
): MachineFacade<S, E> {
  const facade: unknown = root.querySelector<FacadeHost>(selector)?._facade;
  if (facade === undefined) {
    throw new Error(`[state-machine] facade "${selector}" not captured`);
  }
  // Narrowing: published by the plugin's own `$machine(config)` evaluation,
  // so this restores the caller's explicit `S`/`E` instead of escaping to `any`.
  return facade as MachineFacade<S, E>;
}

/** Register the plugin, mount the given markup, and wait for Alpine to settle. */
export async function mountMachines(markup: string): Promise<HTMLElement> {
  stateMachine()(Alpine);
  const root = html(`<div>${markup}</div>`);
  mount(root);
  await settled();
  return root;
}

/**
 * Count reactive `state` writes by intercepting the setter on the raw
 * (unproxied) facade target. Install before the transition under test.
 */
export function countWrites<S extends string>(facade: { state: S }): { count: () => number } {
  const target: { state: S } = Alpine.raw(facade);
  let writes = 0;
  let current: S = target.state;
  Object.defineProperty(target, "state", {
    configurable: true,
    enumerable: true,
    get: () => current,
    set: (next: S) => {
      writes += 1;
      current = next;
    },
  });
  return { count: () => writes };
}
