import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { CliError, downloadZip, readSkills, type Answers, type Catalog, type FetchFn, type SkillFileOut } from "./api.js";
import { insideRoot, safeRelPath, type Target } from "./paths.js";

export const ID_RE = /^[a-z0-9][a-z0-9-]{0,60}$/;
export const ORDER_RE = /^cs_(test|live)_[A-Za-z0-9]{10,200}$/;

export type InstallOptions = {
  ids: string[];
  catalog: Catalog;
  base: string;
  version: string;
  fetch: FetchFn;
  targets: Target[];
  order?: string;
  answers: Answers;
  force: boolean;
};

export type Written = { id: string; target: Target; dir: string; files: number };

/** Resolves ids against the catalog and checks purchase state. Throws CliError with the next step. */
export function plan(ids: string[], catalog: Catalog, base: string, order?: string): Map<string, string[]> {
  const unique = [...new Set(ids)];
  for (const id of unique) if (!ID_RE.test(id)) throw new CliError(`"${id}" is not a valid skill id.`, 2);
  const unknown = unique.filter((id) => !catalog.skills.some((s) => s.id === id));
  if (unknown.length) throw new CliError(`Unknown skill${unknown.length > 1 ? "s" : ""}: ${unknown.join(", ")}. Run \`proskills list\` to see every id.`);
  if (order && !ORDER_RE.test(order)) throw new CliError("That order id doesn't look right. It starts with cs_live_ or cs_test_ and is on your receipt.", 2);
  const groups = new Map<string, string[]>();
  const locked: string[] = [];
  for (const id of unique) {
    const s = catalog.skills.find((k) => k.id === id)!;
    if (!s.free && !order) locked.push(`  ${id}  ($${s.price})  ${base}/library/${s.slug}`);
    groups.set(s.slug, [...(groups.get(s.slug) ?? []), id]);
  }
  if (locked.length) {
    throw new CliError(`These skills are paid and need an order id:\n${locked.join("\n")}\nBuy at the link, then rerun with --order <id> (or set PROSKILLS_ORDER).`);
  }
  return groups;
}

export async function install(o: InstallOptions): Promise<Written[]> {
  const groups = plan(o.ids, o.catalog, o.base, o.order);
  const ids = [...groups.values()].flat();

  if (!o.force) {
    const clashes = o.targets.flatMap((t) => ids.map((id) => insideRoot(t.dir, id)).filter((p) => existsSync(p)));
    if (clashes.length) throw new CliError(`Already installed, not overwriting:\n${clashes.map((c) => "  " + c).join("\n")}\nUse --force to replace.`);
  }

  // Download and validate everything before touching the disk.
  const staged = new Map<string, SkillFileOut[]>();
  for (const [slug, groupIds] of groups) {
    const zip = await downloadZip(o.fetch, o.base, o.version, { slug, skills: groupIds, answers: o.answers, ...(o.order ? { order: o.order } : {}) });
    for (const [id, files] of await readSkills(zip, slug, groupIds)) staged.set(id, files);
  }

  const written: Written[] = [];
  for (const t of o.targets) {
    for (const [id, files] of staged) {
      const dir = insideRoot(t.dir, id);
      if (o.force && existsSync(dir)) rmSync(dir, { recursive: true, force: true });
      for (const f of files) {
        const dest = insideRoot(dir, safeRelPath(f.path));
        mkdirSync(dirname(dest), { recursive: true });
        writeFileSync(dest, f.data);
      }
      written.push({ id, target: t, dir, files: files.length });
    }
  }
  return written;
}
