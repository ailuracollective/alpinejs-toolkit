<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="logo.svg" />
    <source media="(prefers-color-scheme: light)" srcset="logo-dark.svg" />
    <img src="logo-dark.svg" alt="Alpine.js Toolkit logo" width="140" />
  </picture>
</p>

<h1 align="center">Alpine.js Toolkit</h1>

<p align="center">
  A pnpm + TypeScript monorepo for small, focused
  <a href="https://alpinejs.dev">Alpine.js</a> plugins.
</p>

## Requirements

- **Node 22 LTS** (see `.node-version`; use the exact major in CI)
- **pnpm 12.3.4** via Corepack — `corepack enable && corepack prepare pnpm@latest --activate`
- **`vp` CLI (Vite+)** for install/dev/check/test/build/pack — install with
  `curl -fsSL https://vite.plus | bash`, then verify with `vp --version`

## Tooling

| Concern                          | Tool                                                                   | Command                                          |
| -------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------ |
| Format + lint + type-aware rules | Vite+ (`vp check`: Oxfmt + Oxlint)                                     | `vp check` / `vp check --fix`                    |
| Tests                            | Vite+ (`vp test`, Vitest, node mode)                                   | `vp test`                                        |
| Library build                    | `vp pack` (tsdown: ESM-first, dts, gzip+brotli report, publint + attw) | `vp run --recursive build`                       |
| App dev/build                    | Astro 7 (`apps/demo`)                                                  | `pnpm run dev:demo` / `vp run --recursive build` |
| Size budget                      | `size-limit` + `@size-limit/preset-small-lib`                          | `pnpm run size`                                  |
| Size analysis                    | `size-limit --why` (esbuild treemap)                                   | `pnpm run size:why`                              |

`vp check` does not replace `pnpm run typecheck` — full type-checking stays a
separate script (type-check via `vp check` is intentionally off until the
pre-existing gaps in type coverage are addressed).

`apps/demo` is an Astro app: `pnpm run dev:demo` starts the playground
(`http://localhost:4321`). It is demos only — no documentation — and it aliases
every workspace package to `packages/*/src`, so it always runs the working tree
and never needs a library build first.

## Quickstart

```bash
pnpm install
pnpm run dev:demo  # start the playground (http://localhost:4321)
pnpm run dev       # start the docs site
vp test            # run all package tests
pnpm run build     # pack all libraries to dist/ + build the apps
pnpm run size      # check every library against its size budget
pnpm run typecheck
```

## Size budgets

Every library ships with a measured size budget enforced by `size-limit`
(`@size-limit/preset-small-lib`: treeshaken ESM import, minified + brotlied).
Limits are set from measured sizes plus 10–20% headroom — never invented.

| Package                            | Measured (min+brotli) | Limit  | Headroom |
| ---------------------------------- | --------------------- | ------ | -------- |
| `@ailura/alpinejs-core` (barrel)   | 1558 B                | 1.8 kB | ~16%     |
| `@ailura/counter`                  | 243 B                 | 290 B  | ~19%     |
| `@ailura/alpinejs-plugin-template` | 223 B                 | 260 B  | ~17%     |

Per-layer `@ailura/alpinejs-core` budgets (`./controller`, `./guards`, …)
live in `packages/core/.size-limit.json`; see its README import-cost table.

Reference (not budgeted): `counter` `dist/index.mjs` is 978 B raw
(0.49 kB gzip, 0.41 kB brotli); the demo app bundle (Alpine.js included) is
55.35 kB (19.49 kB gzip).

To investigate a budget failure, run `pnpm run size:why` — it writes an
`esbuild-why.html` treemap into the package (gitignored) and opens it in a
browser. `vp pack` also enables tsdown `devtools` treemap output.

### Updating limits

Limits move deliberately, not reflexively:

1. Reproduce the new size locally (`pnpm run build && pnpm run size`).
2. Decide whether the growth is justified (new feature vs. accidental
   dependency or unbundled-external regression).
3. Review budgets quarterly; bump a limit only with a commit message that
   states the measured before/after numbers and the reason.
4. Never bump a limit just to turn CI green.

## Repo layout

```text
apps/demo/                 Interactive playground (Astro 7 + Tailwind 4)
apps/docs/                 Documentation site (Astro Starlight)
packages/plugin-template/  Copy-paste template for new plugins
packages/counter/          Working example plugin (store + directive)
scripts/new-plugin.mjs     Scaffolding script (`pnpm run new:plugin -- my-plugin`)
```

## How to add a new plugin

```bash
pnpm run new:plugin -- my-plugin
```

This copies `packages/plugin-template/` to `packages/my-plugin/`, replacing
name tokens (`plugin-template` / `pluginTemplate`). Then:

1. Rename anything left over in `packages/my-plugin/README.md`.
2. Implement your directive/magic/store in `src/index.ts`.
3. Add pure-function tests in `src/index.test.ts`.
4. Add an entry to `apps/demo/src/catalog/entries.ts` (layer, family, npm name)
   plus a demo under `apps/demo/src/components/demos/` to get it in the
   playground — the catalog test fails if an entry has no demo file.
5. Pack it (`vp pack` in the package dir) and tune its `size-limit` budget
   from the measured size (see Size budgets above).

## Versioning

- Packages are versioned independently (`0.x` while unstable).
- Use [Conventional Commits](https://www.conventionalcommits.org): `feat:`, `fix:`, `docs:`, `chore:`.
- Keep each plugin dependency-free at runtime; `alpinejs` is a peer-style
  parameter, never a bundled import (see the `pack.deps.neverBundle`
  setting in each library's `vite.config.ts`).

## Contributing

Branch from `master` and name the branch
`<github-username>/<type>/<description>` — your GitHub login, lowercased, then a
Conventional Commit type, then a short description:

```bash
OWNER=$(gh api user -q .login | tr '[:upper:]' '[:lower:]')
git checkout -b "$OWNER/feat/my-plugin" master
```

For example `siddharthagf/docs/sync-readmes` or `janedoe/fix/counter-store`. The
first segment must be **the PR author**, not the upstream owner, or the policy
gate rejects the PR. Name the branch before opening the PR: the check runs on
`pull_request` `opened` only and never re-runs on a rename.

Full details, including the required PR labels and the approved-issue rule, are
in [CONTRIBUTING.md](CONTRIBUTING.md).
