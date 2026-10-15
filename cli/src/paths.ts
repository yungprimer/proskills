import { existsSync } from "node:fs";
import { join, resolve, sep } from "node:path";

export type Agent = "claude" | "cursor" | "codex" | "gemini";
export const AGENTS: Agent[] = ["claude", "cursor", "codex", "gemini"];

/** Project-level skills directory per agent (relative to the project root). */
const PROJECT_DIR: Record<Agent, string> = {
  claude: ".claude/skills",
  cursor: ".agents/skills",
  codex: ".agents/skills",
  gemini: ".agents/skills",
};

/** User-level skills directory per agent (relative to the home directory). */
const USER_DIR: Record<Agent, string> = {
  claude: ".claude/skills",
  cursor: ".cursor/skills",
  codex: ".agents/skills",
  gemini: ".gemini/skills",
};

export type Target = { label: string; dir: string };

export function isAgent(v: string): v is Agent {
  return (AGENTS as string[]).includes(v);
}

/**
 * Which agents to install for. With no --agent: `.claude/` present → claude,
 * else `.agents/` present → the shared .agents folder (Cursor, Codex, Gemini),
 * else claude. `all` installs for every agent (deduplicated by folder).
 */
export function pickAgents(agent: string | undefined, base: string, global: boolean): Agent[] {
  if (agent === "all") return AGENTS;
  if (agent) {
    if (!isAgent(agent)) throw new Error(`Unknown agent "${agent}". Use claude, cursor, codex, gemini or all.`);
    return [agent];
  }
  if (global) return ["claude"];
  if (existsSync(join(base, ".claude"))) return ["claude"];
  if (existsSync(join(base, ".agents"))) return ["codex"];
  return ["claude"];
}

/** Skills directories for the chosen agents. `base` is the project root, or the home directory with --global. */
export function resolveTargets(agents: Agent[], base: string, global: boolean): Target[] {
  const seen = new Map<string, Target>();
  for (const a of agents) {
    const dir = resolve(base, (global ? USER_DIR : PROJECT_DIR)[a]);
    const prev = seen.get(dir);
    if (prev) {
      prev.label += `, ${a}`;
    } else {
      seen.set(dir, { label: a, dir });
    }
  }
  return [...seen.values()];
}

/**
 * Normalises a zip entry name to a relative POSIX path, or throws when it
 * could escape the destination (absolute path, drive letter, `..`, NUL).
 */
export function safeRelPath(name: string): string {
  if (name.includes("\0")) throw new Error(`Unsafe path in archive: ${JSON.stringify(name)}`);
  const n = name.replace(/\\/g, "/");
  if (n.startsWith("/") || /^[A-Za-z]:/.test(n)) throw new Error(`Unsafe path in archive: ${name}`);
  const parts = n.split("/").filter((p) => p !== "" && p !== ".");
  if (parts.some((p) => p === "..")) throw new Error(`Unsafe path in archive: ${name}`);
  return parts.join("/");
}

/** Joins and verifies the result stays inside `root`. */
export function insideRoot(root: string, rel: string): string {
  const full = resolve(root, rel);
  const r = resolve(root);
  if (full !== r && !full.startsWith(r.endsWith(sep) ? r : r + sep)) throw new Error(`Refusing to write outside ${r}: ${rel}`);
  return full;
}
