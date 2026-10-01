/**
 * The base URLs that cross the boundary between the two apps and the repo.
 *
 * Everything here used to be a literal. The repo URL appeared in four places
 * across the two apps, and the docs `site:` was a third spelling of a fact a
 * deploy might reasonably want to be a different fact: a preview deployment is
 * not `ailuracollective.github.io`, and a fork is not `ailuracollective`.
 *
 * Every name defaults to the value that was hardcoded. That is deliberate: a
 * fresh clone has to build and pass its tests with no `.env` at all, so an
 * unset variable is never an error here. The env vars exist for the deploys
 * that need to differ, not as a requirement to be met.
 *
 * `PUBLIC_` is Astro's prefix for values that reach the browser. It is not a
 * secret marker and nothing sensitive is in this file.
 */

/** Where the apps live when nothing overrides them. */
export const URL_DEFAULTS = {
  PUBLIC_REPO_URL: "https://github.com/ailuracollective/alpinejs-toolkit",
  PUBLIC_DOCS_URL: "https://ailuracollective.github.io/alpinejs-toolkit",
  PUBLIC_DEMO_URL: "https://ailura.dev",
} as const;

/**
 * Parse the text of a `.env` file into a plain record.
 *
 * This exists only for `astro.config.mjs`, which runs before Astro populates
 * `import.meta.env` and so cannot see the file at all. The alternative was
 * Vite's `loadEnv`, but `vite` is not a declared dependency of this app — it
 * is only present transitively through `astro`, and pnpm's isolated
 * `node_modules` means importing it from here does not resolve. Adding a direct
 * dependency on a package that large to read three lines of `KEY=value` is the
 * worse trade.
 *
 * The file is read by the caller rather than here, so this module stays free of
 * `node:fs` and can still be bundled for the browser by the runtime half.
 *
 * Deliberately not a full dotenv parser. It handles the forms a hand-written
 * `.env` actually uses — `KEY=value`, optional `export`, `#` comments, blank
 * lines, single or double quotes — and ignores the exotic ones (`${VAR}`
 * interpolation, multi-line values) rather than half-supporting them. A
 * variable set but empty is dropped, so a blank key and an absent one behave
 * the same: the default wins.
 */
export function parseEnv(contents: string): Record<string, string> {
  const result: Record<string, string> = {};
  // `noUncheckedIndexedAccess` is on in this repo, so a regex match is typed
  // `string | undefined` even though a match that got this far has all its
  // groups. Destructuring under one guard says that once instead of three times.
  const assignment = /^\s*(?:export\s+)?([\w.-]+)\s*=\s*(.*?)\s*$/;

  for (const line of contents.split("\n")) {
    const match = assignment.exec(line);
    if (!match) continue;

    const [, key, raw] = match;
    if (key === undefined || raw === undefined) continue;

    const quoted = /^(['"])([\s\S]*)\1$/.exec(raw);
    const value = quoted ? (quoted[2] ?? "") : raw.replace(/\s+#.*$/, "");

    if (value !== "") result[key] = value;
  }

  return result;
}

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
 * would emit `href=""` and a `site` of nothing.
 */
function normalize(value: string | undefined, fallback: string): string {
  const chosen = value?.trim() ? value : fallback;
  return chosen.replace(/\/+$/, "");
}

/**
 * Build the URL set from an env record.
 *
 * A factory rather than a module of constants because the two callers read the
 * environment differently and must not be able to disagree: source code sees
 * `import.meta.env` (statically replaced by Vite at build time), while
 * `astro.config.mjs` runs before that exists and reads the file and
 * `process.env` itself. Sharing the factory keeps the defaults and the
 * trailing-slash handling written once.
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
