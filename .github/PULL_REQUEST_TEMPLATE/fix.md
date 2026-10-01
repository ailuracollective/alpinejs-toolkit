# Bug fix

<!--
Use for a correction of existing behavior. If the defect only appears on unreleased code,
prefer `revert` or `chore`.
-->

Short paragraph: the defect this PR corrects, in one or two sentences.

## Linked issue (required)

<!-- The linked issue MUST carry the `status:approved` label. Apply exactly one of these
closing keywords on its own line. `Refs #N` does NOT close the issue and does not satisfy
this requirement. -->

Closes #

## Type (required)

<!-- Check exactly ONE. Labels are bare Conventional Commit types with no `type:` prefix:
feat, fix, docs, refactor, chore, style, perf, test, build, ci, revert, breaking-change -->

- [ ] `fix` — correction of existing behavior

## Symptom

<!-- What the user observes. Observable behavior only: the wrong output, the error, the
failure. Do not put the root cause here. -->

## Root cause

<!-- Why the code actually produced the symptom. A fix that only patches the symptom is
not reviewable — name the underlying defect, including the conditions that trigger it. -->

## Minimal reproduction

<!-- The smallest input or sequence that reproduces the defect on the base revision. -->

1.
2.
3.

```ts
// Minimal reproduction, if code makes it clearer
```

## Expected vs actual

|                   | Behavior                                               |
| ----------------- | ------------------------------------------------------ |
| **Expected**      |                                                        |
| **Actual**        |                                                        |
| **Base revision** | <!-- commit or version where the defect is present --> |

## Regression test

- [ ] Added a regression test
- [ ] Not added — <!-- explain why no test can cover this defect -->

<!-- If added, name the test file(s) and the test case. A fix without a regression test
needs a reason; an unfixable environment defect is a valid one. -->

| Test file      | Test case       |
| -------------- | --------------- |
| `path/to/file` | What it asserts |

## Test plan

<!-- These are the checks CI runs for every pull request. All of them must pass. -->

- [ ] `vp check` — lint and formatting
- [ ] `vp test` — test suite
- [ ] `vp run --recursive build` — workspace builds
- [ ] `pnpm run size` — bundle size budget
- [ ] `pnpm run typecheck` — TypeScript types
- [ ] Confirmed the reproduction steps no longer reproduce the defect

## Contributor checklist

- [ ] Linked an approved issue with `Closes #N`, `Fixes #N` or `Resolves #N`
- [ ] The linked issue carries the `status:approved` label
- [ ] Branch is named `<github-username>/<type>/<description>`, all lowercase
      (for example `janedoe/fix/counter-store`)
- [ ] Added exactly one label from the allowed set, with no `type:` prefix
- [ ] Commit messages follow Conventional Commits
- [ ] No `Co-Authored-By` trailers
- [ ] Documentation updated if observable behavior changed
- [ ] All CI checks pass
