/**
 * The media type this client speaks. Exported for a caller that wants to set it
 * on something else — the controller writes the literal string in its own
 * headers, so nothing here reads this constant.
 */
export const JSON_API_MEDIA_TYPE = "application/vnd.api+json" as const;

export type JsonApiLinks = Record<string, string | JsonApiLinkObject>;
export interface JsonApiLinkObject {
  href: string;
  meta?: Record<string, unknown>;
}
export interface JsonApiErrorObject {
  id?: string;
  status?: string;
  code?: string;
  title?: string;
  detail?: string;
  source?: { pointer?: string; parameter?: string };
  meta?: Record<string, unknown>;
}
export interface JsonApiResourceIdentifier {
  type: string;
  id: string;
  meta?: Record<string, unknown>;
}
export interface JsonApiRelationship {
  data: JsonApiResourceIdentifier | JsonApiResourceIdentifier[] | null;
  links?: JsonApiLinks;
  meta?: Record<string, unknown>;
}
export interface JsonApiResourceObject {
  type: string;
  id: string;
  attributes?: Record<string, unknown>;
  relationships?: Record<string, JsonApiRelationship>;
  links?: JsonApiLinks;
  meta?: Record<string, unknown>;
}
export interface JsonApiDocument<TData = JsonApiResourceObject | JsonApiResourceObject[] | null> {
  data: TData;
  included?: JsonApiResourceObject[];
  errors?: JsonApiErrorObject[];
  meta?: Record<string, unknown>;
  links?: JsonApiLinks;
  jsonapi?: { version?: string; meta?: Record<string, unknown> };
}
export interface RelationshipSchema {
  type: string;
  many?: boolean;
}
export interface ResourceSchema {
  attributes: Record<string, unknown>;
  relationships?: Record<string, RelationshipSchema>;
}
export type JsonApiSchema = Record<string, ResourceSchema>;
export type SchemaResourceType<TSchema extends JsonApiSchema> = keyof TSchema & string;
export type InferAttributes<
  TSchema extends JsonApiSchema,
  TType extends SchemaResourceType<TSchema>,
> = TSchema[TType] extends { attributes: infer TAttributes }
  ? TAttributes extends Record<string, unknown>
    ? TAttributes
    : never
  : never;
export type InferRelationshipNames<
  TSchema extends JsonApiSchema,
  TType extends SchemaResourceType<TSchema>,
> = TSchema[TType] extends { relationships: infer TRelationships }
  ? TRelationships extends Record<string, RelationshipSchema>
    ? keyof TRelationships & string
    : never
  : never;
export type InferRelationshipTarget<
  TSchema extends JsonApiSchema,
  TType extends SchemaResourceType<TSchema>,
  TRelationship extends InferRelationshipNames<TSchema, TType>,
> = TSchema[TType] extends { relationships: infer TRelationships }
  ? TRelationships extends Record<string, RelationshipSchema>
    ? TRelationship extends keyof TRelationships
      ? TRelationships[TRelationship]["type"]
      : never
    : never
  : never;
export type JsonApiRelationshipData<
  TSchema extends JsonApiSchema,
  TType extends SchemaResourceType<TSchema>,
  TRelationship extends InferRelationshipNames<TSchema, TType>,
> = TSchema[TType] extends { relationships: infer TRelationships }
  ? TRelationships extends Record<string, RelationshipSchema>
    ? TRelationship extends keyof TRelationships
      ? TRelationships[TRelationship] extends { many: true }
        ? Array<{ type: TRelationships[TRelationship]["type"]; id: string }>
        : { type: TRelationships[TRelationship]["type"]; id: string } | null
      : never
    : never
  : never;
export type JsonApiResolvedRelationshipValue<
  TSchema extends JsonApiSchema,
  TType extends SchemaResourceType<TSchema>,
  TRelationship extends InferRelationshipNames<TSchema, TType>,
> = TSchema[TType] extends { relationships: infer TRelationships }
  ? TRelationships extends Record<string, RelationshipSchema>
    ? TRelationship extends keyof TRelationships
      ? TRelationships[TRelationship] extends { many: true }
        ? Array<JsonApiResource<TSchema, TRelationships[TRelationship]["type"]>>
        : JsonApiResource<TSchema, TRelationships[TRelationship]["type"]> | null
      : never
    : never
  : never;
export type JsonApiResource<
  TSchema extends JsonApiSchema,
  TType extends SchemaResourceType<TSchema>,
> = {
  type: TType;
  id: string;
  attributes: InferAttributes<TSchema, TType>;
  relationships?: {
    [TRelationship in InferRelationshipNames<TSchema, TType>]?: {
      data: JsonApiRelationshipData<TSchema, TType, TRelationship>;
      resolved: JsonApiResolvedRelationshipValue<TSchema, TType, TRelationship>;
      links?: JsonApiLinks;
      meta?: Record<string, unknown>;
    };
  };
  links?: JsonApiLinks;
  meta?: Record<string, unknown>;
};
export type JsonApiSingleDocument<
  TSchema extends JsonApiSchema,
  TType extends SchemaResourceType<TSchema>,
> = {
  data: JsonApiResource<TSchema, TType>;
  included?: JsonApiResource<TSchema, SchemaResourceType<TSchema>>[];
  meta?: Record<string, unknown>;
  links?: JsonApiLinks;
};
export type JsonApiCollectionDocument<
  TSchema extends JsonApiSchema,
  TType extends SchemaResourceType<TSchema>,
> = {
  data: Array<JsonApiResource<TSchema, TType>>;
  included?: JsonApiResource<TSchema, SchemaResourceType<TSchema>>[];
  meta?: Record<string, unknown>;
  links?: JsonApiLinks;
};
export type JsonApiQueryOptions<
  TSchema extends JsonApiSchema,
  TType extends SchemaResourceType<TSchema>,
> = {
  include?: readonly InferRelationshipNames<TSchema, TType>[];
  fields?: Partial<{
    [TFieldType in SchemaResourceType<TSchema>]: readonly (keyof InferAttributes<
      TSchema,
      TFieldType
    > &
      string)[];
  }>;
  sort?: readonly string[];
  page?: { number?: number; size?: number; offset?: number; limit?: number; cursor?: string };
  filter?: Record<string, string | number | boolean>;
};
export type JsonApiRelationshipPayload<
  TSchema extends JsonApiSchema,
  TType extends SchemaResourceType<TSchema>,
> = {
  [TRelationship in InferRelationshipNames<TSchema, TType>]?: {
    data: JsonApiRelationshipData<TSchema, TType, TRelationship>;
  };
};
export type JsonApiCreatePayload<
  TSchema extends JsonApiSchema,
  TType extends SchemaResourceType<TSchema>,
> = {
  attributes: InferAttributes<TSchema, TType>;
  relationships?: JsonApiRelationshipPayload<TSchema, TType>;
};
export type JsonApiUpdatePayload<
  TSchema extends JsonApiSchema,
  TType extends SchemaResourceType<TSchema>,
> = {
  attributes?: Partial<InferAttributes<TSchema, TType>>;
  relationships?: JsonApiRelationshipPayload<TSchema, TType>;
};
export interface JsonApiClientOptions {
  /** Absolute or root-relative prefix. A trailing slash is trimmed. */
  baseUrl: string;
  /** Transport. Defaults to the global `fetch`, resolved per call so a test can swap it. */
  fetcher?: typeof fetch;
  /** Merged over the JSON:API `Content-Type` / `Accept` pair — add auth here, or override the media type. */
  headers?: Record<string, string>;
}

/**
 * Options for {@link createJsonApiController} — the schema plus the transport.
 *
 * One object rather than `createJsonApiClient(schema, options)`: a positional
 * schema next to an options bag is the overload nobody can read at a call site,
 * and the plugin already had to combine them into a single `JsonApiPluginOptions`.
 */
export interface JsonApiOptions<TSchema extends JsonApiSchema> extends JsonApiClientOptions {
  schema: TSchema;
}

export interface JsonApiPluginOptions<
  TSchema extends JsonApiSchema,
> extends JsonApiOptions<TSchema> {
  readonly storeKey?: string;
}
export interface JsonApiClient<TSchema extends JsonApiSchema> {
  readonly schema: TSchema;
  findAll<TType extends SchemaResourceType<TSchema>>(
    type: TType,
    query?: JsonApiQueryOptions<TSchema, TType>
  ): Promise<JsonApiCollectionDocument<TSchema, TType>>;
  findOne<TType extends SchemaResourceType<TSchema>>(
    type: TType,
    id: string,
    query?: JsonApiQueryOptions<TSchema, TType>
  ): Promise<JsonApiSingleDocument<TSchema, TType>>;
  create<TType extends SchemaResourceType<TSchema>>(
    type: TType,
    payload: JsonApiCreatePayload<TSchema, TType>
  ): Promise<JsonApiSingleDocument<TSchema, TType>>;
  update<TType extends SchemaResourceType<TSchema>>(
    type: TType,
    id: string,
    payload: JsonApiUpdatePayload<TSchema, TType>
  ): Promise<JsonApiSingleDocument<TSchema, TType>>;
  delete<TType extends SchemaResourceType<TSchema>>(type: TType, id: string): Promise<void>;
}
/**
 * Default `$store.jsonApi` key registered by {@link jsonApiPlugin}. There is no
 * magic and no `DEFAULT_JSON_API_MAGIC_KEY`: this package registers a store only,
 * so `storeKey` is the one name to rename.
 */
export const DEFAULT_JSON_API_STORE_KEY = "jsonApi";
export type JsonApiAlpine = unknown;
export type JsonApiPluginCallback = (alpine: unknown) => void;
