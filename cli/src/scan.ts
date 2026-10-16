/**
 * Skill Scanner: scores an Agent Skill (SKILL.md plus any files beside it)
 * against the open Agent Skills spec, progressive-disclosure and token
 * budgets, clarity, and security. Pure TypeScript with no Node or DOM APIs,
 * so the same code gates our catalog at build time (scripts/scan.ts) and
 * runs in the visitor's browser on /scan, where nothing is uploaded.
 *
 * Every finding names its rule, so a score is always explainable. Four
 * pillars of 25 points each make the 0–100 score; any critical security
 * finding caps the grade at F regardless of the rest.
 */

export type SkillFile = { path: string; content: string };

export type Severity = "critical" | "warn" | "info";
export type Pillar = "spec" | "efficiency" | "clarity" | "security";

export type Finding = {
  rule: string;
  pillar: Pillar;
  severity: Severity;
  message: string;
  file?: string;
  line?: number;
  /** Points taken off the pillar. */
  cost: number;
};

export type ScanReport = {
  name: string | null;
  description: string | null;
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  pillars: Record<Pillar, number>;
  findings: Finding[];
  stats: {
    files: number;
    bodyLines: number;
    /** Tokens loaded when the skill triggers (SKILL.md body). */
    bodyTokens: number;
    /** Tokens always in context (name + description). */
    metaTokens: number;
    /** Tokens in supporting files, loaded only on demand. */
    referenceTokens: number;
    scripts: number;
    links: string[];
  };
};

export const PILLAR_MAX = 25;

/** Rough token count; within ~10% of real tokenizers for English and code. */
export function tokens(text: string): number {
  return Math.ceil(text.length / 4);
}

type Front = { data: Record<string, string>; body: string; bodyStart: number; error?: string; raw: string };

/** Minimal frontmatter reader: top-level `key: value` pairs, folded/quoted values. */
export function parseFrontmatter(src: string): Front {
  const text = src.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  if (!text.startsWith("---\n")) return { data: {}, body: text, bodyStart: 1, error: "missing", raw: "" };
  const end = text.indexOf("\n---", 4);
  if (end < 0) return { data: {}, body: text, bodyStart: 1, error: "unterminated", raw: "" };
  const raw = text.slice(4, end);
  const after = text.indexOf("\n", end + 4);
  const body = after < 0 ? "" : text.slice(after + 1);
  const data: Record<string, string> = {};
  let error: string | undefined;
  let key: string | null = null;
  let block = false;
  for (const line of raw.split("\n")) {
    const m = /^([A-Za-z][\w-]*):\s?(.*)$/.exec(line);
    if (m && !line.startsWith(" ")) {
      key = m[1];
      let v = m[2].trim();
      block = v === "|" || v === ">" || v === "|-" || v === ">-";
      if (block) v = "";
      else if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1);
      else if (/:\s/.test(v) && !/^[[{]/.test(v)) error = `"${key}" has an unquoted ": " — YAML parsers will reject or mangle it`;
      data[key] = v;
    } else if (key && (line.startsWith(" ") || line.startsWith("\t"))) {
      data[key] = (data[key] ? data[key] + (block ? "\n" : " ") : "") + line.trim();
    }
  }
  return { data, body, bodyStart: raw.split("\n").length + 3, error, raw };
}

const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const RESERVED = ["anthropic", "claude"];

type Pattern = { rule: string; re: RegExp; severity: Severity; cost: number; message: string };

/** Security patterns. Matched per line across every text file in the skill. */
const SECURITY: Pattern[] = [
  { rule: "sec/prompt-injection", severity: "critical", cost: 25, re: /\b(ignore|disregard|forget)\s+(all\s+)?(the\s+)?(previous|prior|above|earlier|system)\s+(instructions|prompts?|rules|messages)/i, message: "Tries to override the agent's instructions." },
  { rule: "sec/prompt-injection", severity: "critical", cost: 25, re: /\b(you are now|new system prompt|developer mode|jailbreak|DAN mode)\b/i, message: "Role-hijack phrasing." },
  { rule: "sec/conceal", severity: "critical", cost: 25, re: /\b(do not|don't|never)\s+(tell|inform|mention|reveal|show)\s+(this\s+to\s+)?(the\s+)?user\b/i, message: "Asks the agent to hide actions from the user." },
  { rule: "sec/remote-exec", severity: "critical", cost: 25, re: /\b(curl|wget|iwr|Invoke-WebRequest)\b[^\n|]*\|\s*(ba|z)?sh\b|\b(curl|wget)\b[^\n|]*\|\s*(python|node|iex)\b|\biex\s*\(\s*(New-Object|iwr|irm)/i, message: "Downloads and executes remote code." },
  { rule: "sec/exfiltration", severity: "critical", cost: 25, re: /\b(curl|wget|fetch|requests\.(post|get)|axios|http\.request)\b[^\n]*(\$\{?[A-Z_]*(KEY|TOKEN|SECRET|PASSWORD)|\.env\b|id_rsa|\.ssh|\.aws\/credentials|process\.env|os\.environ)/i, message: "Sends secrets or credentials over the network." },
  { rule: "sec/secret-read", severity: "warn", cost: 10, re: /(~|\$HOME|%USERPROFILE%)?[\\/]\.(ssh|aws|gnupg|kube|docker)[\\/]|\bid_(rsa|ed25519)\b|\.npmrc|\.netrc|\bkeychain\b/i, message: "Touches credential files." },
  { rule: "sec/destructive", severity: "critical", cost: 20, re: /\brm\s+-[a-z]*r[a-z]*f?[a-z]*\s+(\/|~|\$HOME|\*|\.\s*$)|\bmkfs\b|\bdd\s+if=.*of=\/dev\/|:\(\)\s*\{\s*:\|:&\s*\};:|\bformat\s+[a-z]:/i, message: "Destructive filesystem command." },
  { rule: "sec/destructive", severity: "warn", cost: 8, re: /\bgit\s+push\s+(-f|--force)\b|\bgit\s+reset\s+--hard\b|\bDROP\s+(TABLE|DATABASE)\b|--no-verify\b|--dangerously/i, message: "Risky command; make sure the skill asks before running it." },
  { rule: "sec/obfuscation", severity: "critical", cost: 20, re: /\b(base64\s+(-d|--decode)|atob\(|FromBase64String|eval\s*\(|exec\s*\(\s*(compile|base64|bytes))/i, message: "Decodes or evaluates hidden code." },
  { rule: "sec/obfuscation", severity: "warn", cost: 6, re: /[A-Za-z0-9+/]{120,}={0,2}/, message: "Long encoded blob; reviewers can't read what it does." },
  { rule: "sec/fake-prerequisite", severity: "critical", cost: 25, re: /\b(download|install|run)\b[^\n]{0,60}\bhttps?:\/\/[^\s)]+\.(dmg|pkg|exe|msi|zip|tar\.gz|sh|ps1|bin|AppImage)\b/i, message: "Tells the user or agent to fetch and run a binary, the pattern behind the ClawHavoc malware campaign." },
  { rule: "sec/remote-instructions", severity: "warn", cost: 10, re: /\b(fetch|download|curl|read|load|get)\b[^\n]{0,40}\bhttps?:\/\/[^\s)]+[^\n]{0,60}\b(follow|apply|execute|obey)\b[^\n]{0,20}\b(instructions|rules|steps|prompt)/i, message: "Pulls instructions from a URL at runtime, so the skill can change after it was reviewed." },
  { rule: "sec/persistence", severity: "warn", cost: 10, re: /\b(crontab|launchctl|systemctl\s+enable|schtasks|reg\s+add|settings\.json.*hooks|Startup folder)\b|\.(bashrc|zshrc|bash_profile|profile)(?!\.?\w)/i, message: "Installs persistence or edits shell/agent config." },
  { rule: "sec/permissions", severity: "warn", cost: 8, re: /--dangerously-skip-permissions|bypassPermissions|allowed-tools:\s*["']?\*|chmod\s+(-R\s+)?777|\bsudo\b/i, message: "Escalates permissions." },
];

const HIDDEN = /[​-‏‪-‮⁠-⁤⁦-⁩﻿\u{E0000}-\u{E007F}]/u;
const URL_RE = /\bhttps?:\/\/[^\s)<>"'`\]]+/g;

const VAGUE = /\b(as needed|if appropriate|when relevant|try to|you might|you may want to|consider (?:possibly)?|etc\.?|and so on|best practices|high[- ]quality|make sure it'?s good)\b/gi;

/** A referenced file is read by the skill (so must ship with it), not written by it. */
const READS = /\b(read|open|see|consult|load|follow|template|in this folder|bundled)\b/i;
const WRITES = /\b(write|writes|written|writing|read by|create|save|keep|update|generate|produce|look for|if it exists)\b/i;
/** Unfinished markers, skipping lines that ban them ("No lorem ipsum"). */
const TODO_RE = /^(?!.*\b(no|never|ban|avoid|don't|not)\b).*\b(TODO|FIXME|TBD|lorem ipsum)\b/im;

function lineAt(text: string, index: number): string {
  const start = text.lastIndexOf("\n", index) + 1;
  const stop = text.indexOf("\n", index);
  return text.slice(start, stop < 0 ? undefined : stop);
}

function lineOf(text: string, index: number): number {
  let n = 1;
  for (let i = 0; i < index && i < text.length; i++) if (text.charCodeAt(i) === 10) n++;
  return n;
}

function isText(path: string): boolean {
  return !/\.(png|jpe?g|gif|webp|mp4|mov|webm|pdf|zip|woff2?|ttf|ico|mp3|wav)$/i.test(path);
}

/** Folder the SKILL.md sits in, so "x/SKILL.md" and "SKILL.md" both work. */
function rootOf(files: SkillFile[]): { skill: SkillFile | undefined; dir: string } {
  const skill = [...files].sort((a, b) => a.path.length - b.path.length).find((f) => /(^|\/)SKILL\.md$/i.test(f.path));
  const dir = skill ? skill.path.slice(0, skill.path.length - "SKILL.md".length) : "";
  return { skill, dir };
}

export function scanSkill(input: SkillFile[] | string): ScanReport {
  const files = (typeof input === "string" ? [{ path: "SKILL.md", content: input }] : input).map((f) => ({ path: f.path.replace(/\\/g, "/"), content: f.content }));
  const findings: Finding[] = [];
  const add = (f: Finding) => findings.push(f);
  const { skill, dir } = rootOf(files);
  const rel = (p: string) => (p.startsWith(dir) ? p.slice(dir.length) : p);

  if (!skill) {
    add({ rule: "spec/no-skill-md", pillar: "spec", severity: "critical", cost: 25, message: "No SKILL.md found. Every skill needs one at its root." });
    return finish(null, null, findings, { files: files.length, bodyLines: 0, bodyTokens: 0, metaTokens: 0, referenceTokens: 0, scripts: 0, links: [] });
  }

  const fm = parseFrontmatter(skill.content);
  const name = fm.data.name ?? null;
  const description = fm.data.description ?? null;
  const body = fm.body;
  const bodyLines = body.split("\n").length;
  const others = files.filter((f) => f !== skill);

  // ---- spec -------------------------------------------------------------
  if (fm.error === "missing") add({ rule: "spec/frontmatter", pillar: "spec", severity: "critical", cost: 25, message: "SKILL.md must start with YAML frontmatter (--- name, description ---).", file: "SKILL.md", line: 1 });
  else if (fm.error === "unterminated") add({ rule: "spec/frontmatter", pillar: "spec", severity: "critical", cost: 25, message: "Frontmatter is never closed with ---.", file: "SKILL.md", line: 1 });
  else if (fm.error) add({ rule: "spec/yaml", pillar: "spec", severity: "warn", cost: 8, message: `Frontmatter: ${fm.error}. Wrap the value in quotes.`, file: "SKILL.md", line: 2 });

  if (!fm.error || fm.error.startsWith('"')) {
    if (!name) add({ rule: "spec/name", pillar: "spec", severity: "critical", cost: 12, message: "Missing required `name`.", file: "SKILL.md" });
    else {
      if (!NAME_RE.test(name)) add({ rule: "spec/name-format", pillar: "spec", severity: "warn", cost: 6, message: `name "${name}" must be lowercase letters, numbers and single hyphens.`, file: "SKILL.md" });
      if (name.length > 64) add({ rule: "spec/name-length", pillar: "spec", severity: "warn", cost: 4, message: `name is ${name.length} characters; the limit is 64.`, file: "SKILL.md" });
      if (RESERVED.some((r) => name.includes(r))) add({ rule: "spec/name-reserved", pillar: "spec", severity: "warn", cost: 4, message: `name contains a reserved word (${RESERVED.join(", ")}).`, file: "SKILL.md" });
      const folder = dir.replace(/\/$/, "").split("/").pop();
      if (folder && folder !== name) add({ rule: "spec/name-folder", pillar: "spec", severity: "info", cost: 2, message: `name "${name}" doesn't match its folder "${folder}"; some agents key on the folder.`, file: "SKILL.md" });
    }
    if (!description) add({ rule: "spec/description", pillar: "spec", severity: "critical", cost: 12, message: "Missing required `description`; agents can't know when to load the skill.", file: "SKILL.md" });
    else {
      if (description.length > 1024) add({ rule: "spec/description-length", pillar: "spec", severity: "warn", cost: 6, message: `description is ${description.length} characters; the limit is 1024 and most agents truncate it.`, file: "SKILL.md" });
      if (/<[a-z][^>]*>/i.test(description)) add({ rule: "spec/description-xml", pillar: "spec", severity: "warn", cost: 4, message: "description contains XML/HTML tags, which the spec forbids.", file: "SKILL.md" });
    }
    // The open spec's six fields. Claude Code ignores others, but claude.ai and the Skills API reject them.
    const known = new Set(["name", "description", "license", "allowed-tools", "metadata", "compatibility"]);
    const extra = Object.keys(fm.data).filter((k) => !known.has(k));
    if (extra.length) add({ rule: "spec/non-portable-keys", pillar: "spec", severity: "warn", cost: 4, message: `Non-spec frontmatter (${extra.join(", ")}). claude.ai and the Skills API reject the upload; move them under \`metadata\` or drop them.`, file: "SKILL.md" });
  }

  // Links inside SKILL.md must resolve to bundled files.
  const present = new Set(others.map((f) => rel(f.path)));
  const refRe = /(?:\]\(|`)((?:\.\/)?(?:[\w.-]+\/)*[\w.-]+\.(?:md|py|sh|js|mjs|ts|json|ya?ml|txt|csv|html))(?:\)|`)/g;
  const referenced = new Set<string>();
  // profile.md holds the user's answers: the skill creates it if missing, so it
  // is never required, and any mention in SKILL.md (frontmatter too) counts.
  if (/\bprofile\.md\b/.test(skill.content)) referenced.add("profile.md");
  for (const m of body.matchAll(refRe)) {
    const p = m[1].replace(/^\.\//, "");
    if (p === "SKILL.md" || p === "profile.md" || /^(package|tsconfig)\.json$/.test(p)) continue;
    if (/^[\w-]+\.(json|ya?ml|html|ts|js)$/.test(p) && !present.has(p)) continue; // likely a user-project file, not a bundled one
    referenced.add(p);
    // Only files the skill reads must ship with it; files it writes (decisions.md, storyboard.md) won't exist yet.
    const ln = lineAt(body, m.index ?? 0);
    const reads = READS.test(ln) && !WRITES.test(ln);
    if (!present.has(p) && reads) add({ rule: "spec/broken-ref", pillar: "spec", severity: "warn", cost: 4, message: `References ${p}, which isn't in the skill folder.`, file: "SKILL.md", line: fm.bodyStart + lineOf(body, m.index ?? 0) - 1 });
  }

  // ---- efficiency / progressive disclosure -------------------------------
  const metaTokens = tokens(`${name ?? ""} ${description ?? ""}`);
  const bodyTokens = tokens(body);
  const referenceTokens = others.filter((f) => isText(f.path)).reduce((a, f) => a + tokens(f.content), 0);
  const scripts = others.filter((f) => /\.(py|sh|js|mjs|ts|ps1|rb)$/i.test(f.path)).length;

  if (description) {
    if (description.length < 60) add({ rule: "eff/description-thin", pillar: "efficiency", severity: "warn", cost: 6, message: "description is too short to trigger reliably. Say what it does and when to use it.", file: "SKILL.md" });
    if (!/\b(use (it )?when|use for|use this|when the user|whenever|trigger|asks? (for|to))\b/i.test(description)) add({ rule: "eff/description-trigger", pillar: "efficiency", severity: "warn", cost: 6, message: "description doesn't say *when* to use the skill (\"Use when …\"). Agents decide from this line alone.", file: "SKILL.md" });
    if (/^(this skill|a skill|i |i'm|you )/i.test(description)) add({ rule: "eff/description-voice", pillar: "efficiency", severity: "info", cost: 2, message: "Write the description in third person (\"Reviews…\", \"Use when…\"), not \"This skill…\" or \"I…\".", file: "SKILL.md" });
  }
  if (bodyLines > 500) add({ rule: "eff/body-lines", pillar: "efficiency", severity: "warn", cost: 8, message: `SKILL.md body is ${bodyLines} lines; keep it under 500 and move detail into reference files.`, file: "SKILL.md" });
  if (bodyTokens > 5000) add({ rule: "eff/body-tokens", pillar: "efficiency", severity: "warn", cost: Math.min(12, Math.round((bodyTokens - 5000) / 500) + 4), message: `~${bodyTokens} tokens load every time this triggers. Aim for under 5,000; split into reference files read on demand.`, file: "SKILL.md" });
  else if (bodyTokens > 3000 && others.length === 0) add({ rule: "eff/no-disclosure", pillar: "efficiency", severity: "info", cost: 3, message: `~${bodyTokens} tokens in one file. Long tables, examples or catalogues belong in reference files.`, file: "SKILL.md" });
  // Depth: a handful of one-line rules restates what a capable agent already does.
  if (bodyTokens < 120) add({ rule: "eff/body-thin", pillar: "efficiency", severity: "warn", cost: 10, message: "The body is very thin. A skill should carry knowledge the agent doesn't already have.", file: "SKILL.md" });
  else if (bodyTokens + referenceTokens < 450) add({ rule: "eff/body-light", pillar: "efficiency", severity: "warn", cost: 6, message: `Only ~${bodyTokens + referenceTokens} tokens of guidance. Add the specifics an agent can't guess: thresholds, checklists, worked examples.`, file: "SKILL.md" });
  for (const f of others.filter((f) => isText(f.path) && /\.md$/i.test(f.path))) {
    const r = rel(f.path);
    if (!referenced.has(r) && !/readme|license|changelog/i.test(r)) add({ rule: "eff/orphan-file", pillar: "efficiency", severity: "info", cost: 2, message: `${r} is never mentioned in SKILL.md, so the agent won't know to read it.`, file: r });
    if (tokens(f.content) > 2500 && !/^#{1,3} /m.test(f.content.slice(0, 600)) && !/contents|toc/i.test(f.content.slice(0, 800))) add({ rule: "eff/reference-toc", pillar: "efficiency", severity: "info", cost: 1, message: `${r} is long; open it with a heading or contents list so the agent can jump to what it needs.`, file: r });
    if (/\/[^/]+\/[^/]+\/[^/]+\.md$/.test("/" + r)) add({ rule: "eff/nested-refs", pillar: "efficiency", severity: "info", cost: 1, message: `${r} is nested deeply; keep references one level below SKILL.md.`, file: r });
  }

  // ---- clarity ----------------------------------------------------------
  const headings = body.match(/^#{1,3} .+$/gm) ?? [];
  if (headings.length < 2 && bodyLines > 25) add({ rule: "clarity/structure", pillar: "clarity", severity: "warn", cost: 5, message: "Few headings; break the body into sections (workflow, rules, output).", file: "SKILL.md" });
  if (!/(^#{1,3} .*\b(examples?|samples?|before\s*(\/|and|&|vs\.?|→)\s*after|good\s*(\/|and|&|vs\.?)\s*bad|do\s*(\/|and|&)\s*don't)\b)|```|^\s*\|.*\|.*\|\s*$/im.test(body)) add({ rule: "clarity/examples", pillar: "clarity", severity: "warn", cost: 5, message: "No examples or code blocks. One concrete input → output example improves consistency more than extra rules.", file: "SKILL.md" });
  if (!/^#{1,3} .*(output|deliver|return|format|result|report)/im.test(body) && !/\b(output|return|respond with|reply with|deliver)\b/i.test(body)) add({ rule: "clarity/output", pillar: "clarity", severity: "warn", cost: 4, message: "Doesn't say what the result should look like. Add an Output section.", file: "SKILL.md" });
  if (bodyLines > 40 && !/^\s*(\d+[.)]|- \[ \]|#{1,3} .*(workflow|steps|process|procedure|how to|modes?))/im.test(body)) add({ rule: "clarity/workflow", pillar: "clarity", severity: "info", cost: 3, message: "No numbered workflow. Ordered steps make agents more reliable than prose.", file: "SKILL.md" });
  const vague = body.match(VAGUE) ?? [];
  if (vague.length >= 4) add({ rule: "clarity/vague", pillar: "clarity", severity: "info", cost: Math.min(5, vague.length - 2), message: `${vague.length} vague phrases (${[...new Set(vague.map((v) => v.toLowerCase()))].slice(0, 4).join(", ")}). Replace with concrete thresholds.`, file: "SKILL.md" });
  const todo = TODO_RE.exec(body);
  if (todo) add({ rule: "clarity/unfinished", pillar: "clarity", severity: "warn", cost: 4, message: `Unfinished marker "${todo[2]}".`, file: "SKILL.md", line: fm.bodyStart + lineOf(body, todo.index) - 1 });

  // ---- security ---------------------------------------------------------
  const links = new Set<string>();
  for (const f of files.filter((f) => isText(f.path))) {
    const r = rel(f.path);
    const lines = f.content.split(/\r?\n/);
    const seen = new Set<string>();
    lines.forEach((ln, i) => {
      for (const p of SECURITY) {
        if (seen.has(p.rule + p.message)) continue;
        if (p.re.test(ln)) {
          seen.add(p.rule + p.message);
          add({ rule: p.rule, pillar: "security", severity: p.severity, cost: p.cost, message: p.message, file: r, line: i + 1 });
        }
      }
      if (HIDDEN.test(ln) && !seen.has("hidden")) {
        seen.add("hidden");
        add({ rule: "sec/hidden-unicode", pillar: "security", severity: "critical", cost: 25, message: "Invisible or bidirectional Unicode characters can hide instructions from reviewers.", file: r, line: i + 1 });
      }
      for (const u of ln.match(URL_RE) ?? []) links.add(u.replace(/[.,;:]+$/, ""));
    });
    if (/<!--[\s\S]*?(instruction|ignore|assistant|system|agent|you must)[\s\S]*?-->/i.test(f.content)) add({ rule: "sec/hidden-comment", pillar: "security", severity: "warn", cost: 10, message: "HTML comment carries instructions the user won't see rendered.", file: r });
  }
  const external = [...links].filter((u) => !/^https?:\/\/(localhost|127\.0\.0\.1|example\.(com|org))/i.test(u));
  if (external.some((u) => /\b(pastebin|ngrok|webhook\.site|requestbin|transfer\.sh|discord(app)?\.com\/api\/webhooks|bit\.ly|tinyurl)\b/i.test(u))) add({ rule: "sec/suspicious-host", pillar: "security", severity: "critical", cost: 20, message: "Links to a paste, tunnel, webhook or shortener host often used for exfiltration.", file: "SKILL.md" });
  else if (external.some((u) => /^http:\/\//i.test(u))) add({ rule: "sec/plain-http", pillar: "security", severity: "info", cost: 2, message: "Links over plain http.", file: "SKILL.md" });
  if (scripts && !/^#{1,3} .*(script|run|tool)/im.test(body) && !others.some((f) => /\.(py|sh|js|mjs|ts)$/.test(f.path) && body.includes(rel(f.path).split("/").pop()!))) add({ rule: "sec/undocumented-script", pillar: "security", severity: "warn", cost: 5, message: "Bundles scripts that SKILL.md never explains. Say what each script does and when it runs.", file: "SKILL.md" });

  return finish(name, description, findings, { files: files.length, bodyLines, bodyTokens, metaTokens, referenceTokens, scripts, links: external.slice(0, 50) });
}

function finish(name: string | null, description: string | null, findings: Finding[], stats: ScanReport["stats"]): ScanReport {
  const pillars: Record<Pillar, number> = { spec: PILLAR_MAX, efficiency: PILLAR_MAX, clarity: PILLAR_MAX, security: PILLAR_MAX };
  for (const f of findings) pillars[f.pillar] = Math.max(0, pillars[f.pillar] - f.cost);
  const score = Math.round(pillars.spec + pillars.efficiency + pillars.clarity + pillars.security);
  const critical = findings.some((f) => f.severity === "critical");
  const grade = critical ? "F" : score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F";
  const order: Record<Severity, number> = { critical: 0, warn: 1, info: 2 };
  findings.sort((a, b) => order[a.severity] - order[b.severity] || b.cost - a.cost);
  return { name, description, score, grade, pillars, findings, stats };
}
