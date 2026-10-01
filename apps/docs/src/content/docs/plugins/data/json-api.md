---
title: Json Api
---

@ailura/alpinejs-json-api

A schema-typed JSON:API client registered as a store. You declare the schema once, the
plugin knows the resource types, the attributes and the relationships, and it takes
`include`, `fields`, `sort`, `page` and `filter` off the call.

## Install

```sh
pnpm add alpinejs @ailura/alpinejs-core @ailura/alpinejs-json-api
```

## Register the plugin

Do this once, before `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import jsonApiPlugin from "@ailura/alpinejs-json-api";

const schema = {
  articles: {
    attributes: {} as { title: string; body: string },
    relationships: { author: { type: "people" } },
  },
  people: {
    attributes: {} as { name: string },
  },
} as const;

Alpine.plugin(jsonApiPlugin({ schema, baseUrl: "https://api.example.com" }));

Alpine.start();
```

The schema and the base URL are **required**, and they go to the factory. There is no
store method to set them later.

## Minimal example

Fetch one article with its author.

```html
<div
  x-data="{
    article: null,
    async load() {
      this.article = await $store.jsonApi.findOne('articles', '1', {
        include: ['author'],
      });
    },
  }"
  x-init="load()"
>
  <span x-text="article?.data?.attributes?.title"></span>
</div>
```

`findOne()` is the single-resource call and `findAll()` is the list. The old `get()`
name is not the API: those two are. Both take the resource type, the id for `findOne`,
and an optional query object. What you get back is the parsed document, so a resource
lives under `document.data` and its attributes under `document.data.attributes`.

## What the schema is, and is not

The schema is a compile-time contract. A resource key is the type the API calls it —
`articles` goes in the URL as `/articles` — and `attributes` types the payload you read
and write. Nothing at runtime reads it: the client never checks a field name against it
and never rewrites a request from it, so a field the schema does not declare is not
caught locally. The server rejects it, and the error comes back as a response error
rather than a validation error, which points you at the schema instead of at the call.

A relationship's `type` is the _target_ resource type, which is how `relationships:
{ author: { type: "people" } }` says "this article has an author of type `people`".

The query object on `findAll()` and `findOne()` is `include`, `fields`, `sort`, `page`
and `filter`:

```js
$store.jsonApi.findAll("articles", { include: ["author"], sort: ["-title"] });
```

:::caution[Only the flat options reach the URL today]
`include` and `sort` are arrays of names, so they arrive as `?include=author&sort=-title`
and a server reads them the way it expects. `fields`, `page` and `filter` are objects,
and the client appends them with `String(value)`, so they land as
`?fields=[object Object]` instead of JSON:API's `fields[articles]=title`. Until that is
serialized properly, build those query parameters yourself in `baseUrl` or through a
custom `fetcher`.
:::

:::caution[Relationships are not resolved for you]
A response with `include` carries the related resources in `document.included`, and the
`relationships` on the resource keep their `data` identifiers. The client returns the
document as parsed: joining the two — reading `relationships.author.data.id` and looking
that id up in `included` — is the caller's job.
:::

## Writes

The client exposes the five JSON:API operations, and nothing else. There is no
generic `request()` to reach for when something does not fit. Writes take a payload
object with `attributes` (and optional `relationships`), never a bare attribute bag.

```js
$store.jsonApi.create("articles", {
  attributes: { title: "Hello" },
  relationships: { author: { data: { type: "people", id: "9" } } },
});
$store.jsonApi.update("articles", "1", { attributes: { title: "Renamed" } });
$store.jsonApi.delete("articles", "1");
```

## API reference

| Name                                       | Type   | Purpose                     |
| ------------------------------------------ | ------ | --------------------------- |
| `$store.jsonApi.findAll(type, query?)`     | method | Fetch a collection.         |
| `$store.jsonApi.findOne(type, id, query?)` | method | Fetch one resource by id.   |
| `$store.jsonApi.create(type, payload)`     | method | POST a new resource.        |
| `$store.jsonApi.update(type, id, payload)` | method | PATCH an existing resource. |
| `$store.jsonApi.delete(type, id)`          | method | DELETE a resource.          |
| `$store.jsonApi.schema`                    | store  | The schema you registered.  |
| `$store.jsonApi.id`                        | store  | The controller instance id. |

There is no `fetcher`, `headers` or `phase` on the store: the fetch implementation and
the headers are options you pass at registration, not state you read back.

## Events

The controller emits `request({ type, method, url })`,
`response({ type, method, url, ok, status })` and, on a failed `findAll()`,
`error({ errors, status })`. They are controller events, not DOM events, so subscribe
through a client you built yourself with `createJsonApiClient()`. Every non-2xx response
throws; the other four calls report it by throwing alone.

## Plugin options

```ts
jsonApiPlugin({ schema, baseUrl, storeKey: "api" });
```

| Option     | Type                     | Default   | Purpose                                           |
| ---------- | ------------------------ | --------- | ------------------------------------------------- |
| `schema`   | `JsonApiSchema`          | —         | Required. The resource types.                     |
| `baseUrl`  | `string`                 | —         | Required. Prefix for every request URL.           |
| `fetcher`  | `typeof fetch`           | `fetch`   | Swap the transport, e.g. for tests or SSR.        |
| `headers`  | `Record<string, string>` | `{}`      | Merged over the JSON:API `Accept`/`Content-Type`. |
| `storeKey` | `string`                 | `jsonApi` | Name of the store registration.                   |

Requests go out with `Content-Type: application/vnd.api+json` and the matching `Accept`
header, exported as `JSON_API_MEDIA_TYPE`.
