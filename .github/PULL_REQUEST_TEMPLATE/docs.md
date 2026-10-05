# Documentation

<!--
Use for documentation-only changes. If runtime code changes in any way — including a
comment, a snippet in a type, or a config default — this is not a docs PR.
-->

Short paragraph: which documentation gap or inaccuracy this closes.

## Linked issue (required)

<!-- The linked issue MUST carry the `status/ready` label. Apply exactly one of these
closing keywords on its own line. `Refs #N` does NOT close the issue and does not satisfy
this requirement. -->

Closes #

## Type (required)

<!-- Check exactly ONE. This is the Conventional Commit type for your TITLE; the LABEL
is separate and coarser: `type/documentation`. Apply exactly one `type/*` label. -->

- [ ] `docs` — documentation only, no runtime code changed

## Documentation changed

| File                   | Change                                |
| ---------------------- | ------------------------------------- |
| `path/to/docs/file.md` | What was added, corrected, or removed |

<!-- Include the reason when a section is removed or a recommendation is reversed, so the
reviewer does not have to infer it from the diff. -->

## Preview links

<!-- Required for visual documentation: screenshots, rendered previews, or a link to the
published page. Write "Not visual" when there is no rendered output to show. -->

## Read-through check

<!-- A documentation review, not a test run. Confirm the whole changed file reads
correctly in context, not only the edited lines. -->

- [ ] Read the full changed file top to bottom after the edit
- [ ] New instructions were followed literally on a clean checkout
- [ ] Terminology, headings, and code fences match the surrounding docs
- [ ] Examples are copy-pasteable and match current API signatures
- [ ] Nothing in the diff contradicts `README.md` or `CONTRIBUTING.md`

## Link and anchor verification

<!-- Record the exact checks you performed. Write "No links or anchors changed" when the
diff introduces none. -->

- [ ] Checked every added internal link resolves
- [ ] Checked every added anchor (`#heading`) matches a real heading
- [ ] Checked external links return a success status
- [ ] No links or anchors changed

## Runtime code untouched

<!-- Explicit confirmation. This is the defining property of a docs PR. -->

- [ ] Confirmed no runtime code changed: the diff touches only `.md` files and
      documentation assets.
- Files in the diff outside documentation: <!-- list them, or "none" -->

## Contributor checklist

- [ ] Linked an approved issue with `Closes #N`, `Fixes #N` or `Resolves #N`
- [ ] The linked issue carries the `status/ready` label
- [ ] Branch is named `<github-username>/<type>/<description>`, all lowercase
      (for example `janedoe/docs/installation-guide`)
- [ ] Applied exactly one `type/*` label (`type/feature`, `type/bug`, `type/documentation`,
      `type/improvement` or `type/task`)
- [ ] Commit messages follow Conventional Commits
- [ ] No `Co-Authored-By` trailers
- [ ] All CI checks pass
