#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { defaultEnv, run } from "./cli.js";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };
process.exitCode = await run(process.argv.slice(2), defaultEnv(pkg.version));
