---
name: pr-describer
description: "Use when the user says 'write the PR description', 'describe this PR', 'PR title', 'summarise my changes', 'what should the commit message be', or is about to open a pull request. Reads the diff and the commits, then writes a short, honest title and description: what changed, why, how to test it, risk, and a screenshots placeholder for UI changes. No filler. Reads profile.md for project, stack, strictness and conventions."
---

# PR Describer

A pull request description exists so a reviewer can decide in two minutes where to look hardest. It is not a diary and not a sales pitch.

## Before you start

Read `profile.md` in this folder:

| profile.md line | Use |
|---|---|
| **Project** | Name the service or area in the summary when it helps a reader outside the team. |
| **Stack** | Pick the right test commands and the right words (migration, route, component, handler). |
| **Strictness** | Gentle: describe and flag only the obvious risk. Standard: the full template. Strict: also list what you did not test and every behaviour change. |
| **Conventions** | Title format (for example conventional commits), commit and branch rules. Follow them exactly. |

If a line says "not set", ask once, write the answer into profile.md, continue.

## Workflow

1. **Get the change.** Run `git diff <base>...HEAD --stat`, then the full diff, then `git log <base>..HEAD --oneline`. If the user pasted a diff, use that. Never describe a change you have not read.
2. **Find the why.** Look in commit messages, the branch name, linked issue numbers and code comments. If the reason is not in any of them, ask one question: "Why is this needed now?" Do not invent a motivation.
3. **Classify the change.** One primary type: feature, fix, refactor, perf, docs, test, chore, migration. If the diff mixes a refactor with a behaviour change, say so in the description and suggest splitting.
4. **Write the title** using the Conventions line. Without one: imperative mood, under 72 characters, no trailing period, says what the change does ("Retry webhook delivery with backoff"), not what you did ("Updated webhook code").
5. **Write the description** with the template below. Every section is required, but a section may be one line.
6. **Run the honesty check** at the end before you hand it over.

## Template

```markdown
## What
<1-3 sentences: the behaviour that is different after this merges.>

## Why
<The problem or ticket. Link the issue. One short paragraph at most.>

## How
<Only the non-obvious design choices, as bullets. Skip anything the diff makes clear.>

## How to test
1. <exact command or click path>
2. <expected result>

## Risk
<Low / Medium / High, then the reason. Name what could break and how to roll back.>

## Screenshots
<UI changes only. Leave a placeholder row: Before | After. Delete this section otherwise.>
```

## Risk levels

| Level | Use when |
|---|---|
| Low | Docs, tests, copy, isolated internal change with tests, no data or API touched. |
| Medium | Behaviour change behind existing tests, new dependency, change to a shared helper, new query on a hot path. |
| High | Schema or data migration, auth or permissions, money, public API shape, concurrency, anything hard to roll back. |

For Medium and High, add one line on rollback: revert, feature flag off, or "forward fix only" (and say why).

## Worked example

Diff: adds retries to a webhook sender, adds a `delivery_attempts` column, touches `src/webhooks/send.ts` and a migration.

```markdown
Title: Retry failed webhook deliveries with exponential backoff

## What
Webhook deliveries that fail with a 5xx or a timeout are now retried up to 5 times over about 30 minutes. 4xx responses are not retried.

## Why
Customers lost events during our partners' short outages (BILL-212). Today a single failure drops the event.

## How
- Backoff is 30s, 2m, 8m, 20m with 20% jitter, to avoid retry storms after an outage.
- Attempts are counted in a new `delivery_attempts` column, so a restart does not reset the count.
- A delivery is marked failed only after the last attempt.

## How to test
1. `npm test -- webhooks`
2. Point a webhook at a local server that returns 503 twice, then 200. Expect 3 attempts and one `delivered` row.

## Risk
Medium. Adds a nullable column (safe to deploy before code, backfill not needed). A partner that is hard down now receives 5 requests per event instead of 1. Roll back by reverting; the column can stay.
```

## Honesty check

- Every claim in What and How is visible in the diff.
- "How to test" has a command or a click path someone can copy, with the expected result.
- Nothing says "various improvements", "minor tweaks", "cleanup" or "as discussed".
- Anything you did not run or verify is stated as not verified. Do not write "tested locally" unless you ran the tests this session.
- Unrelated changes in the diff are listed under What, with a suggestion to move them out.
- Risk is not "Low" just because the diff is small. A one-line change to an auth check is High.

## Output

Return the title on its own line, then the description in a markdown block ready to paste. If the diff was too large to read fully, say which files you skipped. Offer the gh or git command to open the PR, but do not run it unless asked.
