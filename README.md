# ProSkills free skills

Free agent skills from [ProSkills](https://proskills.dev), in the open Agent Skills format. They work in Claude Code, Cursor, Codex and Gemini CLI. Each skill reads `profile.md` beside it for your brand and preferences and asks once for anything missing.

| Skill | What it does | Collection | Scan |
|---|---|---|---|
| [Character Bible](skills/character-bible/SKILL.md) | Lock a face, body and style across renders. | AI Models | 100 |
| [Wardrobe & Sets](skills/wardrobe-sets/SKILL.md) | Outfit and scene ideas matched to your style. | AI Models | 100 |
| [Taste Core](skills/taste-core/SKILL.md) | Spacing, type scale, one accent. | Frontend Taste | 100 |
| [Hyperframes Starter](skills/hyperframes-starter/SKILL.md) | Your first composition in one prompt. | Motion & Video | 100 |
| [Humanizer](skills/humanizer/SKILL.md) | Strips the most common AI tells. | Humanizer | 100 |
| [Hook Lab](skills/hook-lab/SKILL.md) | Five hooks per post, each a different pattern. | Viral Hooks | 100 |
| [Grill Me](skills/grill-me/SKILL.md) | A relentless review of your plan. | Grill Me | 100 |
| [PR Describer](skills/pr-describer/SKILL.md) | Title and description from your diff. No filler. | Code Review | 100 |
| [AGENTS.md Architect](skills/agents-md-architect/SKILL.md) | A short instructions file from your real repo. | Agent Ops | 100 |
| [Prospect Brief](skills/prospect-brief/SKILL.md) | One-page research on any lead. | Outreach | 100 |
| [CRUD Scaffold](skills/crud-scaffold/SKILL.md) | Tables, forms, auth. Done. | Mini-apps | 100 |

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

The scanner behind these scores is in [`cli/`](cli/). Run it on your own skills, or in CI to stop a bad skill from merging:

```bash
npx proskills-cli scan .claude/skills .agents/skills --min 80
```

It checks spec compliance, token cost, clarity and security (prompt injection, hidden text, remote code, credential theft). A static scan can be evaded, so it is a first check, not a guarantee.

## License

MIT. Independent; not affiliated with Anthropic.
