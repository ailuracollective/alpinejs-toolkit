# Contributing

## Branches

- `master` is always releasable.
- Create feature branches from `master` named `<github-username>/<type>/<description>`, where
  `<github-username>` is the responsible contributor's GitHub login, lowercased, and
  `<type>` is a Conventional Commit type (`feat`, `fix`, `chore`, `docs`, `style`,
  `refactor`, `perf`, `test`, `build`, `ci`, `revert`).

  ```bash
  OWNER=$(gh api user -q .login | tr '[:upper:]' '[:lower:]')
  git checkout -b "$OWNER/feat/my-plugin" master
  ```

  Examples: `janedoe/feat/my-plugin`, `janedoe/fix/counter-store`,
  `janedoe/docs/readme`.

  This is enforced, not advisory. `.github/workflows/policy.yml` runs a
  `branch-validation` gate that checks both the shape and the ownership: the
  first segment must match the pull request author's login, so a fork PR must be
  named after the contributor who opened it, not after whoever owns the upstream
  repo. That gate re-runs on `synchronize`, so a branch renamed while the pull
  request is open is re-validated on the next push.

## Commits

Use Conventional Commits:

- `feat: add x-counter directive`
- `fix: reset store on destroy`
- `docs: clarify demo setup`
- `chore: bump typescript`

## Before opening a PR

```bash
vp test
pnpm run typecheck
vp check
pnpm run size
```

CI runs these plus the build, in this order: `pnpm run check`, `pnpm run build`,
`pnpm run test`, `pnpm run size`, `pnpm run typecheck`. The build is not last
and not incidental — the test suite resolves workspace packages through their
`exports` maps, and every subpath there points at `dist/`, so the suite cannot
run until the build has produced it. A clean checkout with no `dist/` fails with
`Cannot find package '@ailura/alpinejs-core/controller'`.

## Releases

Releases are automated with [release-please](https://github.com/googleapis/release-please). Do not bump a version by hand. Do not edit a `version` field and do not edit a `CHANGELOG.md`: the next release overwrites both, and the edit is lost without ever being reviewed.

Merging to `master` makes release-please open one release PR per changed package. Merging that PR creates the tag, the GitHub Release and the changelog entry. It does not publish. `.github/workflows/publish.yml` does, and it is triggered by the GitHub Release itself — `release: published`, one run per released package.

That choice is load-bearing, in the direction that is easy to get backwards. GitHub documents that events created with the built-in `GITHUB_TOKEN` do not start new workflow runs, with exactly two exceptions: `workflow_dispatch` and `repository_dispatch`, which always do. A GitHub Release created with `GITHUB_TOKEN` therefore cannot fire a `release: published` trigger, and the chain would stop dead at the tag. So the trigger depends on `RELEASE_PLEASE_TOKEN`: release-please has to create the release with the personal access token, not the built-in one, or nothing publishes. The token is load-bearing for publication, not only for attribution.

This repository did it the other way first. Publication ran on a `repository_dispatch` emitted by `release-please.yml` on `GITHUB_TOKEN`, precisely to keep stored credentials out of the path — and it never fired: the dispatch call returned success and `repository_dispatch` produced zero runs across the whole repository. The indirection was also a step longer for no benefit. The release event carries the tag name directly, so `publish.yml` needs no lookup, and `RELEASE_PLEASE_TOKEN` already existed for authorship. `release: published` works directly and the dispatch is gone.

**Squash-merge every release PR, and take the squash commit message from the PR title.** release-please parses squash commit messages. A merge commit or a rebase merge leaves it reading commits that only ever existed inside the PR, and the version bump silently never happens.

Mark a breaking change in the commit subject, not only in a label:

- `feat!: drop the legacy directive`
- `fix!: reset state on destroy`
- a `BREAKING CHANGE:` footer on the commit

The `breaking-change` label is **not** sufficient on its own. release-please reads commits, not labels: a PR carrying only that label merges, opens a release PR, and bumps the version as a plain minor. Put the `!` or the footer in the commit itself. This is the single most likely mistake in the whole release flow.

While a package is below `1.0.0`, a breaking change bumps the minor, not the major (`bump-minor-pre-major`). Do not hand-correct that to a major bump.

Packages version independently. Bumping one also bumps its dependents, including across a breaking bump, because `always-link-local` rewrites the internal `workspace:*` ranges and the publish step resolves them to exact versions.

Two secrets have to exist before the first release:

- `NPM_TOKEN` — an npm automation token authorized to publish under the `@ailura` scope.
- `RELEASE_PLEASE_TOKEN` — a **classic** personal access token belonging to `AiluraKitty`, with the `repo` and `workflow` scopes. It makes release commits attributable to that account instead of `github-actions[bot]`, and it is also what makes `release: published` fire at all, so removing it breaks publication.

**The release token gates publication, not just authorship.** Because `publish.yml` triggers on the release event, revoking `RELEASE_PLEASE_TOKEN` does not merely mis-attribute the next release: it stops the chain at the tag, silently, with a PR merged and a version bumped but nothing on npm. That is the real cost of this design and it is accepted deliberately. The alternative — publishing from a `GITHUB_TOKEN` release — cannot work at all, since such a release cannot fire the trigger, and an unattributable release is not worth having either. Treat this token as load-bearing: if it is ever revoked, publication stops until it is restored.

Do not substitute `GITHUB_TOKEN` for it. Authorship will silently regress to `github-actions[bot]` and publication will silently stop.

The published version is attested independently of both: the publish job requests `id-token: write`, so npm provenance signs the tarball against the workflow file and the repository without trusting a long-lived secret to make that claim.

Two packages are excluded from the release config: `packages/testing` is private, and `packages/plugin-template` is a scaffold and is never published.

No package has been published yet, so nothing opens a release PR until the first `feat:` or `fix:` reaches `master`. The manifest pins every package at `0.0.0`, and there is no `bootstrap-sha`, so release-please reads the whole history rather than resuming from a point. That first PR proposes `0.1.0` for a package whose commits include a `feat:` and `0.0.1` for one that only received a `fix:`, and nothing at all for the rest. That is correct, not a bug.
