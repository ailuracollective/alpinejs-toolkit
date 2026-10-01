import type { JsonApiErrorObject, JsonApiSchema, SchemaResourceType } from "./types";

export interface JsonApiRequestDetail<
  TSchema extends JsonApiSchema = JsonApiSchema,
  TType extends SchemaResourceType<TSchema> = SchemaResourceType<TSchema>,
> {
  readonly type: TType;
  readonly method: "GET" | "POST" | "PATCH" | "DELETE";
  readonly url: string;
}
export interface JsonApiResponseDetail<
  TSchema extends JsonApiSchema = JsonApiSchema,
  TType extends SchemaResourceType<TSchema> = SchemaResourceType<TSchema>,
> {
  readonly type: TType;
  readonly method: "GET" | "POST" | "PATCH" | "DELETE";
  readonly url: string;
  readonly ok: boolean;
  readonly status: number;
}
export interface JsonApiErrorDetail {
  readonly errors: readonly JsonApiErrorObject[];
  readonly status: number;
}

export interface JsonApiEvents extends Record<string, unknown[]> {
  request: [JsonApiRequestDetail];
  response: [JsonApiResponseDetail];
  error: [JsonApiErrorDetail];
}
