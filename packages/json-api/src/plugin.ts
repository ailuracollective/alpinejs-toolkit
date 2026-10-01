import { guardStore } from "@ailura/alpinejs-core/guards";
import { resolveStoreKey } from "@ailura/alpinejs-core/registration";
import type { Alpine } from "alpinejs";

import { createJsonApiController, JsonApiController } from "./controller";
import type { JsonApiPluginOptions, JsonApiSchema } from "./types";
import { DEFAULT_JSON_API_STORE_KEY } from "./types";

const packageName = "@ailura/alpinejs-json-api";

export function jsonApiPlugin<TSchema extends JsonApiSchema>(
  options: JsonApiPluginOptions<TSchema>
): (alpine: Alpine) => void {
  const storeKey = resolveStoreKey(options, DEFAULT_JSON_API_STORE_KEY);
  const client = createJsonApiController(options);
  return function registerJsonApi(alpine: Alpine): void {
    // Alpine's `store()` wraps the value in a reactive proxy, so a method
    // reached through `$store.jsonApi` runs with `this` bound to the PROXY. The
    // controller keeps its options in a `#private` field, and JS private fields
    // are only readable on the real instance — so every call threw
    // "Cannot read private member #options from an object whose class did not
    // declare it". The documented entry point was unusable; the playground only
    // worked because it bypassed the store and used a module-level client.
    //
    // So the store is a facade of closures bound to the real client. Own data
    // properties are copied; every prototype method is wrapped.
    //
    // The facade is untyped: this package exports no `JsonApiStore` interface, so
    // `$store.jsonApi` in a template is checked only by hand. Reach for
    // `createJsonApiController()` directly when you want the typed surface.
    //
    // The WHOLE prototype chain is walked, not just the immediate one:
    // `on` / `off` / `emit` / `destroy` live on `BaseController.prototype`, two
    // levels above `JsonApiController.prototype`, and those are the request /
    // response / error events that are the most persuasive part of the package.
    const facade: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(client as unknown as Record<string, unknown>)) {
      facade[key] = value;
    }
    for (
      let proto: object | null = Object.getPrototypeOf(client) as object | null;
      proto && proto !== Object.prototype;
      proto = Object.getPrototypeOf(proto) as object | null
    ) {
      for (const key of Object.getOwnPropertyNames(proto)) {
        if (key === "constructor" || key in facade) continue;
        const descriptor = Object.getOwnPropertyDescriptor(proto, key);
        // Getters are left alone: copying them would evaluate them against the
        // proxy-free receiver but lose the accessor.
        if (descriptor && !("value" in descriptor)) continue;
        const member = (client as unknown as Record<string, unknown>)[key];
        if (typeof member !== "function") continue;
        facade[key] = (...args: unknown[]): unknown =>
          (member as (...a: unknown[]) => unknown).apply(client, args);
      }
    }

    guardStore(alpine, storeKey, facade, packageName);
  };
}

export { createJsonApiController, JsonApiController };
export default jsonApiPlugin;
