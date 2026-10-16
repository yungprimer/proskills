import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import { CliError, fetchCatalog, type Answers, type FetchFn } from "./api.js";
import { install } from "./install.js";
import { pickAgents, resolveTargets } from "./paths.js";
import { DEFAULT_SCAN_DIRS, badgeMarkdown, isFailing, scanDirs } from "./scancmd.js";

export const DEFAULT_BASE = "https://proskills.dev";

export const HELP = `proskills - install ProSkills agent skills and scan any skill folder

Usage
  proskills list [--collection <slug>]
  proskills add <skill-id...> [--agent claude|cursor|codex|gemini|all] [--global]
                [--order <id>] [--dir <path>] [--force] [--answers file.json]
  proskills scan [paths...] [--min 80] [--json] [--badge]

Options
  --base <url>   Another host (default ${DEFAULT_BASE}, or env PROSKILLS_URL)
  --order <id>   Order id from your receipt (or env PROSKILLS_ORDER)
  --dir <path>   Base folder instead of the current one (home folder with --global)
  --badge        After a scan, print a README badge snippet using the lowest score
                 across the scanned skills (with --json: a "badge" field)
  --help         Show this help
  --version      Show the version

Examples
  npx proskills-cli add humanizer
  npx proskills-cli add grill-me --agent all --global
  npx proskills-cli scan --min 80
`;

const OPTIONS = {
  help: { type: "boolean", short: "h" },
  version: { type: "boolean", short: "v" },
  base: { type: "string" },
  agent: { type: "string" },
  global: { type: "boolean" },
  order: { type: "string" },
  dir: { type: "string" },
  force: { type: "boolean" },
  answers: { type: "string" },
  collection: { type: "string" },
  min: { type: "string" },
  json: { type: "boolean" },
  badge: { type: "boolean" },
} as const;

export function parseCli(argv: string[]) {
  const { values, positionals } = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true, strict: true });
  return { command: positionals[0], args: positionals.slice(1), values };
}

export type Env = {
  fetch: FetchFn;
  cwd: string;
  home: string;
  env: Record<string, string | undefined>;
  out: (s: string) => void;
  err: (s: string) => void;
  version: string;
};

export function defaultEnv(version: string): Env {
  return {
    fetch: globalThis.fetch,
    cwd: process.cwd(),
    home: homedir(),
    env: process.env,
    out: (s) => process.stdout.write(s + "\n"),
    err: (s) => process.stderr.write(s + "\n"),
    version,
  };
}

const money = (n: number) => (n === 0 ? "Free" : `$${n}`);

function table(rows: string[][]): string {
  const widths = rows[0].map((_, i) => Math.max(...rows.map((r) => r[i].length)));
  return rows.map((r) => r.map((c, i) => (i === r.length - 1 ? c : c.padEnd(widths[i]))).join("  ")).join("\n");
}

function readAnswers(file: string, cwd: string): Answers {
  try {
    const data = JSON.parse(readFileSync(resolve(cwd, file), "utf8")) as unknown;
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("expected a JSON object");
    return data as Answers;
  } catch (e) {
    throw new CliError(`Could not read --answers ${file}: ${e instanceof Error ? e.message : String(e)}`, 2);
  }
}

/** Runs the CLI and returns the exit code. Never calls process.exit, so tests can drive it. */
export async function run(argv: string[], io: Env): Promise<number> {
  try {
    let parsed;
    try {
      parsed = parseCli(argv);
    } catch (e) {
      throw new CliError(`${e instanceof Error ? e.message : String(e)}\nRun \`proskills --help\` for usage.`, 2);
    }
    const { command, args, values } = parsed;
    if (values.version) {
      io.out(io.version);
      return 0;
    }
    if (values.help || !command || command === "help") {
      io.out(HELP);
      return command || values.help ? 0 : 2;
    }
    const base = (values.base ?? io.env.PROSKILLS_URL ?? DEFAULT_BASE).replace(/\/+$/, "");

    if (command === "list") {
      const cat = await fetchCatalog(io.fetch, base, io.version);
      if (values.collection && !cat.collections.some((c) => c.slug === values.collection)) {
        throw new CliError(`Unknown collection "${values.collection}". Collections: ${cat.collections.map((c) => c.slug).join(", ")}`);
      }
      const skills = cat.skills.filter((s) => !values.collection || s.slug === values.collection);
      const rows = [["ID", "COLLECTION", "PRICE", "SCAN", "NAME"], ...skills.map((s) => [s.id, s.slug, money(s.price), s.quality ? `${s.quality.score} ${s.quality.grade}` : "-", s.name])];
      io.out(table(rows));
      io.out(`\n${skills.length} skills. Install with: npx proskills-cli add <id>`);
      return 0;
    }

    if (command === "add") {
      if (!args.length) throw new CliError("Name at least one skill, e.g. `proskills add humanizer`. See `proskills list`.", 2);
      const global = !!values.global;
      const baseDir = resolve(io.cwd, values.dir ?? (global ? io.home : "."));
      let agents;
      try {
        agents = pickAgents(values.agent, baseDir, global);
      } catch (e) {
        throw new CliError((e as Error).message, 2);
      }
      const targets = resolveTargets(agents, baseDir, global);
      const order = values.order ?? io.env.PROSKILLS_ORDER ?? undefined;
      const answers = values.answers ? readAnswers(values.answers, io.cwd) : {};
      const catalog = await fetchCatalog(io.fetch, base, io.version);
      const written = await install({ ids: args, catalog, base, version: io.version, fetch: io.fetch, targets, order: order || undefined, answers, force: !!values.force });
      for (const w of written) {
        const rel = relative(io.cwd, w.dir);
        const shown = rel && !rel.startsWith("..") && !isAbsolute(rel) ? rel : w.dir;
        io.out(`wrote ${shown.replace(/\\/g, "/")}/  (${w.files} files, ${w.target.label})`);
      }
      io.out("\nRestart your agent (or start a new session) to load the skill.");
      return 0;
    }

    if (command === "scan") {
      const min = values.min === undefined ? 80 : Number(values.min);
      if (!Number.isFinite(min) || min < 0 || min > 100) throw new CliError("--min must be a number from 0 to 100.", 2);
      const explicit = args.length > 0;
      const results = scanDirs(explicit ? args : DEFAULT_SCAN_DIRS, io.cwd);
      if (!results.length) throw new CliError(explicit ? "No skill folders (containing SKILL.md) found in the given paths." : `No skills found in ${DEFAULT_SCAN_DIRS.join(" or ")}. Pass a path: proskills scan ./my-skill`, 2);
      const failed = results.filter((r) => isFailing(r, min));
      if (values.json) {
        io.out(JSON.stringify({ min, ok: failed.length === 0, ...(values.badge ? { badge: badgeMarkdown(results.map((r) => r.report.score)) } : {}), skills: results.map((r) => ({ dir: r.dir.replace(/\\/g, "/"), failed: isFailing(r, min), ...r.report })) }, null, 2));
      } else {
        for (const { dir, report: r } of results) {
          io.out(`\n${r.grade}  ${String(r.score).padStart(3)}  ${dir.replace(/\\/g, "/")}   spec ${r.pillars.spec} · eff ${r.pillars.efficiency} · clarity ${r.pillars.clarity} · sec ${r.pillars.security}`);
          for (const f of r.findings.filter((f) => f.severity !== "info")) io.out(`     ${f.severity.padEnd(8)} ${f.rule.padEnd(24)} ${f.file ?? ""}${f.line ? ":" + f.line : ""}  ${f.message}`);
        }
        io.out(`\n${results.length} skills scanned, ${failed.length} below the gate (min ${min}, grade F always fails).`);
        if (values.badge) io.out(`\nREADME badge (lowest score: ${Math.min(...results.map((r) => r.report.score))}):\n${badgeMarkdown(results.map((r) => r.report.score))}`);
      }
      return failed.length ? 1 : 0;
    }

    throw new CliError(`Unknown command "${command}". Run \`proskills --help\`.`, 2);
  } catch (e) {
    if (e instanceof CliError) {
      io.err(`proskills: ${e.message}`);
      return e.code;
    }
    io.err(`proskills: ${e instanceof Error ? e.message : String(e)}`);
    return 1;
  }
}
