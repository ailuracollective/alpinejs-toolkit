# Pull Request

<!--
Default template for `chore`, `build`, `ci`, `style` and `revert` pull requests.
If your change is a feature, bug fix, performance, refactor, breaking change,
documentation or test change, pick the matching dedicated template instead.
-->

Short paragraph: what this change is and why it is needed. Keep it to two or three
sentences and avoid repeating the title.

## Linked issue (required)

<!-- The linked issue MUST carry the `status:approved` label. Apply exactly one of these
closing keywords on its own line. `Refs #N` does NOT close the issue and does not satisfy
this requirement. -->

Closes #

## Type (required)

<!-- Check exactly ONE. Labels are bare Conventional Commit types with no `type:` prefix:
feat, fix, docs, refactor, chore, style, perf, test, build, ci, revert, breaking-change -->

- [ ] `chore` — maintenance, dependencies, housekeeping
- [ ] `build` — build system, toolchain, packaging
- [ ] `ci` — pipelines, workflows, automation
- [ ] `style` — formatting only, no behavior change
- [ ] `revert` — undoes an earlier change

## Summary

<!-- 1 to 3 bullets. What the change does, not how many files it touches. -->

-

## Changes

| File           | Change       |
| -------------- | ------------ |
| `path/to/file` | What changed |

<!-- One row per meaningfully changed file. Group mechanical edits (formatting,
lockfile churn, generated output) into a single row rather than listing each one. -->

## Test plan

<!-- These are the checks CI runs for every pull request. All of them must pass. -->

- [ ] `vp check` — lint and formatting
- [ ] `vp test` — test suite
- [ ] `vp run --recursive build` — workspace builds
- [ ] `pnpm run size` — bundle size budget
- [ ] `pnpm run typecheck` — TypeScript types
- [ ] Manually verified the affected behavior

<!-- If the bundle size budget is relevant to this change, record the before/after numbers
from `pnpm run size` in the summary above. -->

## Notes

<!-- Anything a reviewer cannot infer from the diff: follow-ups, trade-offs, deferred work,
or the reason an alternative approach was rejected. Write "None" when there is nothing. -->

## Contributor checklist

- [ ] Linked an approved issue with `Closes #N`, `Fixes #N` or `Resolves #N`
- [ ] The linked issue carries the `status:approved` label
- [ ] Branch is named `<github-username>/<type>/<description>`, all lowercase
      (for example `janedoe/chore/update-ci-actions`)
- [ ] Added exactly one label from the allowed set, with no `type:` prefix
- [ ] Commit messages follow Conventional Commits
- [ ] No `Co-Authored-By` trailers
- [ ] Documentation updated if observable behavior changed
- [ ] All CI checks pass
