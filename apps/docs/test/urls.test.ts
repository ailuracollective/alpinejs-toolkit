/**
 * The cross-project URL builders.
 *
 * These three URLs were literals in six places, and one of them was already
 * wrong: `ChildDemo` pointed at `/docs/plugins/child/`, a path relative to the
 * demo's own origin, which 404s in dev and in production alike because the two
 * apps are deployed separately. Nothing in the demo's own routing could fix
 * that, so the fix had to be an absolute URL — and the only way to get one that
 * a fork or a preview deployment can change is to read it from the environment.
 *
 * So this file pins three things that are easy to regress silently:
 *
 * 1. The defaults still equal the values that were hardcoded, so a clone with
 *    no `.env` produces byte-identical output.
 * 2. Trailing slashes are stripped, because the values arrive by hand from a
 *    deploy and `docsUrl + "/plugins/x/"` must not become `...//plugins/x/`.
 * 3. `docsPageUrl` knows that English is served unprefixed. Passing `"en"`
 *    explicitly must NOT emit `/en/…`: Starlight's `root` locale means those
 *    pages do not exist, and a link to one is a 404.
 */
import { describe, expect, it } from "vite-plus/test";

import { createUrls, parseEnv, URL_DEFAULTS } from "../src/config/urls.js";

describe("cross-project urls", () => {
  it("falls back to the URLs that were previously hardcoded", () => {
    const { repoUrl, docsUrl, demoUrl } = createUrls({});

    expect(repoUrl).toBe("https://github.com/ailuracollective/alpinejs-toolkit");
    expect(docsUrl).toBe("https://ailuracollective.github.io/alpinejs-toolkit");
    expect(demoUrl).toBe("https://ailura.dev");
  });

  it("lets the environment override every base", () => {
    const { repoUrl, docsUrl, demoUrl } = createUrls({
      PUBLIC_REPO_URL: "https://github.com/fork/toolkit",
      PUBLIC_DOCS_URL: "https://fork.example.com/docs",
      PUBLIC_DEMO_URL: "https://fork.example.com",
    });

    expect(repoUrl).toBe("https://github.com/fork/toolkit");
    expect(docsUrl).toBe("https://fork.example.com/docs");
    expect(demoUrl).toBe("https://fork.example.com");
  });

  it("treats an empty value as unset, so a blank line cannot blank a URL", () => {
    // `.env.example` ships every key with an empty value. Copying it to `.env`
    // and forgetting to fill one in must not produce `href=""`.
    const urls = createUrls({ PUBLIC_REPO_URL: "", PUBLIC_DOCS_URL: undefined });

    expect(urls.repoUrl).toBe(URL_DEFAULTS.PUBLIC_REPO_URL);
    expect(urls.docsUrl).toBe(URL_DEFAULTS.PUBLIC_DOCS_URL);
  });

  it("strips trailing slashes so joining cannot produce a double slash", () => {
    const { docsUrl, docsPageUrl, repoFileUrl } = createUrls({
      PUBLIC_DOCS_URL: "https://example.com/docs/",
      PUBLIC_REPO_URL: "https://github.com/fork/toolkit//",
    });

    expect(docsUrl).toBe("https://example.com/docs");
    expect(docsPageUrl("/plugins/child/")).toBe("https://example.com/docs/plugins/child/");
    expect(repoFileUrl("/packages/core/README.md")).toBe(
      "https://github.com/fork/toolkit/blob/master/packages/core/README.md"
    );
  });

  it("does not prefix the English docs pages, which are served unprefixed", () => {
    // Starlight's `root` locale has no directory. `/en/plugins/child/` does not
    // exist, so a link to it is a 404 that looks like a routing bug elsewhere.
    const { docsPageUrl } = createUrls({});

    expect(docsPageUrl("/plugins/child/")).toBe(
      "https://ailuracollective.github.io/alpinejs-toolkit/plugins/child/"
    );
    expect(docsPageUrl("/plugins/child/", "en")).toBe(
      "https://ailuracollective.github.io/alpinejs-toolkit/plugins/child/"
    );
    expect(docsPageUrl("/plugins/child/", "es")).toBe(
      "https://ailuracollective.github.io/alpinejs-toolkit/es/plugins/child/"
    );
  });

  it("accepts a docs path with or without its leading slash", () => {
    const { docsPageUrl } = createUrls({ PUBLIC_DOCS_URL: "https://example.com" });

    expect(docsPageUrl("plugins/child/")).toBe(docsPageUrl("/plugins/child/"));
  });
});

describe("env file parsing", () => {
  // `astro.config.mjs` cannot use Vite's `loadEnv`: `vite` is not a declared
  // dependency of this app, only a transitive one through `astro`, and pnpm's
  // isolated `node_modules` means the import does not resolve. So the config
  // parses the file itself, and this is the whole of what that parser promises.
  it("reads the forms a hand-written .env actually uses", () => {
    const parsed = parseEnv(
      [
        "# a comment",
        "",
        "PUBLIC_REPO_URL=https://github.com/fork/toolkit",
        'PUBLIC_DOCS_URL="https://example.com/docs"',
        "export PUBLIC_DEMO_URL=https://example.com",
        "  SPACED = value  ",
      ].join("\n")
    );

    expect(parsed).toEqual({
      PUBLIC_REPO_URL: "https://github.com/fork/toolkit",
      PUBLIC_DOCS_URL: "https://example.com/docs",
      PUBLIC_DEMO_URL: "https://example.com",
      SPACED: "value",
    });
  });

  it("keeps a hash inside quotes and strips one outside", () => {
    const parsed = parseEnv(['QUOTED="a#b"', "BARE=a#b", "SPACED=a # comment"].join("\n"));

    expect(parsed.QUOTED).toBe("a#b");
    expect(parsed.BARE).toBe("a#b");
    expect(parsed.SPACED).toBe("a");
  });

  it("drops a key left empty, which is what .env.example ships", () => {
    const parsed = parseEnv("PUBLIC_REPO_URL=\nPUBLIC_DOCS_URL=https://example.com");

    expect(parsed).toEqual({ PUBLIC_DOCS_URL: "https://example.com" });
  });

  it("ignores lines that are not assignments", () => {
    expect(parseEnv("not an assignment\n=novalue\nKEY=value")).toEqual({ KEY: "value" });
  });
});
