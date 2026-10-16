import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { scanSkill, type ScanReport, type SkillFile } from "./scan.js";

export const DEFAULT_SCAN_DIRS = [".claude/skills", ".agents/skills"];

function walk(dir: string, base: string, out: SkillFile[]) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = join(dir, name);
    const st = lstatSync(p);
    if (st.isSymbolicLink()) continue;
    if (st.isDirectory()) walk(p, base, out);
    else if (st.size < 2_000_000) out.push({ path: relative(base, p).replace(/\\/g, "/"), content: readFileSync(p, "utf8") });
  }
}

/** A skill folder itself, or the skill folders directly inside a folder. */
export function skillDirs(root: string): string[] {
  if (!existsSync(root) || !lstatSync(root).isDirectory()) return [];
  if (existsSync(join(root, "SKILL.md"))) return [root];
  return readdirSync(root)
    .filter((n) => !n.startsWith("."))
    .map((n) => join(root, n))
    .filter((p) => {
      const st = lstatSync(p);
      return st.isDirectory() && !st.isSymbolicLink() && existsSync(join(p, "SKILL.md"));
    });
}

export type ScanResult = { dir: string; report: ScanReport };

export function scanDirs(roots: string[], cwd: string): ScanResult[] {
  const seen = new Set<string>();
  const results: ScanResult[] = [];
  for (const root of roots) {
    for (const dir of skillDirs(resolve(cwd, root))) {
      if (seen.has(dir)) continue;
      seen.add(dir);
      const files: SkillFile[] = [];
      walk(dir, join(dir, ".."), files);
      results.push({ dir: relative(cwd, dir) || ".", report: scanSkill(files) });
    }
  }
  return results;
}

export function isFailing(r: ScanResult, min: number): boolean {
  return r.report.grade === "F" || r.report.score < min;
}

/** README badge for a scan. Uses the lowest score, so one weak skill cannot hide behind a strong one. */
export function badgeMarkdown(scores: number[]): string {
  const score = Math.max(0, Math.min(100, Math.round(Math.min(...scores))));
  return `[![Scanned by ProSkills](https://proskills.dev/badge?score=${score})](https://proskills.dev/scan)`;
}
