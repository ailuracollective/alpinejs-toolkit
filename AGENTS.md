# AGENTS.md

This file provides guidance to AI agents and contributors working in this repository.

## Repository structure

This is a pnpm monorepo containing 40 Alpine.js plugin packages organized by layer:

- **Foundation** — `core`, `ui`, `state-machine`, `testing` (zero or minimal peers)
- **Primitives** — `env`, `media`, `notify`, `selection`, `collection`, `child`, `scroll`, `calendar`, `form`, `gesture`, `keyboard`, `history`, `timer`, `toast`, `transfer`, `permissions`, `geo`, `lang`
- **Features** — `accordion`, `tabs`, `dialog`, `menu`, `tooltip`, `overlay`, `attention`, `theme`, `sidebar`, `carousel`, `command`, `virtual`
- **Data** — `query`, `query-adapter-*`, `json-api`
- **Template** — `plugin-template` (scaffold, never published)

That is 40 package folders in `packages/` and 40 project references into `packages/`
in the root `tsconfig.json` — one per folder, no extras (the file has 41 `"path"`
entries; the 41st is `./apps/docs`). `query-adapter-*` is three packages today:
`query-adapter-alpine`, `query-adapter-zustand` and `query-adapter-nanostores`, all
three implementing the one `QueryStateAdapter` contract that `query` owns.

Of those 40, **37** are browser plugins in the demo catalog. The derivation is
40 folders − `ui` (framework-agnostic helpers), `testing` (test harness) and
`plugin-template` (scaffold) = **37**, the number asserted by
`apps/demo/test/catalog.test.ts`. Do not conflate the two numbers: the folder count
is 40, the catalog count is 37, and the gap is exactly three packages that ship no
browser plugin by design.
[ARCHITECTURE.md](ARCHITECTURE.md) §11 holds the authoritative per-layer split, and
`apps/demo/test/catalog.test.ts` asserts against it — including `toast` being a
Primitives, which is counter-intuitive and has been got wrong here before.

## Package README template

When creating or updating a package README, use the template at [`agents/README.template.md`](agents/README.template.md).

The template includes:

- Placeholders: `{{kebab}}`, `{{Pascal}}`, `{{camel}}`, `{{SCREAMING}}` — you substitute
  these by hand. `scripts/new-plugin.mjs` does **not** fill them; it only rewrites
  `plugin-template` and `pluginTemplate` in the files it copies out of
  `packages/plugin-template/`.
- Layer selection: Foundation | Primitives | Features | Data | Template
- Sections: Installation, Usage, API, Options, Store API, Events, SSR, Accessibility, Browser support, Integration, Limitations, Size, Architecture, Testing, License

The file must land at exactly `packages/<name>/README.md`:
`apps/demo/test/catalog.test.ts` asserts `readmePath === packages/${folder}/README.md`
for all 37 entries, and every demo page links it.

### Quick start

1. Copy `agents/README.template.md` to `packages/<name>/README.md`
2. Replace all placeholders with the actual package name
3. Choose the appropriate layer and usage pattern (A-E)
4. Fill in real code examples — every code block must be copy-paste runnable
5. Delete the HTML comment blocks before publishing

## Demo page template

Every file in `apps/demo/src/components/demos/` is a published page and follows
[`agents/DEMO.template.md`](agents/DEMO.template.md).

A demo page is a **fragment**, not a page: one `DemoSection` sourced from the
catalog, containing examples that call the real package. It does not lay out,
take props, print the package name, or reimplement what it demonstrates.

### Quick start

1. Copy `agents/DEMO.template.md` and follow the anatomy section
2. Read "Judged by review" — the rules a test cannot decide
3. Register the plugin in `apps/demo/src/alpine-boot.ts` — without it the page is
   inert and the `genuine/*` rules fail
4. `pnpm exec vp test apps/demo/test` — `demo-page-contract.test.ts` checks
   structure and genuineness against the packages' own declarations

There are 37 demo pages, one per catalog entry with `demo: { available: true }`.
`agents/DEMO.template.md` lists the five wiring points and the seven packages in
`SURFACE_OVERRIDES`.

### Why the rules are enforced

A demo's whole claim is _this is what the package does_, and every failure is
silent: the page renders, the markup reads correctly, nothing warns you. A
renamed method, a dropped option, or a hand-rolled stand-in all look fine until
a reader copies them. The contract test reads each page's text and checks every
`$store.x.y` and `$x.y` against the `*Store`/`*Magic` types the owning package
actually declares, so the check cannot drift from the thing it checks.

## Architecture

All packages follow a strict canon documented in [ARCHITECTURE.md](ARCHITECTURE.md):

- **Controller + Plugin pattern**: `controller.ts` owns state, `plugin.ts` integrates with Alpine
- **SSR-safe**: No `window`/`document` at import time — use `safeWindow()`/`safeDocument()` from `@ailura/alpinejs-core/env`
- **Registration guards**: `guardStore()`, `guardMagic()` and `guardDirective()` prevent collisions
- **Event emission**: Typed events via `BaseController`
- **No runtime `dependencies`**: no `packages/*/package.json` has a `dependencies`
  block. `alpinejs`, `@ailura/alpinejs-core` and any third-party runtime are
  peers, so the host installs them — do not write that core "installs itself"

## Development commands

```sh
pnpm install          # install all workspaces
pnpm test             # full test suite
pnpm run typecheck    # tsc --noEmit across packages
pnpm run build        # compile all packages to dist/
pnpm run size         # size-limit across packages
pnpm run lint         # vp lint (Oxlint)
pnpm run format       # vp fmt (Oxfmt)
pnpm run check        # vp check — lint + format + typecheck
```

Scoped to one package, from the repo root:

```sh
pnpm exec vp test packages/<name>
pnpm exec tsc --noEmit -p packages/<name>/tsconfig.json
```

Tooling comes from **Vite Plus** (`vp`), not a standalone linter/formatter
binary. `vite.config.ts` at the root holds the `fmt` and `lint` config. Code
samples in docs and READMEs use **double quotes** — `fmt.singleQuote: false`.

## Branches and pull requests

Enforced, not advisory. `ci.yml` validates the code; `.github/workflows/policy.yml` validates
the process. An agent opening a PR here satisfies every gate below or the PR does not merge.

`policy.yml` calls three shared actions from this organisation, and each one is the single owner
of its gate. Do not re-implement any of them in a repository workflow, and do not add a second
copy: a gate enforced twice drifts, because one copy gets fixed while the other keeps
rejecting, or stops rejecting.

### Branch name

Owned by the `branch-validation` job in `policy.yml`
(`ailuracollective/actions/branch-validation@v2`), which requires the head branch to read
`<author>/<type>/<description>` **and** to be owned by its author.

```
^[a-z0-9-]+/(feat|fix|chore|docs|style|refactor|perf|test|build|ci|revert)/[a-z0-9._-]+$
```

- The **first segment must equal the PR author's GitHub login, lowercased**. For a fork PR the
  author and the head-ref owner are different people, so name the branch after the person who
  opened the PR, not after whoever owns the upstream repository.
- **Eleven** types. `breaking-change` is the twelfth Conventional Commit type but not a branch
  segment: it describes the commit, not the shape of the work.
- The description may use `a-z`, `0-9`, dots, hyphens and underscores.
- `dependabot[bot]` is exempt from both the branch gate and the PR gate. Its head refs are
  `dependabot/pnpm/<pkg>-<version>`, which carry no type segment.

```bash
OWNER=$(gh api user -q .login | tr '[:upper:]' '[:lower:]')
git checkout -b "$OWNER/ci/release-automation" master
```

### The remaining five gates

All five are owned by the single `pull-request-policy` job in `policy.yml`
(`ailuracollective/actions/pull-request@v2`). Each has an `enable-*` input defaulting to `true`,
and `policy.yml` overrides none of those five, so all five are active. It sets one other `enable-*`
input on the same job — `enable-status-comment: false` — which is not a gate: it turns off the status
comment `v2` publishes into the pull request conversation. Publishing needs either a write-scoped
token belonging to the organisation, or `pull-requests: write` on the job plus
`comment-author: github-actions[bot]`; this repository has neither, so the job summary carries the
same table instead.

| Gate             | Input                       | Requirement                                                                                                                                                                                                                                                             |
| ---------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Linked issue     | `enable-linked-issue`       | Body carries `Closes #N`, `Fixes #N` or `Resolves #N` pointing at an issue that carries `status/ready` (`approved-label`). **`Refs #N` does not close an issue and fails this gate.** An agent must not apply `status/ready` to its own issue; a maintainer triages it. |
| Type label       | `enable-type-label`         | **Exactly one** of `type/feature`, `type/bug`, `type/documentation`, `type/improvement`, `type/task`. Zero or more than one fails.                                                                                                                                      |
| PR title length  | `enable-title-length`       | 15-72 characters (`title-min` / `title-max`).                                                                                                                                                                                                                           |
| PR title shape   | `enable-title-conventional` | A Conventional Commit subject: `<type>(\<scope\>)!: <description>`. The accepted types are the twelve Conventional Commit types, which are **not** the labels: the breaking type is `breaking-change`, not `breaking`.                                                  |
| PR body sections | `enable-body-structure`     | Every `## ` heading declared by the type's template must appear in the body. Templates resolve from `.github/PULL_REQUEST_TEMPLATE/<type>.md`, falling back to `.github/PULL_REQUEST_TEMPLATE.md` for a type that has none.                                             |

A sixth gate lives in the `triage` job (`ailuracollective/actions/triage@v2`): it stamps
`status/needs-review` on every newly opened issue. It never removes a label, so a deliberate
maintainer removal sticks. It is the only job in this repository granted `issues: write`.

`policy.yml` re-runs on `opened`, `synchronize`, `reopened`, `edited`, `labeled` and
`unlabeled`, so adding or removing a label re-evaluates the gates that read labels.

### Labels must already exist on the remote

`.github/labels.yml` is a reviewed manifest of the label set, not something GitHub reads. The thirty
labels it declares already exist on the remote, so the manifest records a set rather than a plan to
create one; the reconciliation recipe at the bottom of that file is how they are re-applied after an
edit, and how one is pruned. The `type-labels` list in `policy.yml` mirrors the manifest's `type/*`
family: change one, mirror the other.

A gate that names a label the remote does not have is unsatisfiable rather than merely strict — the
check can never be passed, because there is no label to apply. That is not hypothetical: the
repository once enforced a bare twelve-label set that was later deleted, which left the type-label and
linked-issue gates impossible to satisfy until this realignment.

### Two vocabularies: labels are not title types

Labels and PR titles use deliberately different sets, and the gates read them separately.

| Aspect | Vocabulary                                                                        | Read by                                                   |
| ------ | --------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Label  | `type/feature`, `type/bug`, `type/documentation`, `type/improvement`, `type/task` | the type-label gate                                       |
| Title  | the twelve Conventional Commit types, `breaking-change` included                  | the title-shape gate, release-please, template resolution |

The label is coarser than the title: a `ci` pull request carries the label `type/task` while its title
reads `ci(scope): ...`. The corollary is that **no label carries the title's type**, so no `type/*`
label marks a breaking change.

### Commits and the PR title are the same contract

Because release-please parses the **squash commit message**, the PR title becomes the release
note. A conventional commit without a `!` and without a `BREAKING CHANGE:` footer releases as a
minor bump, because nothing reads a label to decide this — the label set has no breaking member to
read. See [CONTRIBUTING.md](CONTRIBUTING.md) for the release flow.

### Removed: `.github/workflows/pr-validation.yml`

That file was a hand-rolled predecessor. Every one of its eight jobs is a gate that
`policy.yml` now owns through the shared actions above, which is what its own header meant by
"the workflow this file replaces". Keeping both enforced the same rules twice. It was removed
in #232; nothing lost coverage, and the gates that had been failing on every push stopped
failing.

## Adding a new package

1. Run the scaffold script: `pnpm run new:plugin -- <name>` (or copy `packages/plugin-template/`)
2. Update `package.json` with the correct name and metadata
3. Create README from `agents/README.template.md`
4. Implement controller + plugin following the canon
5. Add tests using `@ailura/alpinejs-testing`
6. Add `.size-limit.json` with appropriate budget
7. Add a catalog entry and demo page — see the two sections above
