# @ailura/alpinejs-json-api

<p align="center">

[![bundlephobia minzip](https://badgen.net/bundlephobia/minzip/@ailura/alpinejs-json-api)](https://bundlephobia.com/package/@ailura/alpinejs-json-api)

</p>

> JSON:API client for Alpine.js — resource names and attribute shapes typed from
> a schema you declare once, `include` / `sort` / paging / filter query
> parameters, and a `request` / `response` / `error` event stream per call, on
> `@ailura/alpinejs-core`. It is a client class, not a store: the schema is the
> type parameter, and the document comes back exactly as the server sent it.

## Installation

```sh
pnpm add @ailura/alpinejs-json-api alpinejs
# or
npm install @ailura/alpinejs-json-api alpinejs
```

Requires `alpinejs@^3.0.0` as peer. `@ailura/alpinejs-core` is a **peer
dependency**, not a dependency: no package in this toolkit has a
`dependencies` block, so the host installs it too.

## Usage

### 1. Standalone (framework-agnostic)

The schema is a plain record, and it is the whole type story: the keys become
the legal resource names, and each `attributes` shape becomes the type you get
back.

```ts
import { createJsonApiController, type JsonApiSchema } from "@ailura/alpinejs-json-api";

const schema = {
  articles: {
    attributes: {} as { title: string; body: string },
    relationships: { author: { type: "people" as const } },
  },
  people: {
    attributes: {} as { name: string },
  },
} as const satisfies JsonApiSchema;

const api = createJsonApiController({ schema, baseUrl: "https://api.example.com" });

// "artciles" is a compile error, and so is a misspelled attribute later on.
const list = await api.findAll("articles", { include: ["author"], sort: ["-title"] });
list.data[0]?.attributes.title; // string
list.included; // the `people` records the server sent alongside

const one = await api.findOne("articles", "1", { include: ["author"] });
one.data.relationships?.author?.data; // { type: "people"; id: string } | null

await api.create("articles", { attributes: { title: "New", body: "…" } });
await api.update("articles", "1", { attributes: { title: "Renamed" } });
await api.delete("articles", "1");

api.destroy();
```

`createJsonApiController` takes one object — the schema next to the transport —
because a positional schema in front of an options bag is unreadable at the call
site, and the plugin has to combine them anyway.

### 2. Alpine

```ts
import Alpine from "alpinejs";
import jsonApiPlugin from "@ailura/alpinejs-json-api";

Alpine.plugin(jsonApiPlugin({ schema, baseUrl: "https://api.example.com" }));
Alpine.start();
```

`$store.jsonApi` carries the five verbs and the event subscription. There is no
magic and no directive.

```ts
import Alpine from "alpinejs";
import jsonApiPlugin from "@ailura/alpinejs-json-api";

Alpine.plugin(jsonApiPlugin({ schema, baseUrl: "https://api.example.com" }));

Alpine.data("articles", () => ({
  list: [],
  loading: false,
  error: null,

  init() {
    void this.load();
  },

  async load() {
    this.loading = true;
    this.error = null;
    try {
      // The store is a command surface, so the document you get back is a plain
      // value: copy out of it, like any other fetch.
      const doc = await $store.jsonApi.findAll("articles", { include: ["author"] });
      this.list = doc.data;
    } catch (error) {
      this.error = error.message;
    } finally {
      this.loading = false;
    }
  },
}));

Alpine.start();
```

```html
<div x-data="articles">
  <p x-show="loading" x-cloak>Loading…</p>
  <p x-show="error" x-cloak x-text="error" role="alert"></p>

  <template x-for="article in list" :key="article.id">
    <p x-text="article.attributes.title"></p>
  </template>

  <button @click="load()">Reload</button>
</div>
```

To keep the schema's types, build the client yourself and register it — that is
also what the playground does, and it is the only way to get a typed handle
rather than the store's untyped facade:

```ts
import { createJsonApiController } from "@ailura/alpinejs-json-api";

const api = createJsonApiController({ schema, baseUrl: "/api" });

Alpine.data("articles", () => ({
  list: [],
  init() {
    api.on("request", (detail) => console.log(detail.method, detail.url));
    void this.load();
  },
  async load() {
    this.list = (await api.findAll("articles")).data;
  },
}));
```

## API

| Export                       | Description                                                                                               | Type       |
| ---------------------------- | --------------------------------------------------------------------------------------------------------- | ---------- |
| `JsonApiController`          | The client. `new JsonApiController(schema, options)` — implements `JsonApiClient`, emits the three events | `class`    |
| `createJsonApiController`    | `createJsonApiController({ schema, baseUrl, fetcher?, headers? })` — one bag, schema included             | `function` |
| `jsonApiPlugin`              | `Alpine.plugin()` factory — registers `$store.jsonApi` as a closure facade over a fresh client            | `function` |
| `default`                    | Alias of `jsonApiPlugin`                                                                                  | `function` |
| `JSON_API_MEDIA_TYPE`        | `"application/vnd.api+json"` — exported for callers; the controller writes the literal itself             | `string`   |
| `DEFAULT_JSON_API_STORE_KEY` | `"jsonApi"` — the `$store` key. There is no magic, so this is the only name                               | `string`   |
| `JsonApiEvents`              | `{ request, response, error }` — the controller's event map                                               | `type`     |
| `JsonApiRequestDetail`       | `{ type, method, url }` emitted before the fetch                                                          | `type`     |
| `JsonApiResponseDetail`      | `{ type, method, url, ok, status }` emitted after it                                                      | `type`     |
| `JsonApiErrorDetail`         | `{ errors, status }` — the server's `errors` array plus the HTTP status                                   | `type`     |
| `JsonApiClient`              | The five verbs, generic over the schema — what `JsonApiController` implements                             | `type`     |
| `JsonApiClientOptions`       | `{ baseUrl, fetcher?, headers? }`                                                                         | `type`     |
| `JsonApiOptions`             | `JsonApiClientOptions & { schema }` — the `createJsonApiController()` bag                                 | `type`     |
| `JsonApiPluginOptions`       | `JsonApiOptions & { storeKey? }`                                                                          | `type`     |
| `JsonApiSchema`              | `Record<string, ResourceSchema>` — the shape of the schema you declare                                    | `type`     |
| `SchemaResourceType`         | `keyof TSchema & string` — the legal values of the `type` argument                                        | `type`     |
| `InferAttributes`            | The `attributes` shape declared for one resource type                                                     | `type`     |
| `InferRelationshipNames`     | The relationship names declared for one resource type                                                     | `type`     |
| `JsonApiResource`            | One resource as this client types it: `attributes` typed, `relationships` as identifiers                  | `type`     |
| `JsonApiSingleDocument`      | `{ data, included?, meta?, links? }` — the return of `findOne` / `create` / `update`                      | `type`     |
| `JsonApiCollectionDocument`  | `{ data: Array<…>, included?, meta?, links? }` — the return of `findAll`                                  | `type`     |
| `JsonApiQueryOptions`        | `{ include?, fields?, sort?, page?, filter? }` — the third argument of the two reads                      | `type`     |

The document types are also spelled with the raw JSON:API shapes in
`src/types.ts` — `JsonApiDocument`, `JsonApiResourceObject`, `JsonApiRelationship`,
`JsonApiResourceIdentifier`, `JsonApiErrorObject`, `JsonApiLinkObject`,
`JsonApiLinks`, `ResourceSchema`, `RelationshipSchema`, `JsonApiCreatePayload`,
`JsonApiUpdatePayload`, `JsonApiRelationshipData`,
`JsonApiResolvedRelationshipValue`, `InferRelationshipTarget`. They are
reachable through the source and are not re-exported from the barrel.

### Client API

| Method                      | Returns             | Request it makes                                                                                                |
| --------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------- |
| `findAll(type, query?)`     | collection document | `GET {baseUrl}/{type}?{query}`                                                                                  |
| `findOne(type, id, query?)` | single document     | `GET {baseUrl}/{type}/{id}?{query}`                                                                             |
| `create(type, payload)`     | single document     | `POST {baseUrl}/{type}` with `{ data: { type, attributes, relationships } }`                                    |
| `update(type, id, payload)` | single document     | `PATCH {baseUrl}/{type}/{id}` with the same envelope                                                            |
| `delete(type, id)`          | `void`              | `DELETE {baseUrl}/{type}/{id}`. A 204 has no body, so nothing is parsed                                         |
| `on(event, listener)`       | unsubscribe         | Inherited from `BaseController`. The unsubscribe also runs on `destroy()`                                       |
| `id`                        | `string`            | `generateId("json-api")` — the schema and options are constructor arguments, so there is nothing to generate    |
| `schema`                    | `TSchema`           | The schema you passed, as given                                                                                 |
| `destroy()`                 | `void`              | Inherited. The client holds no timers or listeners of its own; the `on` subscriptions it handed out stop firing |

Every method rejects on a non-2xx with `new Error("JSON:API <verb> failed: <status>")`.
The server's `errors` array is on the `error` event, not on the thrown error.

### Store API

`$store.jsonApi` is the five verbs plus the whole of `BaseController` and
`EventEmitter` — the plugin walks the prototype chain and re-binds every method
to the real client, so a call through the store does not run against Alpine's
reactive proxy. That walk has no allow-list, so the store also carries the
controller's own `events` emitter and `cleanups` stack (copied by reference from
the instance) alongside `id` and `schema`.

```js
$store.jsonApi.findAll("articles", { include: ["author"], sort: ["-title"] });
$store.jsonApi.findOne("articles", id);
$store.jsonApi.create("articles", { attributes: { title, body } });
$store.jsonApi.update("articles", id, { attributes: { title } });
$store.jsonApi.delete("articles", id);

const off = $store.jsonApi.on("response", (detail) => console.log(detail.status, detail.url));
$store.jsonApi.off("response", listener); // and once(), listenerCount()
$store.jsonApi.destroy();
```

The facade is **not typed**: this package exports no `JsonApiStore` interface, so
in a template `$store.jsonApi.findAll("artciles")` is a typo nothing catches.
Build the client with `createJsonApiController()` when the type matters.

### Options

```ts
type JsonApiClientOptions = {
  baseUrl: string; //        required. A trailing "/" is trimmed.
  fetcher?: typeof fetch; // default: the global `fetch`, read per call
  headers?: Record<string, string>; // merged over the JSON:API media type pair
};

type JsonApiPluginOptions<TSchema> = JsonApiOptions<TSchema> & {
  readonly storeKey?: string; // default: "jsonApi"
};
```

| Option     | Default                      | Effect                                                                                                                                                               |
| ---------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schema`   | —                            | Required. The type parameter of every call: it decides the legal `type` values and the shape of `attributes`                                                         |
| `baseUrl`  | —                            | Required. Prefix for every URL. `https://api.test/` and `https://api.test` behave the same                                                                           |
| `fetcher`  | global `fetch`               | Read on every call, not captured once — swapping it after construction works. A mock is just a function                                                              |
| `headers`  | —                            | Spread **over** `Content-Type` and `Accept`, so it can add an auth header or replace the media type. Sent on GET and DELETE too, where `Content-Type` is meaningless |
| `storeKey` | `DEFAULT_JSON_API_STORE_KEY` | The `$store` key. There is no `magicKey`: this package registers a store and nothing else                                                                            |

### Query options

```ts
type JsonApiQueryOptions<TSchema, TType> = {
  include?: readonly string[]; //  ?include=author,comments
  fields?: Partial<Record<string, readonly string[]>>; // per resource type
  sort?: readonly string[]; //  ?sort=-title  (a leading "-" is descending)
  page?: { number?; size?; offset?; limit?; cursor? };
  filter?: Record<string, string | number | boolean>;
};
```

`include` and `sort` reach the server correctly: both are arrays of strings, and
`String(["a", "b"])` is `"a,b"`, which is what the spec asks for. `fields`,
`page` and `filter` are typed and accepted but are stringified with `String(v)`,
so they arrive as `fields=%5Bobject+Object%5D` — see
[Limitations](#limitations).

### Avoiding name collisions

```ts
Alpine.plugin(jsonApiPlugin({ schema, baseUrl: "/api", storeKey: "cms" }));
// → $store.cms
```

`storeKey` is the only name to move; there is no magic to keep in step with it.
The key goes through `guardStore`, so a name another package already owns throws
a `RegistrationError` instead of being silently overwritten.

### Events

A per-request stream, which is the most useful thing in the package: a network
log you own, without patching `fetch`.

```ts
import type { JsonApiErrorDetail, JsonApiRequestDetail } from "@ailura/alpinejs-json-api";

api.on("request", (detail: JsonApiRequestDetail) => {
  detail.type; // 'articles'
  detail.method; // 'GET' | 'POST' | 'PATCH' | 'DELETE'
  detail.url; // the full URL, query string included
});

api.on("response", (detail) => console.log(detail.status, detail.ok));
api.on("error", (detail: JsonApiErrorDetail) => console.log(detail.status, detail.errors));
```

`on()` returns the unsubscribe function, and `destroy()` detaches it. `request`
fires before the fetch, `response` after it whatever the outcome. `error` fires
only from `findAll` — see [Limitations](#limitations).

## Relationships arrive unresolved

`include: ["author"]` asks the server for the related records; JSON:API puts them
in the document's top-level `included` array and leaves `relationships` as
resource identifiers. This client returns the document as it parsed — it does not
splice `included` onto the relationship — so resolving one is a lookup:

```ts
const doc = await api.findAll("articles", { include: ["author"] });

function relatedName(relationship: unknown, included: unknown): string {
  const id = (relationship as { data?: { id?: string } | null } | undefined)?.data?.id;
  const match = (included as Array<{ id: string; attributes?: { name?: string } }>).find(
    (resource) => resource.id === id
  );
  return match?.attributes?.name ?? "—";
}

doc.data.map((article) => ({
  title: article.attributes.title,
  author: relatedName(article.relationships?.author, doc.included),
}));
```

The type on `JsonApiResource` says the same thing in a different place: a
relationship carries `data` (the identifier) and a `resolved` field that is
present in the type and never present at runtime.

## SSR

> SSR-safe — no `window`/`document` at import time, and no method touches
> either. The client is a `BaseController` holding only its options, so it can
> be constructed and used during a server render. The global `fetch` is read
> lazily inside each call, so a server that installs a patched `fetch` before the
> first request is picked up.

## Integration

- **`@ailura/alpinejs-query`** — the natural consumer. The client is a plain
  async function per call, which is exactly a `queryFn`:
  `ctrl.observe(["articles"], () => api.findAll("articles").then((d) => d.data))`.
  The cache supplies the `AbortSignal`; this client does not forward one, so a
  cancelled query still lets the request finish.
- **A mock transport in tests** — `fetcher` is read per call, so
  `fetcher: (url, init) => Promise.resolve(new Response(...))` is a complete test
  double. `packages/json-api/test/store-callable.test.ts` does exactly this.

## Limitations

- **`fields`, `page` and `filter` do not serialise.** `buildUrl()` stringifies
  every query value with `String(v)`, so the object-valued options reach the
  server as `?fields=[object Object]`. The types accept them, so the failure is on
  the server and not at the call site. `include` and `sort` are unaffected, which
  is why the package description's "sparse fieldsets" is not what the code does.
- **Only `findAll` emits `error`.** `findOne`, `create`, `update` and `delete`
  throw on a non-2xx with the status alone, so a subscriber sees their `response`
  with `ok: false` and no `error` event — and the server's `errors` array is
  dropped on the floor for four of the five verbs.
- **The thrown error carries no server detail.** Every failure is
  `new Error("JSON:API <verb> failed: <status>")`; the `errors` array only
  reaches you through the `error` event, and only for `findAll`. There is no
  `JsonApiError` class to inspect.
- **The store facade is untyped and unfiltered.** No `JsonApiStore` is exported,
  and `$store.jsonApi` is a `Record<string, unknown>` assembled by walking the
  prototype chain at registration, so nothing checks a member name reached
  through it. The walk has no allow-list either: `emit`, `setup`, `teardown` and
  `onCleanup` are `protected` in TypeScript but end up callable on the store, and
  the controller's own `events` emitter and `cleanups` stack are copied onto it by
  reference.
- **The playground's hand-written surface list for this package is partly
  fiction.** `SURFACE_OVERRIDES["json-api"]` in
  `apps/demo/test/helpers/package-surface.ts` lists `request` and `baseUrl`
  alongside the real members; neither exists on the client or the store, and
  because the list is hand-written the demo lint cannot catch a member that does
  not. That is the cost of this package being one of the five the lint checks
  against a list rather than against the compiler.
- **Nothing is cached, deduplicated or retried.** Two components calling
  `findOne("articles", "1")` at once issue two requests. That is
  `@ailura/alpinejs-query`'s job.
- **No `AbortSignal` is forwarded.** `fetcher` is called with only a URL and an
  init object, so a request cannot be cancelled through this client even when
  the caller has a signal.
- **No `links` following.** `self`, `next` and `prev` are typed on the documents
  and ignored; paging is whatever the server returns, not something the client
  walks.
- **The URL is built by string concatenation**, so a `type` or `id` containing
  `/`, `?` or `#` is not escaped. Resource names are yours to choose, and a
  client-generated id containing a slash would silently address a different path.
- **The declared budget is met** — `1.17 kB gzip` against a `6 kB` entry.

## Size

`3.31 kB raw / 1.17 kB gzip` · budget `6 kB` · externalized peers: `alpinejs`, `@ailura/alpinejs-core` · `size-limit` + `publint` + `attw` verified.

## Architecture

[Data layer](../../ARCHITECTURE.md) — controllers own state, Alpine owns
reactivity. `JsonApiController extends BaseController`, so it inherits the
`idle → mounted → destroyed` lifecycle and the typed `on`/`off`/`emit` the three
events ride on. See canon, guards, and SSR rules in
[ARCHITECTURE.md](../../ARCHITECTURE.md).

This package is one of the five the demo lint cannot check against the
compiler: it hands back a client class instead of registering a typed store, so
`apps/demo/test/helpers/package-surface.ts` lists its members by hand.

## Testing

```sh
pnpm exec vp test packages/json-api
pnpm exec tsc --noEmit -p packages/json-api/tsconfig.json
```

`test/store-callable.test.ts` pins the one defect that made the documented entry
point unusable: Alpine wraps a store in a reactive proxy, so a method reached
through `$store.jsonApi` ran with `this` bound to the proxy and threw
`Cannot read private member #options`. The plugin now registers a closure facade
over the real client. See [ARCHITECTURE.md §8](../../ARCHITECTURE.md).

## License

MIT
