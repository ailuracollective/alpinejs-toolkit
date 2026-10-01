import { describe, expect, test } from "vite-plus/test";

import { carouselPlugin } from "../src/plugin";
import type { CarouselStore } from "../src/types";

function createMockAlpine() {
  const stores = new Map<string, unknown>();
  const magics = new Map<string, unknown>();
  const directives = new Map<string, unknown>();
  const alpine = {
    store(name: string, value?: unknown) {
      if (value !== undefined) {
        stores.set(name, value);
        return;
      }
      return stores.get(name);
    },
    magic(name: string, callback: unknown) {
      magics.set(name, callback);
    },
    directive(name: string, callback: unknown) {
      directives.set(name, callback);
    },
  } as unknown as import("alpinejs").Alpine;
  return { alpine, stores, magics, directives };
}

function register() {
  const { alpine, stores } = createMockAlpine();
  carouselPlugin()(alpine);
  return {
    store: (stores.get("carousel") ?? {}) as CarouselStore,
    rawInstances: (): Record<string, Record<string, unknown>> =>
      (stores.get("carousel") as { instances: Record<string, Record<string, unknown>> }).instances,
  };
}

describe("carousel store instances registry is detached from the controller", () => {
  test("store projection never exposes internal-only fields", () => {
    const { store } = register();
    store.create("hero", { ariaLive: "polite" });
    const projection = store.instances["hero"] as unknown as Record<string, unknown>;
    expect(projection.viewport).toBeUndefined();
    expect(projection.embla).toBeUndefined();
    expect(projection.ariaLive).toBe("polite");
  });

  test("controller stays live across syncs and its writes survive", () => {
    const { store } = register();
    store.create("hero", { ariaLive: "polite" });
    expect(store.isPlaying("hero")).toBe(false);
    store.play("hero");
    expect(store.isPlaying("hero")).toBe(true);
    // unrelated create triggers another sync
    store.create("other", { ariaLive: "off" });
    expect(store.isPlaying("hero")).toBe(true);
    expect(store.isPlaying("other")).toBe(false);
    store.pause("hero");
    expect(store.isPlaying("hero")).toBe(false);
    expect(store.current("hero")).toBe(0);
    expect(store.count("hero")).toBe(0);
    expect(store.canNext("hero")).toBe(false);
    expect(store.canPrevious("hero")).toBe(false);
  });

  test("destroy removes the entry from the store projection", () => {
    const { store, rawInstances } = register();
    store.create("a", {});
    store.create("b", {});
    expect(Object.keys(rawInstances()).sort()).toEqual(["a", "b"]);
    store.destroy("a");
    expect(Object.keys(rawInstances())).toEqual(["b"]);
    expect(store.instances["a"]).toBeUndefined();
  });

  test("mutating the store projection never reaches the controller", () => {
    const { store, rawInstances } = register();
    store.create("hero", {});
    const projection = rawInstances()["hero"];
    projection.isPlaying = true;
    projection.currentIndex = 7;
    expect(store.isPlaying("hero")).toBe(false);
    expect(store.current("hero")).toBe(0);
  });
});
