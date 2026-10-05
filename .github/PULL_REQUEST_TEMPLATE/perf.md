# Performance

<!--
Use for a deliberate performance improvement. A perf PR without measurements cannot be
reviewed: "it feels faster" is not evidence. If you cannot produce the numbers below,
open a discussion issue instead and do not open this PR.
-->

Short paragraph: which workload this change makes faster or lighter, and why that workload
matters.

## Linked issue (required)

<!-- The linked issue MUST carry the `status/ready` label. Apply exactly one of these
closing keywords on its own line. `Refs #N` does NOT close the issue and does not satisfy
this requirement. -->

Closes #

## Type (required)

<!-- Check exactly ONE. This is the Conventional Commit type for your TITLE; the LABEL
is separate and coarser: `type/improvement`. Apply exactly one `type/*` label. -->

- [ ] `perf` — measurable performance improvement

## Measurements (required)

<!-- A performance PR without numbers cannot be reviewed. Every cell must be a measured
value, not an estimate. If a metric did not move, say so explicitly. -->

| Metric                         | Before | After | Delta | Noise margin |
| ------------------------------ | ------ | ----- | ----- | ------------ |
| `pnpm run size` bundle size    |        |       |       |              |
| Runtime of the benchmark below |        |       |       |              |

## Measurement command

<!-- The exact, copy-pasteable command that produces the numbers above. Include the sample
count or iteration count if the benchmark needs them. -->

```bash
# exact benchmark or measurement command
```

## Environment

<!-- Reviewers cannot compare numbers across machines. Record everything below. -->

- Machine / CPU:
- Memory:
- OS:
- Node version (see `.node-version`):
- pnpm version (see CI: `12.3.4`):
- Branch and commit measured for "before":
- Branch and commit measured for "after":

## Regression threshold

<!-- State the threshold that would have made this a regression, and confirm you are
above it. Example: "regression is defined as bundle size above 60 kB gzipped; this lands
at 41 kB, so it is not a regression." If you cannot name a threshold, the measurement
cannot prove the improvement. -->

- Regression threshold:
- This change's value against that threshold:

## Summary of the change

<!-- 1 to 3 bullets on the mechanism: what was made cheaper and why. -->

-

## Test plan

<!-- These are the checks CI runs for every pull request. All of them must pass. -->

- [ ] `vp check` — lint and formatting
- [ ] `vp test` — test suite
- [ ] `vp run --recursive build` — workspace builds
- [ ] `pnpm run size` — bundle size budget
- [ ] `pnpm run typecheck` — TypeScript types
- [ ] Behavior verified unchanged — the optimization does not alter output

## Contributor checklist

- [ ] Linked an approved issue with `Closes #N`, `Fixes #N` or `Resolves #N`
- [ ] The linked issue carries the `status/ready` label
- [ ] Branch is named `<github-username>/<type>/<description>`, all lowercase
      (for example `janedoe/perf/reduce-startup-time`)
- [ ] Applied exactly one `type/*` label (`type/feature`, `type/bug`, `type/documentation`,
      `type/improvement` or `type/task`)
- [ ] Commit messages follow Conventional Commits
- [ ] No `Co-Authored-By` trailers
- [ ] Before/after numbers measured and recorded, with the environment
- [ ] Documentation updated if observable behavior changed
- [ ] All CI checks pass
