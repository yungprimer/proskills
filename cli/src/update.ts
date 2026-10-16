import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { CliError, downloadZip, readSkills, type Catalog, type CatalogSkill, type FetchFn, type SkillFileOut } from "./api.js";
import { ID_RE, ORDER_RE } from "./install.js";
import { insideRoot, safeRelPath, type Target } from "./paths.js";

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;
const HEADING_RE = /^##\s+(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)\s*·\s*(.*)$/;

export function isSemver(v: string): boolean {
  return SEMVER_RE.test(v);
}

/** Compares two semver strings: -1 when a < b, 0 when equal, 1 when a > b. */
export function compareSemver(a: string, b: string): number {
  const x = SEMVER_RE.exec(a);
  const y = SEMVER_RE.exec(b);
  if (!x || !y) throw new Error(`Not a semver version: ${!x ? a : b}`);
  for (let i = 1; i <= 3; i++) {
    const d = Number(x[i]) - Number(y[i]);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  const pa = x[4];
  const pb = y[4];
  if (!pa && !pb) return 0;
  if (!pa) return 1;
  if (!pb) return -1;
  const sa = pa.split(".");
  const sb = pb.split(".");
  for (let i = 0; i < Math.max(sa.length, sb.length); i++) {
    if (sa[i] === undefined) return -1;
    if (sb[i] === undefined) return 1;
    const na = /^\d+$/.test(sa[i]);
    const nb = /^\d+$/.test(sb[i]);
    if (na && nb) {
      const d = Number(sa[i]) - Number(sb[i]);
      if (d !== 0) return d < 0 ? -1 : 1;
    } else if (na !== nb) {
      return na ? -1 : 1;
    } else if (sa[i] !== sb[i]) {
      return sa[i] < sb[i] ? -1 : 1;
    }
  }
  return 0;
}

export type ChangelogEntry = { version: string; date: string; notes: string[] };

/** Parses `## <semver> · <date>` sections of a CHANGELOG.md, in file order (newest first). */
export function parseChangelog(text: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  let cur: ChangelogEntry | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    const m = HEADING_RE.exec(line);
    if (m) {
      cur = { version: m[1], date: m[2].trim(), notes: [] };
      entries.push(cur);
    } else if (line.startsWith("## ")) {
      cur = null;
    } else if (cur) {
      const b = /^\s*[-*]\s+(.*\S)\s*$/.exec(line);
      if (b) cur.notes.push(b[1]);
    }
  }
  return entries;
}

/** Installed version of a skill folder: first changelog heading, or 0.0.0 when there is none. */
export function installedVersion(skillDir: string): string {
  try {
    const first = parseChangelog(readFileSync(join(skillDir, "CHANGELOG.md"), "utf8"))[0];
    return first ? first.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

/** Entries newer than `from` up to and including `to`, newest first. */
export function notesBetween(changelog: string, from: string, to: string): ChangelogEntry[] {
  return parseChangelog(changelog).filter((e) => isSemver(e.version) && compareSemver(e.version, from) > 0 && compareSemver(e.version, to) <= 0);
}

export type Status = "up-to-date" | "outdated" | "updated" | "skipped" | "failed" | "unknown";

export type UpdateRow = {
  id: string;
  agent: string;
  dir: string;
  installed: string;
  latest: string | null;
  status: Status;
  message?: string;
  changes?: ChangelogEntry[];
};

type Found = { skill: CatalogSkill; target: Target; dir: string };

export function findInstalled(catalog: Catalog, targets: Target[], ids: string[]): Found[] {
  const want = ids.length ? new Set(ids) : null;
  const found: Found[] = [];
  for (const target of targets) {
    if (!existsSync(target.dir)) continue;
    let names: string[];
    try {
      names = readdirSync(target.dir);
    } catch {
      continue;
    }
    for (const skill of catalog.skills) {
      if (want && !want.has(skill.id)) continue;
      if (!names.includes(skill.id) || !ID_RE.test(skill.id)) continue;
      const dir = insideRoot(target.dir, skill.id);
      if (existsSync(join(dir, "SKILL.md"))) found.push({ skill, target, dir });
    }
  }
  return found;
}

/** Replaces a skill folder with new files, keeping profile.md. The old folder survives any failure before the swap. */
export function swapSkill(dir: string, files: SkillFileOut[]): void {
  const parent = dirname(dir);
  const name = basename(dir);
  const tag = `${process.pid}-${Date.now()}`;
  const fresh = insideRoot(parent, `.${name}.new-${tag}`);
  const old = insideRoot(parent, `.${name}.old-${tag}`);
  try {
    mkdirSync(fresh, { recursive: true });
    for (const f of files) {
      const rel = safeRelPath(f.path);
      if (!rel || rel === "profile.md") continue;
      const dest = insideRoot(fresh, rel);
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, f.data);
    }
    const profile = join(dir, "profile.md");
    if (existsSync(profile)) {
      copyFileSync(profile, join(fresh, "profile.md"));
    } else {
      const shipped = files.find((f) => safeRelPath(f.path) === "profile.md");
      if (shipped) writeFileSync(join(fresh, "profile.md"), shipped.data);
    }
  } catch (e) {
    rmSync(fresh, { recursive: true, force: true });
    throw e;
  }
  try {
    renameSync(dir, old);
  } catch (e) {
    rmSync(fresh, { recursive: true, force: true });
    throw e;
  }
  try {
    renameSync(fresh, dir);
  } catch (e) {
    renameSync(old, dir);
    rmSync(fresh, { recursive: true, force: true });
    throw e;
  }
  rmSync(old, { recursive: true, force: true });
}

export type UpdateOptions = {
  ids: string[];
  catalog: Catalog;
  base: string;
  version: string;
  fetch: FetchFn;
  targets: Target[];
  order?: string;
  check: boolean;
  /** Display name for a target folder. */
  show: (t: Target) => string;
};

export async function update(o: UpdateOptions): Promise<UpdateRow[]> {
  for (const id of o.ids) if (!ID_RE.test(id)) throw new CliError(`"${id}" is not a valid skill id.`, 2);
  const unknown = o.ids.filter((id) => !o.catalog.skills.some((s) => s.id === id));
  if (unknown.length) throw new CliError(`Unknown skill${unknown.length > 1 ? "s" : ""}: ${unknown.join(", ")}. Run \`proskills list\` to see every id.`);
  if (o.order && !ORDER_RE.test(o.order)) throw new CliError("That order id doesn't look right. It starts with cs_live_ or cs_test_ and is on your receipt.", 2);

  const rows: UpdateRow[] = [];
  const cache = new Map<string, SkillFileOut[]>();
  for (const f of findInstalled(o.catalog, o.targets, [...new Set(o.ids)])) {
    const row: UpdateRow = { id: f.skill.id, agent: o.show(f.target), dir: f.dir, installed: installedVersion(f.dir), latest: f.skill.version ?? null, status: "up-to-date" };
    rows.push(row);
    if (!row.latest || !isSemver(row.latest)) {
      row.status = "unknown";
      row.message = "the server did not report a version for this skill (older server), skipped";
      continue;
    }
    if (compareSemver(row.installed, row.latest) >= 0) continue;
    row.status = "outdated";
    if (o.check) continue;
    if (!f.skill.free && !o.order) {
      row.status = "skipped";
      row.message = `paid skill: pass the order id from your receipt with --order <id> (or env PROSKILLS_ORDER). ${o.base}/library/${f.skill.slug}`;
      continue;
    }
    try {
      let files = cache.get(f.skill.id);
      if (!files) {
        const zip = await downloadZip(o.fetch, o.base, o.version, { slug: f.skill.slug, skills: [f.skill.id], answers: {}, ...(o.order ? { order: o.order } : {}) });
        files = (await readSkills(zip, f.skill.slug, [f.skill.id])).get(f.skill.id)!;
        cache.set(f.skill.id, files);
      }
      const log = files.find((x) => x.path === "CHANGELOG.md");
      row.changes = log ? notesBetween(Buffer.from(log.data).toString("utf8"), row.installed, row.latest) : [];
      swapSkill(f.dir, files);
      row.status = "updated";
    } catch (e) {
      row.status = "failed";
      row.message = e instanceof Error ? e.message : String(e);
    }
  }
  return rows;
}
