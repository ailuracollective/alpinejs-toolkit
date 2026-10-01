/**
 * The base URLs that cross the boundary between the two apps and the repo.
 *
 * Everything here used to be a literal: the GitHub URL was repeated in the
 * header, the footer and twice in the catalog, and `ChildDemo` linked to
 * `/docs/plugins/child/` — a path relative to the demo's own origin, where the
 * docs site does not exist. That link was a 404 in dev and in production
 * alike, and no arrangement of the demo's own routes could have fixed it,
 * because the two apps are deployed separately.
 *
 * Every name defaults to the value that was hardcoded, so a fresh clone builds
 * and passes its tests with no `.env`. The vars exist for deploys that need to
 * differ — a fork, a preview deployment, a staging docs site — not as a
 * requirement to be met.
 *
 * `PUBLIC_` is Astro's prefix for values that reach the browser. It is not a
 * secret marker and nothing sensitive is in this file.
 *
 * Kept deliberately parallel to `apps/docs/src/config/urls.ts` rather than
 * shared as a workspace package: the two apps have separate deploy pipelines
 * and no dependency between them today, and a package would add a build step
 * and an edge to that for about fifty lines.
 */

/** Where the apps live when nothing overrides them. */
export const URL_DEFAULTS = {
  PUBLIC_REPO_URL: "https://github.com/ailuracollective/alpinejs-toolkit",
  PUBLIC_DOCS_URL: "https://ailuracollective.github.io/alpinejs-toolkit",
  PUBLIC_DEMO_URL: "https://ailura.dev",
} as const;

export type UrlEnv = Partial<Record<keyof typeof URL_DEFAULTS, string | undefined>>;

export type Urls = {
  /** The GitHub repository, without a trailing slash. */
  repoUrl: string;
  /** The docs site, without a trailing slash. */
  docsUrl: string;
  /** The demo site, without a trailing slash. */
  demoUrl: string;
  /**
   * A path inside the docs site.
   *
   * `locale` is the Starlight locale directory, not a language tag: English is
   * served unprefixed, so `"en"` must yield `/plugins/x/` and only a non-root
   * locale gets a prefix. Passing `"en"` explicitly is therefore correct, and
   * omitting it means English.
   */
  docsPageUrl: (path: string, locale?: "en" | "es") => string;
  /** A permalink to a file in the repo, on the default branch. */
  repoFileUrl: (repoPath: string) => string;
};

/**
 * Trailing slashes are stripped so joining never produces `//`.
 *
 * An empty string counts as unset, not as a value. `.env.example` ships every
 * key with an empty value, so copying it to `.env` and filling in only some of
 * them is the expected first attempt — and `"" ?? fallback` is `""`, which
 * would emit `href=""`.
 */
function normalize(value: string | undefined, fallback: string): string {
  const chosen = value?.trim() ? value : fallback;
  return chosen.replace(/\/+$/, "");
}

/**
 * Build the URL set from an env record.
 *
 * A factory rather than a module of constants so the defaults and the
 * trailing-slash handling are written once even though the two callers read
 * the environment differently: source code sees `import.meta.env` (statically
 * replaced by Vite at build time), while `astro.config` runs before that and
 * would otherwise need its own copy of the defaults.
 */
export function createUrls(env: UrlEnv): Urls {
  const repoUrl = normalize(env.PUBLIC_REPO_URL, URL_DEFAULTS.PUBLIC_REPO_URL);
  const docsUrl = normalize(env.PUBLIC_DOCS_URL, URL_DEFAULTS.PUBLIC_DOCS_URL);
  const demoUrl = normalize(env.PUBLIC_DEMO_URL, URL_DEFAULTS.PUBLIC_DEMO_URL);

  return {
    repoUrl,
    docsUrl,
    demoUrl,
    docsPageUrl: (path, locale = "en") => {
      const suffix = path.startsWith("/") ? path : `/${path}`;
      const prefix = locale === "en" ? "" : `/${locale}`;
      return `${docsUrl}${prefix}${suffix}`;
    },
    repoFileUrl: (repoPath) => `${repoUrl}/blob/master/${repoPath.replace(/^\/+/, "")}`,
  };
}

/**
 * The live set, for source code.
 *
 * Each name is read as its own literal rather than looked up through a
 * variable name: Vite replaces `import.meta.env.PUBLIC_FOO` at build time but
 * cannot see through `import.meta.env[name]`, which would reach the browser as
 * a live lookup of an object that does not exist there.
 */
export const urls = createUrls({
  PUBLIC_REPO_URL: import.meta.env.PUBLIC_REPO_URL,
  PUBLIC_DOCS_URL: import.meta.env.PUBLIC_DOCS_URL,
  PUBLIC_DEMO_URL: import.meta.env.PUBLIC_DEMO_URL,
});

export const REPO_URL = urls.repoUrl;
export const DOCS_URL = urls.docsUrl;
export const DEMO_URL = urls.demoUrl;
export const docsPageUrl = urls.docsPageUrl;
export const repoFileUrl = urls.repoFileUrl;
