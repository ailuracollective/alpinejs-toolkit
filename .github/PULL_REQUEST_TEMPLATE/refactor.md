# Refactor

<!--
Use for an internal restructuring that does not change observable behavior. If behavior
or a public API changes at all, this is a `feat`, `fix`, or `breaking-change` — not a
refactor.
-->

Short paragraph: what was restructured and why the current shape was a problem.

## Linked issue (required)

<!-- The linked issue MUST carry the `status/ready` label. Apply exactly one of these
closing keywords on its own line. `Refs #N` does NOT close the issue and does not satisfy
this requirement. -->

Closes #

## Type (required)

<!-- Check exactly ONE. This is the Conventional Commit type for your TITLE; the LABEL
is separate and coarser: `type/improvement`. Apply exactly one `type/*` label. -->

- [ ] `refactor` — internal restructuring, behavior unchanged

## Structure: before and after

<!-- Show the shape, not the whole file. Focus on the moved or extracted units. -->

**Before**

```
<module or function layout>
```

**After**

```
<module or function layout>
```

| Unit                  | Before         | After              |
| --------------------- | -------------- | ------------------ |
| `path/to/file` — unit | where it lived | where it lives now |

## Behavioral equivalence

<!-- How you proved the behavior is identical. Name the tests that already covered the old
shape and still pass, plus any new characterization tests you added. "It looks the same" is
not a proof. -->

| Evidence                                 | Detail |
| ---------------------------------------- | ------ |
| Existing tests covering the old behavior |        |
| Characterization tests added             |        |
| Manual comparison performed              |        |

## Public API and observable behavior

<!-- Explicit confirmation is required. If anything changed for a consumer, this PR is
mislabeled: say so and move it to feat! / fix! (breaking-change). -->

- Public API unchanged: yes / no
- Observable behavior unchanged: yes / no
- If either answer is "no": <!-- this should have been a `feat!` or `fix!` PR instead.
  Explain what changed and which breaking-change template applies. -->

## Test plan

<!-- These are the checks CI runs for every pull request. All of them must pass. -->

- [ ] `vp check` — lint and formatting
- [ ] `vp test` — test suite
- [ ] `vp run --recursive build` — workspace builds
- [ ] `pnpm run size` — bundle size budget
- [ ] `pnpm run typecheck` — TypeScript types
- [ ] Equivalence verified beyond the test suite

## Contributor checklist

- [ ] Linked an approved issue with `Closes #N`, `Fixes #N` or `Resolves #N`
- [ ] The linked issue carries the `status/ready` label
- [ ] Branch is named `<github-username>/<type>/<description>`, all lowercase
      (for example `janedoe/refactor/extract-shared-logic`)
- [ ] Applied exactly one `type/*` label (`type/feature`, `type/bug`, `type/documentation`,
      `type/improvement` or `type/task`)
- [ ] Commit messages follow Conventional Commits
- [ ] No `Co-Authored-By` trailers
- [ ] Confirmed no public API or observable behavior changed
- [ ] All CI checks pass
