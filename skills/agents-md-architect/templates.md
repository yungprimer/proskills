# Templates

Contents: base template, solo, team, monorepo, nested package file, pointer files, questions for the user.

## Base template

```markdown
# <Project>
<One sentence: what it is and who uses it.>

## Commands
- Install: `<cmd>`
- Dev: `<cmd>` (port, what it needs)
- Verify before finishing: `<typecheck + lint + narrowest test>` (about N seconds)
- Single test: `<cmd with a path placeholder>`

## Layout
- `<dir>/`: <what lives there, only if not obvious>
- `<dir>/`: <...>

## Conventions
- <Only conventions no tool enforces: naming that matters, error handling pattern, where new code goes>

## Gotchas
- <Thing that looks wrong but is intentional, with the reason>
- <Generated or locked file, and the command that regenerates it>
- <Required env var names; never values>

## Boundaries
- Always: <e.g. add a test with each bug fix>
- Ask first: <e.g. new dependency, schema change, anything touching billing>
- Never: <e.g. edit migrations already applied, commit env files>
```

## Solo (about 40 lines)

Drop Boundaries unless something is dangerous. Personal taste is fine here ('prefer small commits, one concern each'), because one person owns the file. Keep Commands and Gotchas; they carry the value.

## Team of 2-10 (about 60 lines)

Add to the base template:
- A `PR and commits` section: branch naming, commit message shape, what CI blocks on.
- Which conventions come from the team, with the reason ('we use result types, not exceptions, in `domain/`').
- A one-line pointer to the contributing guide instead of repeating it.

## Monorepo or team of 10+

Root file (under 50 lines): workspace commands, how packages relate in two sentences, rules that apply everywhere, and a table of packages with one line each and the command to test one package.

```markdown
## Packages
| Path | What | Test one |
|---|---|---|
| apps/web | Next.js storefront | `pnpm --filter web test` |
| services/billing | Stripe webhooks, invoices | `pnpm --filter billing test` |
| packages/ui | Shared components | `pnpm --filter ui test` |
Each package has its own short instructions file with its own gotchas.
```

## Nested package file (about 25 lines)

Only what is true inside that package: its commands, its gotchas, its boundaries. Never repeat root rules. Example for `services/billing`:

```markdown
# Billing service
Handles Stripe webhooks and invoice generation.

## Commands
- Test: `pnpm --filter billing test` (needs STRIPE_WEBHOOK_SECRET set to any string)
- Replay a webhook locally: `pnpm --filter billing replay <event-id>`

## Gotchas
- Webhooks arrive twice and out of order. Handlers must be idempotent on event.id.
- Amounts are integer cents. Currency is stored with every amount.

## Boundaries
- Ask first: any change to invoice table columns.
- Never: call Stripe live mode from tests.
```

## Pointer files for other agents

If `AGENTS.md` is the source of truth, a second agent's file can be a single line:

```markdown
Read AGENTS.md at the repository root and follow it. Nothing here overrides it.
```

Use an import instead where that agent documents one. Check its docs for the exact syntax rather than guessing.

## Questions for the user

Ask these in one message when step 4 needs input:
- What does the agent get wrong most often here?
- Which folder or file should it never touch?
- What takes longest to run, and what must be running first?
- What did you explain to the last person who joined?
