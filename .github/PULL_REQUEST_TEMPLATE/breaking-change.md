# Breaking change

<!--
Use when a consumer must change their code to keep working. Every breaking change needs a
migration path; a PR that only says "this changed" cannot be reviewed.
-->

Short paragraph: what breaks, for whom, and the version it lands in.

## Linked issue (required)

<!-- The linked issue MUST carry the `status:approved` label. Apply exactly one of these
closing keywords on its own line. `Refs #N` does NOT close the issue and does not satisfy
this requirement. -->

Closes #

## Type (required)

<!-- Check exactly ONE. Labels are bare Conventional Commit types with no `type:` prefix:
feat, fix, docs, refactor, chore, style, perf, test, build, ci, revert, breaking-change -->

- [ ] `breaking-change` — consumers must change their code

## What breaks and for whom

<!-- Name the affected surface (exported symbol, component, config key, CLI flag, option
default) and the consumers it hurts: library users, plugin authors, CLI users, anyone
relying on the old default. -->

| Surface                 | Who is affected | How             |
| ----------------------- | --------------- | --------------- |
| `path/to/file` — symbol | consumer group  | required change |

## Before / after

<!-- Exact code, not paraphrase. The "before" must match the current released API. -->

**Before**

```ts
// current API
```

**After**

```ts
// new API
```

## Migration

<!-- Copy-pasteable. A consumer should be able to apply this without reading the diff. -->

```ts
// migration: minimal change a consumer must make
```

## Codemod feasibility

- [ ] A codemod is possible and included in this PR
- [ ] A codemod is possible and will be delivered separately — <!-- issue link -->
- [ ] Not feasible — <!-- explain why: dynamic shapes, type-only change, too small to be worth automating, or the surface is not statically analyzable -->

<!-- If a codemod is included, name its path and how to run it. -->

## Affected version range

<!-- The versions that keep working, the versions that break, and the first version with
the new behavior. -->

- **First version with the change:**
- **Works unchanged from:** <!-- version range, e.g. "1.x through 2.3.x" -->
- **Breaks from:** <!-- version, e.g. "2.4.0" -->
- **Removal of the old path (deprecated, not removed):** <!-- version, or "not scheduled" -->

## Deprecation plan

<!-- If the old behavior is kept temporarily behind a flag, name the flag, the default, and
the version the flag is removed in. Otherwise write "No deprecation window: the old path
is removed in the same release." -->

## Test plan

<!-- These are the checks CI runs for every pull request. All of them must pass. -->

- [ ] `vp check` — lint and formatting
- [ ] `vp test` — test suite
- [ ] `vp run --recursive build` — workspace builds
- [ ] `pnpm run size` — bundle size budget
- [ ] `pnpm run typecheck` — TypeScript types
- [ ] Migration snippet applied and verified against the new API

## Contributor checklist

- [ ] Linked an approved issue with `Closes #N`, `Fixes #N` or `Resolves #N`
- [ ] The linked issue carries the `status:approved` label
- [ ] Branch is named `<github-username>/<type>/<description>`, all lowercase
      (for example `janedoe/feat/redesign-skill-loading`)
- [ ] Added exactly one label from the allowed set, with no `type:` prefix
- [ ] Commit messages use Conventional Commits with the `!` marker (for example `feat!: ...`)
- [ ] No `Co-Authored-By` trailers
- [ ] Migration path documented and copy-pasteable
- [ ] Documentation updated with the breaking change and the migration
- [ ] All CI checks pass
