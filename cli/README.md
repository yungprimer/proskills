# proskills-cli

Install [ProSkills](https://proskills.dev) agent skills in one command, and scan any `SKILL.md` folder in CI.

Node 18 or newer. One dependency (`jszip`).

## Use it

No install needed:

```sh
npx proskills-cli list                      # every skill, price and scan score
npx proskills-cli add humanizer             # install a free skill into this project
npx proskills-cli add grill-me hook-lab     # several at once
npx proskills-cli scan                      # score the skills already in this repo
```

Or install it: `npm i -g proskills`.

### `proskills list [--collection <slug>]`

Prints a table of skills with price (or `Free`) and scan score.

### `proskills add <skill-id...>`

| Flag | Meaning |
|---|---|
| `--agent claude\|cursor\|codex\|gemini\|all` | Which agent to install for. Default: `.claude/` found, then Claude Code; else `.agents/` found, then `.agents/skills`; else Claude Code. |
| `--global` | Install for every project (your home folder) instead of this one. |
| `--order <id>` | Order id from your receipt (`cs_live_...`). Also read from env `PROSKILLS_ORDER`. Required for paid skills. |
| `--dir <path>` | Use this folder instead of the current one (instead of your home folder with `--global`). |
| `--force` | Replace a skill folder that already exists. Without it, nothing is overwritten. |
| `--answers file.json` | Send your saved answers so `profile.md` is filled in. Optional. |

Paid skill without an order id: the command stops and prints the link to buy it (`https://proskills.dev/library/<collection>`).

### `proskills scan [paths...] [--min 80] [--json]`

Scores skill folders against the Agent Skills spec, token budget, clarity and security. A path is a skill folder (has `SKILL.md`) or a folder of skill folders. Default: `.claude/skills` and `.agents/skills`. Exits `1` when any skill is grade F (any critical finding) or scores under `--min`, `2` on usage errors. Scanning runs locally; nothing is uploaded.

### Everywhere

`--base <url>` (or env `PROSKILLS_URL`) points at another host. Default `https://proskills.dev`. `--help`, `--version`.

## CI

Block a pull request that adds a weak or unsafe skill:

```yaml
name: skills
on: [pull_request]
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npx proskills-cli scan --min 80
```

Add paths to scan something else: `npx proskills-cli scan ./skills --min 90 --json`.

## What it writes, and where

Each skill becomes one folder, with `SKILL.md`, `profile.md` and any files the skill reads:

| Agent | This project | With `--global` |
|---|---|---|
| Claude Code | `.claude/skills/<id>/` | `~/.claude/skills/<id>/` |
| Cursor | `.agents/skills/<id>/` | `~/.cursor/skills/<id>/` |
| Codex | `.agents/skills/<id>/` | `~/.agents/skills/<id>/` |
| Gemini CLI | `.agents/skills/<id>/` | `~/.gemini/skills/<id>/` |

It writes only inside that skills folder. Archive entries with `..`, absolute paths or drive letters are rejected before anything is written. Restart your agent afterwards.

## Privacy

`list` and `add` send only the skill ids you ask for, plus the order id if you give one. Your saved answers are not sent unless you pass `--answers file.json`. No telemetry, no accounts, no other network calls. `scan` makes none at all.

## License

MIT
