---
name: agents-md-architect
description: "Use when the user asks to write, rewrite, shorten, audit or fix a CLAUDE.md, AGENTS.md, GEMINI.md or Cursor rules file, says 'set up my agent for this repo', 'the agent keeps ignoring my instructions', 'init this project' or 'my CLAUDE.md is huge', or starts a project that has no agent instructions. Builds the file from the real repo (commands, layout, conventions, gotchas), keeps it short, and cuts everything the agent can learn by reading the code. Reads profile.md for agents, project, stack and team size."
---

# AGENTS.md Architect

Write the instructions file an agent reads at the start of every session. Every line is paid for in tokens on every task, so every line has to earn its place.

An agent that reads a 400-line rules file follows the first 40 lines well and the rest at random. A 50-line file that is all true and all non-obvious gets followed. Write that one.

## Before you start

Read `profile.md` in this folder:

| profile.md line | Use |
|---|---|
| **Agents** | Which files to write (table below) |
| **Project** | One-line description at the top of the file |
| **Stack** | Cross-check against what the repo actually uses; the repo wins |
| **Team size** | Solo: about 40 lines, personal taste allowed. 2-10: about 60 lines, shared conventions. 10+: short root file plus nested files per package |

If a line says "not set", ask once, write the answer into profile.md, continue.

| Agent | Reads | Notes |
|---|---|---|
| Claude Code | CLAUDE.md (nested ones load when working in that folder) | Can import other files with an @path line. Check its docs for the current syntax. |
| Codex | `AGENTS.md` | Nested `AGENTS.md` files apply to their folder. |
| Cursor | `AGENTS.md` and the `.cursor/rules` folder | Rule files can be scoped to globs; put scoped detail there. |
| Gemini CLI | `GEMINI.md` | Can be pointed at another filename in its settings. Check its docs. |

With more than one agent: write `AGENTS.md` as the single source of truth, then make each other file a one-line pointer or import to it. Two diverging copies rot within a month. If unsure how an agent imports files, say so and use the plain pointer sentence "Read AGENTS.md first."

## Workflow

1. **Find what exists.** Look for current agent files, the README, CI config, the task runner and the package manifest. If an instructions file exists, record its line count and token estimate (chars / 4) as the "before".
2. **Read the repo like a new hire.** Directory tree two levels deep, the manifest scripts, test config, lint and format config, `git log --oneline -30` for commit style, one representative source file per layer. Say in one line what you read.
3. **Run the commands.** Install, build, typecheck, lint and test, narrowest scope first. Record the exact command that works, how long it takes, and what it needs (env vars, services, a seeded database). A command you did not run does not go in the file.
4. **Collect gotchas.** Ask the user once, in a single message: "What does the agent get wrong in this repo? What would you tell a new teammate on day one?" Also look for generated files that must not be edited, lockfile rules, required env var names, slow or flaky tests, and folders that look dead but are live.
5. **Filter every candidate line** with the test below. Delete what fails.
6. **Write the file** from `templates.md`, in this order: one-liner, commands, layout, conventions, gotchas, boundaries.
7. **Check the budget**, run the quality gate, show before and after.

## The line test

Keep a line only if all three are true:

| Question | Fails when |
|---|---|
| Would the agent get this wrong without the line? | Any competent reader of the code would do it right |
| Is it hard to find by reading the repo for a minute? | It is in the manifest, the config, or the file next to the one being edited |
| Is it true today and likely true in six months? | It names a version, a person, a sprint goal or a file that moves often |

## What does not go in

| Leave out | Why | Put it here instead |
|---|---|---|
| Style the linter or formatter enforces | The tool already enforces it | Linter config |
| 'Write clean, tested code' and other generic advice | The agent already tries; it costs tokens and changes nothing | Nowhere |
| A file-by-file tour | Goes stale; the agent can list a folder | Layout in 6-10 lines, only the non-obvious folders |
| Long architecture prose | Paid for on every task, needed on few | A docs/architecture.md file, named in one line with when it matters |
| Library versions | They drift; the manifest is the truth | Manifest |
| Secrets, tokens, real hostnames | The file is committed and sent to a model | Env var names only |
| Task-specific instructions ('today, migrate auth') | Wrong tomorrow | The prompt |
| Commands you have not run | A wrong command wastes a whole session | Delete |
| Capitals and 'NEVER' on everything | When everything shouts, nothing does; allow two at most | Plain sentences |

## Writing rules

- Imperative, specific, checkable: 'Run `pnpm test --filter api` before committing', not 'make sure tests pass'.
- Give the reason for any rule that looks arbitrary, in five words: 'Don't edit `src/gen/` (generated by `pnpm codegen`)'.
- State boundaries as three tiers: always do, ask first, never do. Keep the 'never' list short and real.
- Monorepo or team of 10+: the root file holds only what applies everywhere; each package gets its own short file with its own commands.
- When the agent goes wrong repeatedly, write the rule once, in the section it belongs to. Do not append a 'lessons' pile.

## Example: trimming

Before (6 of 38 lines):

```markdown
## Code Quality
- Always write clean, maintainable code
- Follow best practices for TypeScript
- Use 2-space indentation and single quotes
- Components are in src/components, hooks in src/hooks, utils in src/utils
- We use React 18.2.0 and Next.js 14.1
- IMPORTANT: always run tests
```

After (two lines carry the value):

```markdown
## Commands
- Verify: `pnpm typecheck && pnpm test --filter web` (about 40s; needs `docker compose up -d db`)
## Gotchas
- `src/gen/` is generated by `pnpm codegen`; edit the schema in `prisma/`, never the output.
- Prices are integer cents everywhere. A float in a money path is a bug.
```

Removed: formatter rules (Prettier does it), the folder tour (visible), versions (in `package.json`), and the generic lines. Added: the things the agent actually got wrong.

## Quality gate

1. Every command in the file was run in this session and works.
2. The file is inside the Team size budget; the token estimate is shown before and after.
3. No line fails the line test; none is generic advice.
4. No secrets, no versions, no dated or task-specific lines.
5. With several agents: one source of truth, the rest point to it.
6. Gotchas came from the repo or the user, not from guesswork.

## Output

Write the file(s) listed for the profile's Agents. Then reply with: files written, line count and token estimate before and after, the three most valuable lines you kept, and every line you deleted that the user may want back (list them, do not drop them silently). Suggest one follow-up at most, such as moving a long section into a `docs/` file.

Open `templates.md` for the solo, team and monorepo templates and the nested-file pattern.
