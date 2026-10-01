# Tests

<!--
Use for test-only changes: new coverage, test infrastructure, fixtures, or mocks. If the
code under test also changes, say so explicitly below and choose the label that matches
the dominant intent.
-->

Short paragraph: which behavior is now covered that was not before.

## Linked issue (required)

<!-- The linked issue MUST carry the `status:approved` label. Apply exactly one of these
closing keywords on its own line. `Refs #N` does NOT close the issue and does not satisfy
this requirement. -->

Closes #

## Type (required)

<!-- Check exactly ONE. Labels are bare Conventional Commit types with no `type:` prefix:
feat, fix, docs, refactor, chore, style, perf, test, build, ci, revert, breaking-change -->

- [ ] `test` — tests only, or tests plus non-behavioral test scaffolding

## Scope of this change

<!-- State plainly whether the code under test was modified. A test PR that silently
changes source is not reviewable. -->

- [ ] Test files only — the code under test is unchanged
- [ ] Test files plus the code under test — the behavior is expected to stay identical;
      explain below why the source change was unavoidable

| Source file changed | Why the test change required it |
| ------------------- | ------------------------------- |
| `path/to/file`      |                                 |

## Now covered

| Behavior covered | Test file      | Test case | Type                     |
| ---------------- | -------------- | --------- | ------------------------ |
|                  | `path/to/file` |           | unit / integration / e2e |

<!-- One row per behavior, not per assertion. Explain the gap this closes. -->

## Deliberately uncovered

<!-- What you chose not to test, and why. "Nothing" is a valid answer only when you
actually considered the edges. Acceptable reasons: nondeterminism, third-party boundary
that is mocked away, behavior already covered by a higher-level test, cost out of
proportion to risk. Unacceptable: no reason given. -->

| Uncovered behavior | Why it is left untested |
| ------------------ | ----------------------- |
|                    |                         |

## Fixtures and mocks

- [ ] No new fixtures or mocks
- [ ] New fixtures added — <!-- where they live, and whether they are shared or scoped -->
- [ ] New mocks added — <!-- what is mocked, and how the mock is kept honest -->

<!-- If a mock is the only thing keeping a test green, say how the real implementation is
still exercised somewhere. -->

## Test plan

<!-- These are the checks CI runs for every pull request. All of them must pass. -->

- [ ] `vp check` — lint and formatting
- [ ] `vp test` — test suite
- [ ] `vp run --recursive build` — workspace builds
- [ ] `pnpm run size` — bundle size budget
- [ ] `pnpm run typecheck` — TypeScript types
- [ ] Confirmed the new tests fail without the change they protect

## Contributor checklist

- [ ] Linked an approved issue with `Closes #N`, `Fixes #N` or `Resolves #N`
- [ ] The linked issue carries the `status:approved` label
- [ ] Branch is named `<github-username>/<type>/<description>`, all lowercase
      (for example `janedoe/test/add-setup-coverage`)
- [ ] Added exactly one label from the allowed set, with no `type:` prefix
- [ ] Commit messages follow Conventional Commits
- [ ] No `Co-Authored-By` trailers
- [ ] Stated what is deliberately left uncovered and why
- [ ] All CI checks pass
