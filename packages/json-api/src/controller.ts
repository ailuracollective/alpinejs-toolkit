import { BaseController } from "@ailura/alpinejs-core/controller";
import { generateId } from "@ailura/alpinejs-core/ids";

import type { JsonApiEvents } from "./events";
import type {
  JsonApiClient,
  JsonApiClientOptions,
  JsonApiOptions,
  JsonApiCollectionDocument,
  JsonApiCreatePayload,
  JsonApiQueryOptions,
  JsonApiSchema,
  JsonApiSingleDocument,
  JsonApiUpdatePayload,
  SchemaResourceType,
} from "./types";

/**
 * Query parameters are stringified with `String(v)`, not serialised the way
 * JSON:API specifies. That is enough for `include` and `sort` — an array of
 * strings joins with commas, which is exactly the spec's format — and wrong for
 * the object-valued options: `fields`, `page` and `filter` reach the server as
 * `fields=%5Bobject+Object%5D`. The types still accept them, so the failure is at
 * the server, not at the call site.
 */
function buildUrl(
  baseUrl: string,
  type: string,
  id?: string,
  query?: Record<string, unknown>
): string {
  let url = `${baseUrl.replace(/\/$/, "")}/${type}`;
  if (id) url += `/${id}`;
  if (query && Object.keys(query).length) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v !== undefined) params.set(k, String(v));
    url += `?${params.toString()}`;
  }
  return url;
}

export class JsonApiController<TSchema extends JsonApiSchema>
  extends BaseController<JsonApiEvents>
  implements JsonApiClient<TSchema>
{
  readonly id: string;
  readonly schema: TSchema;
  #options: JsonApiClientOptions;

  constructor(schema: TSchema, options: JsonApiClientOptions) {
    super();
    this.id = generateId("json-api");
    this.schema = schema;
    this.#options = options;
  }

  private get fetcher(): typeof fetch {
    return this.#options.fetcher ?? fetch;
  }

  private get headers(): Record<string, string> {
    // `options.headers` is spread LAST so a caller can override the media type —
    // for a server that wants `application/json`, or to add an auth header. The
    // `Content-Type` also goes out on GET and DELETE, where it is meaningless
    // but harmless.
    return {
      "Content-Type": "application/vnd.api+json",
      Accept: "application/vnd.api+json",
      ...this.#options.headers,
    };
  }

  async findAll<TType extends SchemaResourceType<TSchema>>(
    type: TType,
    query?: JsonApiQueryOptions<TSchema, TType>
  ): Promise<JsonApiCollectionDocument<TSchema, TType>> {
    const url = buildUrl(
      this.#options.baseUrl,
      type as string,
      undefined,
      query as Record<string, unknown>
    );
    this.emit("request", { type, method: "GET", url } as never);
    const res = await this.fetcher(url, { headers: this.headers });
    this.emit("response", { type, method: "GET", url, ok: res.ok, status: res.status } as never);
    if (!res.ok) {
      // Only `findAll` reads the error body and emits `error`. The other four
      // methods throw on a non-2xx with the status alone, so a subscriber sees
      // their `response` with `ok: false` and no `error` event at all.
      const body = await res.json().catch(() => ({}));
      this.emit("error", { errors: body.errors ?? [], status: res.status });
      throw new Error(`JSON:API findAll failed: ${res.status}`);
    }
    return (await res.json()) as JsonApiCollectionDocument<TSchema, TType>;
  }

  async findOne<TType extends SchemaResourceType<TSchema>>(
    type: TType,
    id: string,
    query?: JsonApiQueryOptions<TSchema, TType>
  ): Promise<JsonApiSingleDocument<TSchema, TType>> {
    const url = buildUrl(
      this.#options.baseUrl,
      type as string,
      id,
      query as Record<string, unknown>
    );
    this.emit("request", { type, method: "GET", url } as never);
    const res = await this.fetcher(url, { headers: this.headers });
    this.emit("response", { type, method: "GET", url, ok: res.ok, status: res.status } as never);
    if (!res.ok) throw new Error(`JSON:API findOne failed: ${res.status}`);
    return (await res.json()) as JsonApiSingleDocument<TSchema, TType>;
  }

  async create<TType extends SchemaResourceType<TSchema>>(
    type: TType,
    payload: JsonApiCreatePayload<TSchema, TType>
  ): Promise<JsonApiSingleDocument<TSchema, TType>> {
    const url = buildUrl(this.#options.baseUrl, type as string);
    this.emit("request", { type, method: "POST", url } as never);
    const res = await this.fetcher(url, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        data: { type, attributes: payload.attributes, relationships: payload.relationships },
      }),
    });
    this.emit("response", { type, method: "POST", url, ok: res.ok, status: res.status } as never);
    if (!res.ok) throw new Error(`JSON:API create failed: ${res.status}`);
    return (await res.json()) as JsonApiSingleDocument<TSchema, TType>;
  }

  async update<TType extends SchemaResourceType<TSchema>>(
    type: TType,
    id: string,
    payload: JsonApiUpdatePayload<TSchema, TType>
  ): Promise<JsonApiSingleDocument<TSchema, TType>> {
    const url = buildUrl(this.#options.baseUrl, type as string, id);
    this.emit("request", { type, method: "PATCH", url } as never);
    const res = await this.fetcher(url, {
      method: "PATCH",
      headers: this.headers,
      body: JSON.stringify({
        data: { type, id, attributes: payload.attributes, relationships: payload.relationships },
      }),
    });
    this.emit("response", { type, method: "PATCH", url, ok: res.ok, status: res.status } as never);
    if (!res.ok) throw new Error(`JSON:API update failed: ${res.status}`);
    return (await res.json()) as JsonApiSingleDocument<TSchema, TType>;
  }

  async delete<TType extends SchemaResourceType<TSchema>>(type: TType, id: string): Promise<void> {
    const url = buildUrl(this.#options.baseUrl, type as string, id);
    this.emit("request", { type, method: "DELETE", url } as never);
    const res = await this.fetcher(url, { method: "DELETE", headers: this.headers });
    this.emit("response", { type, method: "DELETE", url, ok: res.ok, status: res.status } as never);
    // A successful JSON:API delete answers 204 with no body, which is why this
    // method returns `void` and never calls `res.json()`.
    if (!res.ok) throw new Error(`JSON:API delete failed: ${res.status}`);
  }
}

export function createJsonApiController<TSchema extends JsonApiSchema>(
  options: JsonApiOptions<TSchema>
): JsonApiController<TSchema> {
  const { schema, ...clientOptions } = options;
  return new JsonApiController(schema, clientOptions);
}
