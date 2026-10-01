// @vitest-environment happy-dom
/**
 * `x-virtual-scroll.create` — creating the instance from the expression.
 *
 * The directive bound a scroll element to an instance that something else had
 * to create first, so every virtualized list opened with a separate
 * `x-init="$store.virtual.create(id, { … })"`. `.create` folds that into the
 * attribute.
 *
 * The bare-id form is the one this package documents
 * (`x-virtual-scroll="rows"`), which is why the bare-identifier rule applies
 * here and not in `carousel`: evaluating `rows` would ask Alpine for a variable
 * of that name, fail silently, and leave the list dead.
 */
import { html, mount, reset, resume, settled, start } from "@ailura/alpinejs-testing";
import Alpine from "alpinejs";
import { afterEach, beforeAll, beforeEach, describe, expect, test } from "vite-plus/test";

import { virtualPlugin } from "../src/plugin";
import type { VirtualStore } from "../src/types";

function store(): VirtualStore {
  return (Alpine as unknown as { store(name: string): VirtualStore }).store("virtual");
}

/** Flush past Alpine's mutation observer, as the other directive tests do. */
async function flush(): Promise<void> {
  await settled();
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
  await settled();
}

beforeAll(() => {
  start(() => {});
});

beforeEach(() => {
  virtualPlugin()(Alpine as unknown as import("alpinejs").Alpine);
  resume();
});

afterEach(() => {
  reset();
});

describe("x-virtual-scroll.create", () => {
  test("creates the instance from the expression's options", async () => {
    const root = html(
      `<div x-data><div id="vp" x-virtual-scroll.create="{ id: 'rows', count: 500, estimateSize: 32 }"></div></div>`
    );
    mount(root);
    await flush();

    const instance = store().instances["rows"];
    expect(instance).toBeDefined();
    expect(instance?.options?.count).toBe(500);
    expect(instance?.options?.estimateSize).toBe(32);
  });

  test("without .create the instance is still not conjured", async () => {
    // Binding only is the pre-existing contract: an instance that does not
    // exist leaves a dead viewport, which is why `.create` is opt-in.
    const root = html(`<div x-data><div id="vp" x-virtual-scroll="'absent'"></div></div>`);
    mount(root);
    await flush();

    expect(store().instances["absent"]).toBeUndefined();
  });

  test("the bare documented id form still binds an existing instance", async () => {
    const root = html(`<div x-data><div id="vp" x-virtual-scroll="rows"></div></div>`);
    mount(root);
    await settled();
    store().create("rows", { count: 10, estimateSize: 20 });
    await flush();

    // `rows` was read literally, not resolved as a variable.
    expect(store().instances["rows"]).toBeDefined();
  });

  test("a quoted id creates with defaults under .create", async () => {
    const root = html(`<div x-data><div id="vp" x-virtual-scroll.create="'plain'"></div></div>`);
    mount(root);
    await flush();

    expect(store().instances["plain"]).toBeDefined();
  });

  test("an instance created before the directive is left alone", async () => {
    const root = html(
      `<div x-data><div x-init="$store.virtual.create('early', { count: 7 })"></div><div id="vp" x-virtual-scroll.create="'early'"></div></div>`
    );
    mount(root);
    await flush();

    // The host's own options win; `.create` only fills a gap.
    expect(store().instances["early"]?.options?.count).toBe(7);
  });
});
