# ProSkills free skills

Free agent skills from [ProSkills](https://proskills.dev), in the open Agent Skills format. They work in Claude Code, Cursor, Codex and Gemini CLI. Each skill reads `profile.md` beside it for your brand and preferences and asks once for anything missing.

| Skill | What it does | Collection | Scan |
|---|---|---|---|
| [Character Bible](skills/character-bible/SKILL.md) | Lock a face, body and style across renders. | AI Models | [![Scanned by ProSkills: 100](https://proskills.dev/badge/character-bible.svg)](https://proskills.dev/skills/character-bible) |
| [Wardrobe & Sets](skills/wardrobe-sets/SKILL.md) | Outfit and scene ideas matched to your style. | AI Models | [![Scanned by ProSkills: 100](https://proskills.dev/badge/wardrobe-sets.svg)](https://proskills.dev/skills/wardrobe-sets) |
| [Taste Core](skills/taste-core/SKILL.md) | Spacing, type scale, one accent. | Frontend Taste | [![Scanned by ProSkills: 100](https://proskills.dev/badge/taste-core.svg)](https://proskills.dev/skills/taste-core) |
| [Hyperframes Starter](skills/hyperframes-starter/SKILL.md) | Your first composition in one prompt. | Motion & Video | [![Scanned by ProSkills: 100](https://proskills.dev/badge/hyperframes-starter.svg)](https://proskills.dev/skills/hyperframes-starter) |
| [Humanizer](skills/humanizer/SKILL.md) | Strips the most common AI tells. | Humanizer | [![Scanned by ProSkills: 100](https://proskills.dev/badge/humanizer.svg)](https://proskills.dev/skills/humanizer) |
| [Hook Lab](skills/hook-lab/SKILL.md) | Five hooks per post, each a different pattern. | Viral Hooks | [![Scanned by ProSkills: 100](https://proskills.dev/badge/hook-lab.svg)](https://proskills.dev/skills/hook-lab) |
| [Grill Me](skills/grill-me/SKILL.md) | A relentless review of your plan. | Grill Me | [![Scanned by ProSkills: 100](https://proskills.dev/badge/grill-me.svg)](https://proskills.dev/skills/grill-me) |
| [PR Describer](skills/pr-describer/SKILL.md) | Title and description from your diff. No filler. | Code Review | [![Scanned by ProSkills: 100](https://proskills.dev/badge/pr-describer.svg)](https://proskills.dev/skills/pr-describer) |
| [AGENTS.md Architect](skills/agents-md-architect/SKILL.md) | A short instructions file from your real repo. | Agent Ops | [![Scanned by ProSkills: 100](https://proskills.dev/badge/agents-md-architect.svg)](https://proskills.dev/skills/agents-md-architect) |
| [Analytics SQL](skills/analytics-sql/SKILL.md) | Readable analytics queries you can trust. | Data & SQL | [![Scanned by ProSkills: 100](https://proskills.dev/badge/analytics-sql.svg)](https://proskills.dev/skills/analytics-sql) |
| [Dockerfile Doctor](skills/dockerfile-doctor/SKILL.md) | Smaller, faster, safer images. | DevOps & Cloud | [![Scanned by ProSkills: 100](https://proskills.dev/badge/dockerfile-doctor.svg)](https://proskills.dev/skills/dockerfile-doctor) |
| [Prospect Brief](skills/prospect-brief/SKILL.md) | One-page research on any lead. | Outreach | [![Scanned by ProSkills: 100](https://proskills.dev/badge/prospect-brief.svg)](https://proskills.dev/skills/prospect-brief) |
| [CRUD Scaffold](skills/crud-scaffold/SKILL.md) | Tables, forms, auth. Done. | Mini-apps | [![Scanned by ProSkills: 100](https://proskills.dev/badge/crud-scaffold.svg)](https://proskills.dev/skills/crud-scaffold) |

Scores come from the [Skill Scanner](https://proskills.dev/scan) (spec, token cost, clarity, security).

## Install

With the ProSkills CLI (any agent, one skill at a time):

```bash
npx proskills-cli add humanizer
npx proskills-cli add pr-describer --agent all
```

Or with [skills.sh](https://skills.sh):

```bash
npx skills add yungprimer/proskills
```

Or copy a folder from `skills/` into your agent's skills directory:

| Agent | This project | Every project |
|---|---|---|
| Claude Code | `.claude/skills/` | `~/.claude/skills/` |
| Cursor | `.agents/skills/ (or .cursor/skills/)` | `~/.cursor/skills/` |
| Codex | `.agents/skills/` | `~/.agents/skills/` |
| Gemini CLI | `.agents/skills/ (or .gemini/skills/)` | `~/.gemini/skills/` |

Want it set up for your brand before you install? Personalise any skill at [proskills.dev](https://proskills.dev) and download it ready to use. The full-depth versions live there too.

## Scan any skill

The scanner behind these scores is in [`cli/`](cli/). Run it on your own skills, or in CI to stop a bad skill from merging. As a GitHub Action (the scores also show in the job summary):

```yaml
name: skills
on: [pull_request]
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: yungprimer/proskills@v1
        with:
          paths: .claude/skills .agents/skills
          min: 80
```

Or the raw command, anywhere Node 18+ runs:

```bash
npx proskills-cli scan .claude/skills .agents/skills --min 80
```

It checks spec compliance, token cost, clarity and security (prompt injection, hidden text, remote code, credential theft). A static scan can be evaded, so it is a first check, not a guarantee.

### Badge

Show that your skills are scanned. `scan --badge` prints this with your lowest score:

```md
[![Scanned by ProSkills](https://proskills.dev/badge?score=92)](https://proskills.dev/scan)
```

[![Scanned by ProSkills](https://proskills.dev/badge?score=92)](https://proskills.dev/scan)

## License

MIT. Independent; not affiliated with Anthropic.
