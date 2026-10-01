import { defineConfig } from "vite-plus";

// .gitignore keeps applying: both Oxfmt and Oxlint honour VCS ignore files.
//
// Oxfmt and Oxlint expose an ignore list but no include list, so the scope is
// expressed by negating every language they handle by default. What remains is
// **/*.js, **/*.ts, **/*.mjs, **/*.json, **/*.astro — the sources this repo
// authors.
const sourceScope = [
  "**/*.astro",
  "**/*.css",
  "**/*.gql",
  "**/*.graphql",
  "**/*.hbs",
  "**/*.html",
  "**/*.less",
  "**/*.md",
  "**/*.mdx",
  "**/*.scss",
  "**/*.svelte",
  "**/*.toml",
  "**/*.vue",
  "**/*.yaml",
  "**/*.yml",
];

// Generated or tool-owned, never hand-authored. Kept out of the scope above
// so they stay ignored even before .gitignore is consulted.
const explicitIgnores = [
  "**/pnpm-lock.yaml",
  "**/node_modules/**",
  "apps/demo/dist/**",
  "apps/demo/.astro/**",
  "apps/docs/dist/**",
  "apps/docs/.astro/**",
];

// Every package emits dist/, and the VitePress dependency cache is absent from
// .gitignore, so neither would be excluded by the VCS ignore file alone.
//
// `**/CHANGELOG.md` is generated, and by a tool whose output style this repository does not
// control. release-please writes every entry with a `*` bullet and a double blank line after
// each version heading; Oxfmt rewrites both to `-` and a single blank. Left in scope, that
// makes `vp check` fail on every release pull request, which means no release can ever merge —
// the release branch is blocked by the very changelog it is trying to ship. Excluded rather than
// fought: the file is never hand-edited, and a formatter that rewrites it would only create a
// conflict between what release-please regenerates and what CI accepts.
const generatedIgnores = ["**/dist/**", "**/.vitepress/cache/**", "**/CHANGELOG.md"];

// Markdown is handled differently by the two tools. Biome never formatted
// Markdown, which is why `**/*.md` and `**/*.mdx` sit in `sourceScope` above —
// that array feeds the ignore list of BOTH tools, because the port reproduced
// Biome's `files.includes` by negating every language Biome did not handle.
// Oxfmt *does* format Markdown (heading spacing, list markers, table padding,
// trailing whitespace), so leaving it ignored meant the repository's
// documentation — every package README, `ARCHITECTURE.md`, `AGENTS.md`, the
// `odd/` task records and the whole docs site under `apps/docs/` — was never
// formatted at all. Oxlint has no Markdown rules, so `lint` keeps ignoring
// Markdown and only `fmt` drops this entry.
const markdownScope = ["**/*.md"];

// `**/*.mdx` is deliberately kept OUT of `markdownScope`, so `fmt` ignores MDX
// and leaves it alone. MDX has no HTML comments — it rejects `<!-- -->` outright
// and tells you to write `{/* ... */}` — but Oxfmt escapes the `/*` inside such a
// comment to `/\*`, and MDX then fails with "Unexpected end of file in
// expression". The result is that `pnpm run format` silently breaks
// `pnpm run build` for the docs site, every time. MDX is a strict superset of
// Markdown for everything this repo authors, so the only real cost of skipping
// it is prose alignment. Re-enabling it requires dropping the JSX comment in the
// two `index.mdx` files, which is exactly what the escape protects against.

export default defineConfig({
  run: {
    // Vite Task caches task results in `node_modules/.vite/task-cache` and replays them on a
    // later run when the fingerprint still matches. Its documented default is
    // `{ scripts: false, tasks: true }`, and this repository runs almost everything through
    // `package.json` scripts — `vp run --recursive build`, `... typecheck`, `vp test` — not
    // through tasks declared here. With the default, every one of those reported
    // "Cache disabled in task configuration" and the hit rate was 0%.
    //
    // `scripts: true` changes that. Measured on an immediate second run:
    //
    //   vp run --recursive build     40/41 cache hit (97%), 100.88s saved
    //   vp run --recursive typecheck 42/44 cache hit (95%),  69.82s saved
    //   vp run --recursive size      39/39 cache hit (100),   7.06s saved
    //
    // The tasks that still miss are the Astro apps — `apps/demo#typecheck`, `apps/docs#typecheck`
    // and `apps/demo#build`, 21.5s combined. `astro check` and `astro build` write `.astro/` and
    // `dist/`, which automatic tracking then reads back as changed inputs. Fixing them needs
    // `cache.input` overrides, and those are only available on tasks declared in this file, and a
    // task cannot share a name with a `package.json` script. So it is not fixed here.
    //
    // Note that `vp test` is a direct command and is NOT cached even now; only `vp run <task>`
    // uses the task cache. Caching the suite needs a declared task for it.
    cache: {
      scripts: true,
    },
  },
  fmt: {
    ignorePatterns: [
      ...sourceScope.filter((pattern) => !markdownScope.includes(pattern)),
      ...explicitIgnores,
      ...generatedIgnores,
    ],
    useTabs: false,
    tabWidth: 2,
    printWidth: 100,
    singleQuote: false,
    semi: true,
    trailingComma: "es5",
    arrowParens: "always",
    sortImports: true,
  },
  lint: {
    ignorePatterns: [...sourceScope, ...explicitIgnores, ...generatedIgnores],
    plugins: ["typescript", "unicorn", "vitest"],
    options: {
      // Syntax-only linting, so no rule depends on type information. This is
      // also what keeps the type-aware default rules out.
      typeAware: false,
      typeCheck: false,
    },
    rules: {
      // No category is enabled: only the explicitly configured rules below are
      // enforced. Categories would pull in the plugin defaults listed at the
      // bottom of this block.

      // complexity
      "unicorn/no-array-for-each": "error",
      "unicorn/prefer-array-flat-map": "error",

      // correctness
      // Reports both unused variables and unused imports.
      "no-unused-vars": "error",

      // performance
      // This rule rejects only computed keys, and the Alpine contract requires
      // real key removal on reactive records. Controllers expose registries read
      // with the `in` operator and iterated by `x-for`, and `x-for` enumerates
      // own keys — assigning `undefined` would leave stale entries rendered. The
      // V8 dictionary-mode deopt only matters for large hot objects; these maps
      // hold one entry per registered instance.
      "typescript/no-dynamic-delete": "off",

      // security
      "no-eval": "error",
      "no-implied-eval": "error",

      // style
      "no-default-export": "off",
      "typescript/no-non-null-assertion": "error",
      "no-lonely-if": "error",
      "prefer-const": "error",
      "consistent-type-exports": "error",
      "prefer-for-of": "error",
      "unicorn/prefer-node-protocol": "error",
      "one-var": ["error", "never"],
      "prefer-template": "error",
      "unicorn/no-instanceof-array": "error",

      // suspicious
      "no-cond-assign": "error",
      "no-console": "warn",
      "no-debugger": "error",
      eqeqeq: "error",
      "no-empty": ["error", { allowEmptyCatch: true }],
      "typescript/no-explicit-any": "error",
      "no-global-assign": "error",
      "no-redeclare": "error",
      "no-shadow-restricted-names": "error",
      "require-await": "error",
      "default-case-last": "error",

      // Defaults of the enabled plugins. Pinned off so the enforced surface is
      // exactly the list above, with no implicit rules.
      "no-constant-condition": "off",
      "no-control-regex": "off",
      "no-extra-boolean-cast": "off",
      "no-unsafe-finally": "off",
      "no-unassigned-vars": "off",
      "no-unused-expressions": "off",
      "no-unused-private-class-members": "off",
      "no-useless-escape": "off",
      "typescript/no-base-to-string": "off",
      "typescript/no-redundant-type-constituents": "off",
      "typescript/no-this-alias": "off",
      "typescript/unbound-method": "off",
      "unicorn/no-new-array": "off",
      "unicorn/no-invalid-remove-event-listener": "off",
      "unicorn/no-thenable": "off",
      "unicorn/no-unnecessary-await": "off",
      "unicorn/no-useless-fallback-in-spread": "off",
      "unicorn/no-useless-spread": "off",
      "vitest/require-mock-type-parameters": "off",
      "vitest/require-to-throw-message": "off",
    },
    overrides: [
      {
        // Console output is the tool's job here.
        files: ["scripts/**"],
        rules: {
          "no-console": "off",
        },
      },
      {
        // Test files log on failure by design.
        files: ["**/test/**", "**/*.test.ts"],
        rules: {
          "no-console": "off",
        },
      },
      {
        // Test globals: vi, beforeEach, beforeAll, afterEach, afterAll,
        // describe, it, expect.
        files: ["**/test/**", "**/*.test.ts"],
        env: {
          vitest: true,
        },
        rules: {
          // A rule whose assertions live in a helper is still a test with
          // assertions. `test/instantiation-canon.test.ts` funnels every check
          // through `expectNoDivergence`, because each rule has to consult the
          // same `KNOWN_GAPS` table before it can call a violation a failure.
          "vitest/expect-expect": [
            "warn",
            { assertFunctionNames: ["expect", "expectNoDivergence"] },
          ],
        },
      },
    ],
  },
});
