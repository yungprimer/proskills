// Copies the scanner from the site so there is one source of truth.
// Skipped (keeping the existing copy) when the repo source is not around,
// e.g. when building from a published tarball.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const from = resolve(here, "../../../lib/quality/scan.ts");
const to = resolve(here, "../src/scan.ts");

if (existsSync(from)) {
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  console.log("copied lib/quality/scan.ts -> packages/cli/src/scan.ts");
} else if (!existsSync(to)) {
  console.error("lib/quality/scan.ts not found and no src/scan.ts present");
  process.exit(1);
}
