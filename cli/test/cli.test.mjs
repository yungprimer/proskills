import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import JSZip from "jszip";
import { parseCli, run } from "../dist/cli.js";
import { pickAgents, resolveTargets, safeRelPath, insideRoot } from "../dist/paths.js";
import { readSkills } from "../dist/api.js";
import { compareSemver, installedVersion } from "../dist/update.js";

const here = fileURLToPath(new URL(".", import.meta.url));
// Runs in the site repo (packages/cli, skills in premium-skills/) and in the
// public repo (cli/, skills in skills/). Only free skills are used.
const repo = [resolve(here, "../../.."), resolve(here, "../..")].find((d) => existsSync(join(d, "premium-skills")) || existsSync(join(d, "skills")));
const SKILLS = existsSync(join(repo, "premium-skills")) ? "premium-skills" : "skills";
const GOOD = `${SKILLS}/humanizer`;
const EVIL = resolve(here, "fixtures/evil-skill");
const entry = resolve(here, "../dist/index.js");
const tmp = () => mkdtempSync(join(tmpdir(), "proskills-test-"));

const catalog = {
  skills: [
    { id: "humanizer", slug: "humanizer", name: "Humanizer", line: "x", price: 0, free: true, quality: { score: 100, grade: "A" } },
    { id: "grill-me", slug: "grill-me", name: "Grill Me", line: "x", price: 0, free: true, quality: { score: 99, grade: "A" } },
    { id: "humanizer-pro", slug: "humanizer", name: "Humanizer Pro", line: "x", price: 9, free: false, quality: { score: 100, grade: "A" } },
  ],
  collections: [
    { slug: "humanizer", name: "Humanizer", bundle: 15 },
    { slug: "grill-me", name: "Grill Me", bundle: 15 },
  ],
};

async function zipOf(files) {
  const z = new JSZip();
  for (const [name, content] of Object.entries(files)) z.file(name, content);
  return z.generateAsync({ type: "uint8array" });
}

/** Mock fetch serving the catalog and a single-skill (flat) zip per download. */
function mockFetch({ zips = {}, onDownload } = {}) {
  const calls = [];
  const f = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith("/api/catalog")) return Response.json(catalog);
    if (String(url).endsWith("/api/download")) {
      const body = JSON.parse(init.body);
      onDownload?.(body);
      if (body.skills.some((id) => id === "humanizer-pro") && !body.order) return Response.json({ error: "Payment required." }, { status: 402 });
      const data = zips[body.slug] ?? (await zipOf({ "SKILL.md": `---\nname: ${body.skills[0]}\n---\nbody`, "profile.md": "p", "INSTALL.md": "i" }));
      return new Response(data, { headers: { "Content-Type": "application/zip" } });
    }
    return new Response("nope", { status: 404 });
  };
  f.calls = calls;
  return f;
}

function harness(over = {}) {
  const out = [];
  const err = [];
  const cwd = over.cwd ?? tmp();
  return {
    out,
    err,
    cwd,
    io: { fetch: mockFetch(), cwd, home: tmp(), env: {}, out: (s) => out.push(s), err: (s) => err.push(s), version: "9.9.9", ...over },
  };
}

test("parseCli: command, positionals and flags", () => {
  const p = parseCli(["add", "humanizer", "grill-me", "--agent", "cursor", "--global", "--order=cs_test_x", "--force"]);
  assert.equal(p.command, "add");
  assert.deepEqual(p.args, ["humanizer", "grill-me"]);
  assert.equal(p.values.agent, "cursor");
  assert.equal(p.values.global, true);
  assert.equal(p.values.order, "cs_test_x");
  assert.equal(p.values.force, true);
});

test("parseCli: rejects unknown flags with exit code 2", async () => {
  assert.throws(() => parseCli(["list", "--nope"]));
  const h = harness();
  assert.equal(await run(["list", "--nope"], h.io), 2);
  assert.match(h.err.join("\n"), /nope/);
});

test("--version and --help", async () => {
  const h = harness();
  assert.equal(await run(["--version"], h.io), 0);
  assert.equal(h.out[0], "9.9.9");
  assert.equal(await run(["--help"], h.io), 0);
  assert.match(h.out.join("\n"), /proskills add/);
});

test("safeRelPath rejects traversal and absolute paths", () => {
  for (const bad of ["../evil", "a/../../evil", "/etc/passwd", "C:\\Windows\\x", "c:/x", "a\\..\\..\\b", "a\0b"]) {
    assert.throws(() => safeRelPath(bad), /Unsafe path/, bad);
  }
  assert.equal(safeRelPath("./a//b/c.md"), "a/b/c.md");
  assert.equal(safeRelPath("dir\\file.md"), "dir/file.md");
  assert.throws(() => insideRoot("/tmp/root", "../x"), /outside/);
  assert.doesNotThrow(() => insideRoot("/tmp/root", "a/b"));
});

test("readSkills rejects a zip entry that escapes the skill folder", async () => {
  const z = new JSZip();
  z.file("SKILL.md", "ok");
  z.file("../../evil.txt", "x");
  const data = await z.generateAsync({ type: "uint8array" });
  await assert.rejects(readSkills(data, "humanizer", ["humanizer"]), /Unsafe path/);
});

test("readSkills handles the multi-skill layout and skips bundle README", async () => {
  const data = await zipOf({
    "proskills-humanizer/humanizer/SKILL.md": "a",
    "proskills-humanizer/humanizer/references/x.md": "b",
    "proskills-humanizer/humanizer-pro/SKILL.md": "c",
    "proskills-humanizer/README.md": "readme",
  });
  const m = await readSkills(data, "humanizer", ["humanizer", "humanizer-pro"]);
  assert.deepEqual(m.get("humanizer").map((f) => f.path).sort(), ["SKILL.md", "references/x.md"]);
  assert.deepEqual(m.get("humanizer-pro").map((f) => f.path), ["SKILL.md"]);
});

test("add: a malicious zip writes nothing and fails", async () => {
  const bad = await zipOf({ "SKILL.md": "ok", "../../escape.txt": "x" });
  const h = harness();
  h.io.fetch = mockFetch({ zips: { humanizer: bad } });
  const code = await run(["add", "humanizer"], h.io);
  assert.equal(code, 1);
  assert.match(h.err.join("\n"), /Unsafe path/);
  assert.equal(existsSync(join(h.cwd, ".claude")), false);
});

test("agent path selection", () => {
  const base = tmp();
  assert.deepEqual(pickAgents(undefined, base, false), ["claude"]);
  mkdirSync(join(base, ".agents"));
  assert.deepEqual(pickAgents(undefined, base, false), ["codex"]);
  mkdirSync(join(base, ".claude"));
  assert.deepEqual(pickAgents(undefined, base, false), ["claude"]);
  assert.deepEqual(pickAgents(undefined, base, true), ["claude"]);
  assert.deepEqual(pickAgents("all", base, false), ["claude", "cursor", "codex", "gemini"]);
  assert.throws(() => pickAgents("vim", base, false), /Unknown agent/);

  const proj = resolveTargets(["claude", "cursor", "codex", "gemini"], base, false).map((t) => t.dir);
  assert.deepEqual(proj, [join(base, ".claude/skills"), join(base, ".agents/skills")].map((p) => resolve(p)));
  const user = resolveTargets(["claude", "cursor", "codex", "gemini"], base, true).map((t) => t.dir);
  assert.deepEqual(user, [".claude/skills", ".cursor/skills", ".agents/skills", ".gemini/skills"].map((p) => resolve(base, p)));
});

test("add: writes the skill into the detected agent folder, then refuses to overwrite", async () => {
  const h = harness();
  mkdirSync(join(h.cwd, ".agents"));
  assert.equal(await run(["add", "humanizer"], h.io), 0);
  const skill = join(h.cwd, ".agents/skills/humanizer");
  assert.match(readFileSync(join(skill, "SKILL.md"), "utf8"), /name: humanizer/);
  assert.ok(existsSync(join(skill, "profile.md")));
  assert.equal(existsSync(join(skill, "INSTALL.md")), false);
  assert.match(h.out.join("\n"), /wrote \.agents\/skills\/humanizer\//);

  const again = harness({ cwd: h.cwd });
  assert.equal(await run(["add", "humanizer"], again.io), 1);
  assert.match(again.err.join("\n"), /--force/);
  assert.equal(await run(["add", "humanizer", "--force"], harness({ cwd: h.cwd }).io), 0);
});

test("add: --global with --agent codex uses ~/.agents/skills", async () => {
  const h = harness();
  assert.equal(await run(["add", "grill-me", "--global", "--agent", "codex"], h.io), 0);
  assert.ok(existsSync(join(h.io.home, ".agents/skills/grill-me/SKILL.md")));
});

test("add: paid skill without an order explains how to buy; with PROSKILLS_ORDER it sends the order", async () => {
  const h = harness();
  assert.equal(await run(["add", "humanizer-pro"], h.io), 1);
  assert.match(h.err.join("\n"), /https:\/\/proskills\.dev\/library\/humanizer/);
  assert.equal(h.io.fetch.calls.some((c) => c.url.endsWith("/api/download")), false);

  let sent;
  const h2 = harness();
  h2.io.fetch = mockFetch({ onDownload: (b) => (sent = b) });
  h2.io.env = { PROSKILLS_ORDER: "cs_test_abcdefghijk1" };
  assert.equal(await run(["add", "humanizer-pro"], h2.io), 0);
  assert.equal(sent.order, "cs_test_abcdefghijk1");
  assert.deepEqual(sent.skills, ["humanizer-pro"]);
  assert.deepEqual(sent.answers, {});
});

test("add: unknown id and bad order are reported", async () => {
  const h = harness();
  assert.equal(await run(["add", "nope-skill"], h.io), 1);
  assert.match(h.err.join("\n"), /Unknown skill/);
  const h2 = harness();
  assert.equal(await run(["add", "humanizer-pro", "--order", "bogus"], h2.io), 2);
});

test("add: --base and PROSKILLS_URL choose the host", async () => {
  const h = harness();
  h.io.env = { PROSKILLS_URL: "http://localhost:9/" };
  await run(["list"], h.io);
  assert.equal(h.io.fetch.calls[0].url, "http://localhost:9/api/catalog");
  const h2 = harness();
  await run(["list", "--base", "https://example.test"], h2.io);
  assert.equal(h2.io.fetch.calls[0].url, "https://example.test/api/catalog");
});

test("list: table and --collection filter", async () => {
  const h = harness();
  assert.equal(await run(["list", "--collection", "humanizer"], h.io), 0);
  const text = h.out.join("\n");
  assert.match(text, /humanizer-pro\s+humanizer\s+\$9/);
  assert.doesNotMatch(text, /grill-me/);
  assert.equal(await run(["list", "--collection", "zzz"], harness().io), 1);
});

function scan(args) {
  return spawnSync(process.execPath, [entry, "scan", ...args], { encoding: "utf8", cwd: repo });
}

test("scan: evil-skill fails with exit 1", () => {
  const r = scan([EVIL]);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /prompt-injection/);
  assert.match(r.stdout, /^F /m);
});

test("scan: a good skill passes with exit 0", () => {
  const r = scan([GOOD, "--min", "80"]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test("scan: --min above the score fails, --json is parseable", () => {
  const r = scan([GOOD, "--min", "100", "--json"]);
  const j = JSON.parse(r.stdout);
  assert.equal(j.skills.length, 1);
  if (j.skills[0].score < 100) assert.equal(r.status, 1);
  const bad = scan([GOOD, "--min", "abc"]);
  assert.equal(bad.status, 2);
});

test("scan: no skills found exits 2; a folder of skills scans each", () => {
  const empty = tmp();
  const r = spawnSync(process.execPath, [entry, "scan"], { encoding: "utf8", cwd: empty });
  assert.equal(r.status, 2);
  rmSync(empty, { recursive: true, force: true });
  const many = scan([SKILLS, "--json"]);
  assert.ok(JSON.parse(many.stdout).skills.length > 5);
});

test("scan --badge: prints the markdown snippet with the lowest score", () => {
  const r = scan([GOOD, "--badge"]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const low = JSON.parse(scan([SKILLS, "--json"]).stdout).skills.reduce((m, s) => Math.min(m, s.score), 100);
  const many = scan([SKILLS, "--badge"]);
  assert.ok(many.stdout.includes(`[![Scanned by ProSkills](https://proskills.dev/badge?score=${low})](https://proskills.dev/scan)`), many.stdout.slice(-300));
  assert.doesNotMatch(scan([GOOD]).stdout, /Scanned by ProSkills/);
});

test("scan --badge --json: badge is a field, output stays valid JSON", () => {
  const j = JSON.parse(scan([GOOD, "--json", "--badge"]).stdout);
  assert.match(j.badge, /^\[!\[Scanned by ProSkills\]\(https:\/\/proskills\.dev\/badge\?score=\d+\)\]\(https:\/\/proskills\.dev\/scan\)$/);
});

// ---- update ----

const LOG = (...vs) => "# Changelog\n\n" + vs.map(([v, n]) => `## ${v} · 2026-10-16\n\n- ${n}\n`).join("\n");
const ORDER = "cs_test_abcdefghij1234";

/** Catalog + zip server for update tests. `versions` maps id -> catalog version; `zips` maps id -> files. */
function updateFetch({ versions, zips = {}, paid = [] }) {
  const f = async (url, init = {}) => {
    if (String(url).endsWith("/api/catalog")) {
      const skills = Object.entries(versions).map(([id, version]) => ({ id, slug: id, name: id, line: "x", price: paid.includes(id) ? 9 : 0, free: !paid.includes(id), quality: null, ...(version ? { version } : {}) }));
      return Response.json({ skills, collections: [] });
    }
    if (String(url).endsWith("/api/download")) {
      const body = JSON.parse(init.body);
      f.bodies.push(body);
      return new Response(await zipOf(zips[body.skills[0]]), { headers: { "Content-Type": "application/zip" } });
    }
    return new Response("nope", { status: 404 });
  };
  f.bodies = [];
  return f;
}

function seed(cwd, id, files, dir = ".claude/skills") {
  for (const [name, content] of Object.entries({ "SKILL.md": "old", ...files })) {
    const p = join(cwd, dir, id, name);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, content);
  }
}

const NEW_FILES = { "SKILL.md": "new", "CHANGELOG.md": LOG(["1.1.0", "faster"], ["1.0.0", "first"]), "profile.md": "shipped" };

test("compareSemver orders versions, prereleases first", () => {
  assert.equal(compareSemver("1.0.0", "1.0.0"), 0);
  assert.equal(compareSemver("1.2.0", "1.10.0"), -1);
  assert.equal(compareSemver("2.0.0", "1.99.99"), 1);
  assert.equal(compareSemver("1.0.0-beta.1", "1.0.0"), -1);
  assert.equal(compareSemver("1.0.0-beta.2", "1.0.0-beta.10"), -1);
  assert.equal(compareSemver("0.0.0", "0.0.1"), -1);
});

test("update: outdated skill is replaced, profile.md kept, stale files removed, notes printed", async () => {
  const h = harness();
  seed(h.cwd, "humanizer", { "CHANGELOG.md": LOG(["1.0.0", "first"]), "profile.md": "mine", "stale.md": "x" });
  h.io.fetch = updateFetch({ versions: { humanizer: "1.1.0" }, zips: { humanizer: { ...NEW_FILES, "references/a.md": "a" } } });
  assert.equal(await run(["update"], h.io), 0);
  const dir = join(h.cwd, ".claude/skills/humanizer");
  assert.equal(readFileSync(join(dir, "SKILL.md"), "utf8"), "new");
  assert.equal(readFileSync(join(dir, "profile.md"), "utf8"), "mine");
  assert.equal(readFileSync(join(dir, "references/a.md"), "utf8"), "a");
  assert.equal(existsSync(join(dir, "stale.md")), false);
  assert.deepEqual(readdirSync(join(h.cwd, ".claude/skills")), ["humanizer"]);
  const out = h.out.join("\n");
  assert.match(out, /humanizer 1\.0\.0 → 1\.1\.0 \(\.claude\/skills\)/);
  assert.match(out, /- faster/);
  assert.doesNotMatch(out, /- first/);
});

test("update: up-to-date skill is untouched and not downloaded", async () => {
  const h = harness();
  seed(h.cwd, "humanizer", { "CHANGELOG.md": LOG(["1.1.0", "x"]) });
  const f = updateFetch({ versions: { humanizer: "1.1.0" }, zips: { humanizer: NEW_FILES } });
  h.io.fetch = f;
  assert.equal(await run(["update"], h.io), 0);
  assert.equal(readFileSync(join(h.cwd, ".claude/skills/humanizer/SKILL.md"), "utf8"), "old");
  assert.equal(f.bodies.length, 0);
  assert.match(h.out.join("\n"), /up to date/);
});

test("update --check: exit 1 and a table when outdated, 0 when current, nothing written", async () => {
  const h = harness();
  seed(h.cwd, "humanizer", { "CHANGELOG.md": LOG(["1.0.0", "x"]) });
  const f = updateFetch({ versions: { humanizer: "1.1.0" }, zips: { humanizer: NEW_FILES } });
  h.io.fetch = f;
  assert.equal(await run(["update", "--check"], h.io), 1);
  assert.match(h.out.join("\n"), /humanizer\s+\.claude\/skills\s+1\.0\.0\s+1\.1\.0\s+outdated/);
  assert.equal(f.bodies.length, 0);
  assert.equal(readFileSync(join(h.cwd, ".claude/skills/humanizer/SKILL.md"), "utf8"), "old");
  const ok = harness({ cwd: h.cwd });
  ok.io.fetch = updateFetch({ versions: { humanizer: "1.0.0" } });
  assert.equal(await run(["update", "--check"], ok.io), 0);
});

test("update --json is machine readable", async () => {
  const h = harness();
  seed(h.cwd, "humanizer", { "CHANGELOG.md": LOG(["1.0.0", "x"]) });
  h.io.fetch = updateFetch({ versions: { humanizer: "1.1.0" } });
  assert.equal(await run(["update", "--check", "--json"], h.io), 1);
  const j = JSON.parse(h.out.join("\n"));
  assert.equal(j.ok, false);
  assert.deepEqual([j.skills[0].id, j.skills[0].installed, j.skills[0].latest, j.skills[0].status], ["humanizer", "1.0.0", "1.1.0", "outdated"]);
});

test("update: outdated paid skill without an order is skipped with a hint; with an order it updates", async () => {
  const h = harness();
  seed(h.cwd, "pro", { "CHANGELOG.md": LOG(["1.0.0", "x"]) });
  const f = updateFetch({ versions: { pro: "1.1.0" }, paid: ["pro"], zips: { pro: NEW_FILES } });
  h.io.fetch = f;
  assert.equal(await run(["update"], h.io), 0);
  assert.match(h.out.join("\n"), /--order/);
  assert.equal(f.bodies.length, 0);
  assert.equal(readFileSync(join(h.cwd, ".claude/skills/pro/SKILL.md"), "utf8"), "old");

  const again = harness({ cwd: h.cwd, env: { PROSKILLS_ORDER: ORDER } });
  again.io.fetch = f;
  assert.equal(await run(["update"], again.io), 0);
  assert.equal(f.bodies[0].order, ORDER);
  assert.equal(readFileSync(join(h.cwd, ".claude/skills/pro/SKILL.md"), "utf8"), "new");
});

test("update: a folder without CHANGELOG.md counts as 0.0.0 and is updated; catalog without version is skipped", async () => {
  const h = harness();
  seed(h.cwd, "humanizer", {});
  seed(h.cwd, "grill-me", {});
  h.io.fetch = updateFetch({ versions: { humanizer: "1.0.0", "grill-me": null }, zips: { humanizer: { "SKILL.md": "new", "CHANGELOG.md": LOG(["1.0.0", "first"]) } } });
  assert.equal(installedVersion(join(h.cwd, ".claude/skills/humanizer")), "0.0.0");
  assert.equal(await run(["update"], h.io), 0);
  const out = h.out.join("\n");
  assert.match(out, /humanizer 0\.0\.0 → 1\.0\.0/);
  assert.match(out, /grill-me .*skipped/);
  assert.equal(readFileSync(join(h.cwd, ".claude/skills/grill-me/SKILL.md"), "utf8"), "old");
  assert.equal(installedVersion(join(h.cwd, ".claude/skills/humanizer")), "1.0.0");
});

test("update: a malicious zip is rejected and the old skill stays intact", async () => {
  const h = harness();
  seed(h.cwd, "humanizer", { "profile.md": "mine" });
  h.io.fetch = updateFetch({ versions: { humanizer: "1.0.0" }, zips: { humanizer: { "SKILL.md": "new", "../../escape.txt": "x" } } });
  assert.equal(await run(["update"], h.io), 1);
  assert.match(h.out.join("\n"), /Unsafe path/);
  assert.equal(readFileSync(join(h.cwd, ".claude/skills/humanizer/SKILL.md"), "utf8"), "old");
  assert.equal(readFileSync(join(h.cwd, ".claude/skills/humanizer/profile.md"), "utf8"), "mine");
  assert.equal(existsSync(join(h.cwd, "escape.txt")), false);
  assert.deepEqual(readdirSync(join(h.cwd, ".claude/skills")), ["humanizer"]);
});

test("update: limits to named ids and checks every agent folder", async () => {
  const h = harness();
  seed(h.cwd, "humanizer", {}, ".claude/skills");
  seed(h.cwd, "humanizer", {}, ".agents/skills");
  seed(h.cwd, "grill-me", {}, ".claude/skills");
  h.io.fetch = updateFetch({ versions: { humanizer: "1.0.0", "grill-me": "1.0.0" }, zips: { humanizer: NEW_FILES } });
  assert.equal(await run(["update", "--check", "--json"], h.io), 1);
  assert.equal(JSON.parse(h.out.join("\n")).skills.length, 3);
  const one = harness({ cwd: h.cwd });
  one.io.fetch = updateFetch({ versions: { humanizer: "1.0.0", "grill-me": "1.0.0" }, zips: { humanizer: NEW_FILES } });
  assert.equal(await run(["update", "humanizer", "--json"], one.io), 0);
  const j = JSON.parse(one.out.join("\n"));
  assert.deepEqual(j.skills.map((s) => [s.id, s.status]), [["humanizer", "updated"], ["humanizer", "updated"]]);
  assert.equal(readFileSync(join(h.cwd, ".agents/skills/humanizer/SKILL.md"), "utf8"), "new");
  assert.equal(readFileSync(join(h.cwd, ".claude/skills/grill-me/SKILL.md"), "utf8"), "old");
});
