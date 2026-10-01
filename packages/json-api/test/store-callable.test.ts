// @vitest-environment happy-dom
/**
 * `$store.jsonApi` must be callable.
 *
 * The defect this pins: the plugin registered the controller *instance* as the
 * store. Alpine's `store()` wraps the value in a reactive proxy, so a method
 * reached through `$store.jsonApi` ran with `this` bound to the proxy — and the
 * controller keeps its options in a `#private` field, which JS only lets you
 * read on the real instance. Every documented call threw:
 *
 *     TypeError: Cannot read private member #options from an object whose class
 *     did not declare it
 *
 * The playground never surfaced it because the demo drove a module-level client
 * directly, bypassing the very surface the catalog advertises.
 */

import { clearAllSingletons } from "@ailura/alpinejs-core/singletons";
import { reset, resume, settled, start } from "@ailura/alpinejs-testing";
import Alpine from "alpinejs";
import { afterEach, beforeAll, beforeEach, describe, expect, test } from "vite-plus/test";

import { jsonApiPlugin } from "../src/plugin";

const schema = {
  articles: {
    type: "collection" as const,
    items: { type: "resource" as const, attributes: { title: "string", body: "string" } },
  },
};

interface Store {
  findAll(type: string): Promise<{ data: unknown[] }>;
  findOne(type: string, id: string): Promise<{ data: unknown }>;
  create(type: string, payload: unknown): Promise<{ data: unknown }>;
  update(type: string, id: string, payload: unknown): Promise<{ data: unknown }>;
  delete(type: string, id: string): Promise<void>;
  on(event: string, listener: (detail: unknown) => void): () => void;
}

function store(): Store {
  return (Alpine as unknown as { store(name: string): Store }).store("jsonApi");
}

/** Requests made, so the assertions can be about behaviour and not just types. */
let requests: { url: string; method: string }[] = [];

beforeAll(() => start(() => {}));

beforeEach(() => {
  requests = [];
  jsonApiPlugin({
    schema,
    baseUrl: "https://example.test/api",
    fetcher: (url: string, init?: RequestInit) => {
      requests.push({ url: String(url), method: init?.method ?? "GET" });
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: [{ id: "1", type: "articles", title: "Hi" }] }),
      } as unknown as Response);
    },
  } as never)(Alpine as unknown as import("alpinejs").Alpine);
  resume();
});

afterEach(() => {
  reset();
  clearAllSingletons();
});

describe("$store.jsonApi", () => {
  test("findAll resolves instead of throwing on the private field", async () => {
    await expect(store().findAll("articles")).resolves.toBeDefined();
    expect(requests[0]?.url).toBe("https://example.test/api/articles");
  });

  test("findOne reaches the single-resource URL", async () => {
    await store().findOne("articles", "1");
    expect(requests[0]?.url).toBe("https://example.test/api/articles/1");
  });

  test("create posts to the collection URL", async () => {
    await store().create("articles", { title: "New" });
    expect(requests[0]?.url).toBe("https://example.test/api/articles");
    expect(requests[0]?.method).toBe("POST");
  });

  test("update targets the single resource", async () => {
    await store().update("articles", "1", { title: "Edited" });
    expect(requests[0]?.url).toBe("https://example.test/api/articles/1");
  });

  test("delete targets the single resource", async () => {
    await store().delete("articles", "1");
    expect(requests[0]?.url).toBe("https://example.test/api/articles/1");
  });

  test("the event subscription is reachable through the store", async () => {
    // The request/response events are the most persuasive part of the package;
    // they were unreachable when every method threw.
    const seen: string[] = [];
    const off = store().on("request", () => seen.push("request"));
    await store().findAll("articles");
    await settled();
    off();

    expect(seen).toContain("request");
  });
});
