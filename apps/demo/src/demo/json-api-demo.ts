import {
  createJsonApiController,
  type JsonApiCollectionDocument,
  type JsonApiSchema,
  type JsonApiSingleDocument,
} from "@ailura/alpinejs-json-api";

import type { AlpineInstance } from "../types/alpine.js";
import { createJsonApiMockFetcher } from "./json-api-mock.js";

/**
 * A schema is a plain record: the type parameter is what turns
 * `attributes` into real types, so no runtime builder is needed.
 */
const jsonApiSchema = {
  articles: {
    attributes: {} as { title: string; body: string },
    relationships: { author: { type: "people" as const } },
  },
  people: {
    attributes: {} as { name: string },
  },
} as const satisfies JsonApiSchema;

type Article = JsonApiCollectionDocument<typeof jsonApiSchema, "articles">["data"][number];
type ArticleDocument = JsonApiSingleDocument<typeof jsonApiSchema, "articles">;

export const jsonApiDemoOptions = {
  schema: jsonApiSchema,
  baseUrl: "/json-api",
  fetcher: createJsonApiMockFetcher(),
};

// The controller takes the same options object the plugin gets: naming the
// schema again in front of the spread only overwrote it with itself.
export const jsonApiClient = createJsonApiController(jsonApiDemoOptions);

type Row = { id: string; title: string; author: string };

type JsonApiDemoData = {
  sort: "title" | "-title";
  rows: Row[];
  selectedId: string | null;
  detail: { id: string; title: string; body: string; author: string } | null;
  loading: boolean;
  detailLoading: boolean;
  error: string | null;
  /** Rolling log of the controller's request / response / error events. */
  events: { id: number; kind: string; message: string }[];
  seq: number;
  offRequest: (() => void) | null;
  offResponse: (() => void) | null;
  offError: (() => void) | null;
  log(kind: string, message: string): void;
  init(): void;
  loadList(): Promise<void>;
  toggleSort(): Promise<void>;
  selectArticle(id: string): Promise<void>;
  clearDetail(): void;
  createArticle(): Promise<void>;
  renameSelected(): Promise<void>;
  deleteSelected(): Promise<void>;
};

/**
 * `relatedName()` resolves a to-one relationship the way JSON:API intends:
 * read the resource identifier off `relationships`, then match it against the
 * `included` array. `createJsonApiController()` returns the document as parsed — it
 * does not stitch `included` onto the relationship itself — so the demo does
 * that lookup here instead of reading a `resolved` field that never arrives.
 */
function relatedName(relationship: unknown, included: unknown): string {
  const data = (relationship as { data?: { id?: string } | null } | undefined)?.data;
  const id = data && !Array.isArray(data) ? data.id : undefined;
  if (!id || !Array.isArray(included)) {
    return "Unknown";
  }

  const match = included.find((item) => (item as { id?: string }).id === id) as
    | { attributes?: Record<string, unknown> }
    | undefined;
  const name = match?.attributes?.name;

  return typeof name === "string" ? name : "Unknown";
}

function toRow(article: Article, included: unknown): Row {
  return {
    id: article.id,
    title: article.attributes.title,
    author: relatedName(article.relationships?.author, included),
  };
}

export function registerJsonApiDemo(Alpine: AlpineInstance): void {
  Alpine.data("jsonApiDemo", (): JsonApiDemoData => ({
    sort: "title",
    rows: [],
    selectedId: null,
    detail: null,
    loading: false,
    detailLoading: false,
    error: null,
    events: [],
    seq: 0,
    offRequest: null,
    offResponse: null,
    offError: null,

    init() {
      // The request / response / error events are the most useful thing this
      // package offers — a devtools log you own, without touching the network
      // layer — and the demo rendered none of them. Wired here so the panel in
      // the page has something to show.
      this.offRequest = jsonApiClient.on("request", (detail) => {
        this.log("request", `${detail.method} ${detail.url}`);
      });
      this.offResponse = jsonApiClient.on("response", (detail) => {
        this.log("response", `${detail.status} ${detail.method} ${detail.url}`);
      });
      this.offError = jsonApiClient.on("error", (detail) => {
        this.log("error", `status ${detail.status}`);
      });

      void this.loadList();
    },

    log(kind: string, message: string) {
      this.events = [{ id: ++this.seq, kind, message }, ...this.events].slice(0, 6);
    },

    async loadList() {
      this.loading = true;
      this.error = null;

      try {
        const document = await jsonApiClient.findAll("articles", {
          include: ["author"],
          sort: [this.sort],
        });
        this.rows = document.data.map((article) => toRow(article, document.included));
      } catch (error) {
        this.error = (error as Error).message;
        this.rows = [];
      } finally {
        this.loading = false;
      }
    },

    async toggleSort() {
      this.sort = this.sort === "title" ? "-title" : "title";
      await this.loadList();
    },

    async selectArticle(id) {
      this.selectedId = id;
      this.detailLoading = true;
      this.error = null;

      try {
        const document: ArticleDocument = await jsonApiClient.findOne("articles", id, {
          include: ["author"],
        });
        this.detail = {
          id: document.data.id,
          title: document.data.attributes.title,
          body: document.data.attributes.body,
          author: relatedName(document.data.relationships?.author, document.included),
        };
      } catch (error) {
        this.error = (error as Error).message;
        this.detail = null;
      } finally {
        this.detailLoading = false;
      }
    },

    clearDetail() {
      this.selectedId = null;
      this.detail = null;
    },

    async createArticle() {
      await jsonApiClient.create("articles", {
        attributes: {
          title: `Article ${this.rows.length + 1}`,
          body: "Created with client.create()",
        },
      });
      await this.loadList();
    },

    async renameSelected() {
      if (!this.detail) {
        return;
      }

      await jsonApiClient.update("articles", this.detail.id, {
        attributes: { title: `${this.detail.title} ✏️` },
      });
      await this.loadList();
      await this.selectArticle(this.detail.id);
    },

    async deleteSelected() {
      if (!this.selectedId) {
        return;
      }

      const id = this.selectedId;
      this.clearDetail();
      await jsonApiClient.delete("articles", id);
      await this.loadList();
    },
  }));
}
