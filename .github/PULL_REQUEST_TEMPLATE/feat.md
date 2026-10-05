# Feature

<!--
Use for new user-facing capability. A change that alters or removes existing behavior
is NOT a feature — use the breaking-change template.
-->

Short paragraph: the user-facing problem this feature solves and the outcome it delivers.

## Linked issue (required)

<!-- The linked issue MUST carry the `status/ready` label. Apply exactly one of these
closing keywords on its own line. `Refs #N` does NOT close the issue and does not satisfy
this requirement. -->

Closes #

## Type (required)

<!-- Check exactly ONE. This is the Conventional Commit type for your TITLE; the LABEL
is separate and coarser: `type/feature`. Apply exactly one `type/*` label. -->

- [ ] `feat` — new user-facing capability

## User-facing outcome

<!-- Describe what a user can now do that they could not do before. State it as a capability,
not as an implementation. -->

-

## What is new

<!-- The new surface: new exports, components, directives, CLI flags, configuration keys,
or endpoints. Link to the files that define them. -->

| Surface        | Location                         | Purpose        |
| -------------- | -------------------------------- | -------------- |
| `path/to/file` | exported symbol, component, flag | What it is for |

## How to try it

<!-- Give the reviewer a runnable path. Prefer a snippet they can paste and run. If no
snippet is possible, spell out the exact manual steps, including the command to run and
what they should observe. -->

```ts
// Runnable snippet, or the concrete manual path below
```

## Compatibility impact

<!-- State explicitly whether existing code keeps working unchanged. Name any new opt-in
flag, default, or deprecation. If existing behavior changes, this belongs in
breaking-change instead. -->

- Backward compatible: yes / no
- New opt-in behavior: <!-- describe the flag or config key, or "none" -->
- Deprecations introduced: <!-- describe, or "none" -->

## Screenshots or demo

<!-- Required when the change is visual (components, styling, rendered output). Paste before
and after screenshots, or link to a recording. Write "Not visual" when it is not. -->

## Test plan

<!-- These are the checks CI runs for every pull request. All of them must pass. -->

- [ ] `vp check` — lint and formatting
- [ ] `vp test` — test suite
- [ ] `vp run --recursive build` — workspace builds
- [ ] `pnpm run size` — bundle size budget
- [ ] `pnpm run typecheck` — TypeScript types
- [ ] Manually exercised the new capability end to end

## Contributor checklist

- [ ] Linked an approved issue with `Closes #N`, `Fixes #N` or `Resolves #N`
- [ ] The linked issue carries the `status/ready` label
- [ ] Branch is named `<github-username>/<type>/<description>`, all lowercase
      (for example `janedoe/feat/parser-fallback`)
- [ ] Applied exactly one `type/*` label (`type/feature`, `type/bug`, `type/documentation`,
      `type/improvement` or `type/task`)
- [ ] Commit messages follow Conventional Commits
- [ ] No `Co-Authored-By` trailers
- [ ] Documentation updated for the new capability
- [ ] All CI checks pass
