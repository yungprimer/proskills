import JSZip from "jszip";
import { safeRelPath } from "./paths.js";

export type CatalogSkill = {
  id: string;
  slug: string;
  name: string;
  line: string;
  price: number;
  free: boolean;
  quality: { score: number; grade: string } | null;
};
export type CatalogCollection = { slug: string; name: string; bundle: number };
export type Catalog = { skills: CatalogSkill[]; collections: CatalogCollection[] };

export type FetchFn = typeof fetch;
export type Answers = Record<string, string | string[]>;

export class CliError extends Error {
  constructor(message: string, readonly code = 1) {
    super(message);
  }
}

const MAX_ZIP_BYTES = 50 * 1024 * 1024;
const MAX_ENTRIES = 2000;
const MAX_UNPACKED_BYTES = 100 * 1024 * 1024;

function headers(version: string, json: boolean): Record<string, string> {
  return { "User-Agent": `proskills-cli/${version}`, ...(json ? { "Content-Type": "application/json" } : {}) };
}

async function request(f: FetchFn, url: string, init: RequestInit): Promise<Response> {
  try {
    return await f(url, { ...init, signal: AbortSignal.timeout(30_000) });
  } catch (e) {
    throw new CliError(`Could not reach ${new URL(url).origin}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function fetchCatalog(f: FetchFn, base: string, version: string): Promise<Catalog> {
  const res = await request(f, `${base}/api/catalog`, { headers: headers(version, false) });
  if (!res.ok) throw new CliError(`Catalog request failed (${res.status}) at ${base}/api/catalog`);
  let data: Catalog;
  try {
    data = (await res.json()) as Catalog;
  } catch {
    throw new CliError(`${base}/api/catalog did not return JSON. Is --base correct?`);
  }
  if (!data || !Array.isArray(data.skills) || !Array.isArray(data.collections)) throw new CliError(`Unexpected catalog format from ${base}.`);
  return data;
}

export async function downloadZip(f: FetchFn, base: string, version: string, body: { slug: string; skills: string[]; answers: Answers; order?: string }): Promise<Uint8Array> {
  const res = await request(f, `${base}/api/download`, { method: "POST", headers: headers(version, true), body: JSON.stringify(body) });
  if (!res.ok) {
    let msg = "";
    try {
      msg = ((await res.json()) as { error?: string }).error ?? "";
    } catch {
      /* not JSON */
    }
    if (res.status === 402) throw new CliError(`${msg || "Payment required."} Buy at ${base}/library/${body.slug} and pass the order id with --order or PROSKILLS_ORDER.`);
    throw new CliError(`Download failed (${res.status})${msg ? `: ${msg}` : ""}`);
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.length > MAX_ZIP_BYTES) throw new CliError("Download is unexpectedly large; refusing to unpack it.");
  return buf;
}

export type SkillFileOut = { path: string; data: Uint8Array };

/**
 * Reads a /api/download zip into `skill id -> files`. Handles both layouts
 * (single skill: files at the zip root; several: `proskills-<slug>/<id>/…`).
 * Throws before returning anything when any entry name is unsafe.
 */
export async function readSkills(zipData: Uint8Array, slug: string, ids: string[]): Promise<Map<string, SkillFileOut[]>> {
  const zip = await JSZip.loadAsync(zipData);
  const entries = Object.values(zip.files);
  if (entries.length > MAX_ENTRIES) throw new CliError("Archive has too many entries.");
  const names = entries.map((e) => ({ e, rel: safeRelPath(e.name) })).filter((x) => x.rel !== "");
  const flat = names.some((x) => x.rel === "SKILL.md") && ids.length === 1;
  const prefix = `proskills-${slug}`;
  const out = new Map<string, SkillFileOut[]>(ids.map((id) => [id, []]));
  let total = 0;
  for (const { e, rel } of names) {
    if (e.dir) continue;
    let parts = rel.split("/");
    let id: string;
    if (flat) {
      if (rel === "INSTALL.md") continue;
      id = ids[0];
    } else {
      if (parts[0] === prefix) parts = parts.slice(1);
      if (parts.length < 2) continue; // bundle-level README.md
      id = parts[0];
      parts = parts.slice(1);
      if (!out.has(id)) continue;
    }
    const data = await e.async("uint8array");
    total += data.length;
    if (total > MAX_UNPACKED_BYTES) throw new CliError("Archive unpacks to an unexpected size; refusing.");
    out.get(id)!.push({ path: parts.join("/"), data });
  }
  for (const [id, files] of out) if (!files.some((f) => f.path === "SKILL.md")) throw new CliError(`The download for "${id}" did not contain a SKILL.md.`);
  return out;
}
