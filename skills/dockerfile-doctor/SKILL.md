---
name: dockerfile-doctor
description: "Use when the user says 'review my Dockerfile', 'my docker image is huge', 'docker build is slow', 'optimize this Dockerfile', 'make this image production ready', 'add a multi-stage build', 'run as non-root', or 'why is the cache busting'. Audits a Dockerfile and .dockerignore, rewrites them with multi-stage builds, lockfile-first layer order, pinned bases, a non-root user, no secrets in layers, a healthcheck and correct signal handling, and reports image size and build time before and after. Reads profile.md for cloud, runtime, CI and environments; per-language templates and findings checklist in templates.md."
---

# Dockerfile Doctor

Audit a Dockerfile the way a platform engineer would: find what makes the image big, slow to build, insecure or hard to stop, fix it, and prove the improvement with numbers. Do not rewrite for style; every change must buy size, build time, safety or reproducibility.

## Before you start

Read `profile.md` in this folder:

| profile.md line | Use |
|---|---|
| **Cloud** | Registry and platform quirks (ECR, Artifact Registry, ACR, Fly, Render) and the CPU architecture to build for. |
| **Runtime** | Kubernetes: add probes in the manifest, not only `HEALTHCHECK`, and set `runAsNonRoot`. Containers (ECS / Cloud Run): the platform health check replaces `HEALTHCHECK`; listen on `$PORT` for Cloud Run. Serverless: image must match the Lambda base and handler contract. VMs: keep `HEALTHCHECK`. |
| **CI** | Where the build runs; use its cache backend (`type=gha`, registry cache) in the build command you suggest. |
| **Environments** | Which environments build the image; one image per commit, configuration injected at run time, never baked per environment. |

If a line says "not set", ask once, write it into profile.md, continue. Open `templates.md` for the language template and the findings checklist.

## Workflow

1. **Read everything the build reads.** The Dockerfile, `.dockerignore`, the lockfile and manifest, any compose file or CI build step. Identify language, framework, entrypoint, port and what the app needs at run time versus build time.
2. **Measure the baseline.** If Docker is available and the user agrees to a local build: `docker build -t app:before .` twice (cold with `--no-cache`, then warm after touching one source file), `docker image ls app:before`, `docker history app:before`. Record size and seconds. If you cannot build, say "not measured" and estimate nothing.
3. **Audit** against the findings checklist in `templates.md`. Label each finding high, medium or low (table below).
4. **Rewrite** with the smallest set of changes that fixes the highs and mediums. Keep the app's existing behaviour: same port, same command, same env var names.
5. **Add or fix `.dockerignore`** before touching layers; a missing one is the most common cause of cache busting and leaked files.
6. **Rebuild and compare.** Same two builds, same machine. Report size and times as before, after, delta. Run the container and confirm it starts, answers its health check and stops within seconds on `docker stop`.
7. **Hand over** the diff and the commands. Do not push, tag or publish an image, and do not touch a registry or cluster without asking.

## Severity

| Severity | Examples |
|---|---|
| High | Secret or token in a layer or `ARG`; runs as root with no reason; `latest` or unpinned base in production; `curl` piped to a shell during build; whole repo copied before dependency install on every change |
| Medium | No multi-stage (compilers and dev dependencies shipped); shell-form `CMD` so signals are lost; no `.dockerignore`; no healthcheck; non-reproducible install (`npm install`, unpinned `pip`) |
| Low | Many small `RUN` layers; missing `--no-install-recommends`; apt/apk caches left behind; no `LABEL`s |

## Base image choice

| Need | Choose | Why |
|---|---|---|
| Compiled static binary (Go, Rust) | `scratch` or distroless `static` | Smallest; no shell to exploit |
| Node, Python, Java app | Distroless runtime or `-slim` | Fewer packages, fewer CVEs; debug with an ephemeral debug container |
| Needs glibc and system libs | `-slim` (Debian) | Alpine's musl breaks some wheels and native modules |
| Needs a shell for debugging in production | `-slim` or Alpine | Distroless has none |

Pin by exact tag plus digest in production: `node:22.11.0-slim@sha256:<digest>`. Resolve the digest with `docker buildx imagetools inspect <tag>` and let Dependabot or Renovate bump it. Never ship `latest`.

## Worked example: Node service

Before: 1.1 GB image, 4 min rebuild on any code edit.

```dockerfile
FROM node:latest
WORKDIR /app
COPY . .
RUN npm install
ENV NPM_TOKEN=abc123
CMD npm start
```

Findings: unpinned base (high), `COPY .` before install busts the dependency cache on every edit (high), token in `ENV` is readable from the image (high), runs as root (high), `npm install` is not reproducible (medium), shell-form `CMD` swallows SIGTERM (medium), dev dependencies and source shipped (medium).

After:

```dockerfile
# syntax=docker/dockerfile:1.7
FROM node:22.11.0-slim@sha256:<digest> AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    --mount=type=secret,id=npm_token \
    NPM_TOKEN="$(cat /run/secrets/npm_token)" npm ci

FROM deps AS build
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22.11.0-slim@sha256:<digest>
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]
```

Build with `docker build --secret id=npm_token,env=NPM_TOKEN -t app:after .`. Result to report: 1.1 GB to about 190 MB, warm rebuild after a one-line source edit from about 4 min to about 20 s because the `npm ci` layer is reused. Report your measured numbers, not these.

## Rules

- One concern per change, each tied to a finding. No drive-by reformatting.
- Order layers from least to most frequently changing: base, system packages, lockfile copy, install, source copy, build.
- Secrets only through `--mount=type=secret` or the runtime environment. `ARG` and `ENV` values are visible in `docker history`. If a secret was ever in a layer or the git history, tell the user to rotate it.
- Exec-form `CMD`/`ENTRYPOINT` (JSON array). If the app is not PID 1 safe (spawns children), add `tini` or `docker run --init`.
- One process per container. Move cron, sidecars and supervisors out.
- Package installs: `apt-get update`, `apt-get install -y --no-install-recommends`, then delete the apt lists, all in one `RUN`; `apk add --no-cache`.
- Do not change the app's code, port or command to suit the Dockerfile without saying so.
- Ask before pushing an image, pulling private bases that need credentials, or changing registry settings.

## Output

````markdown
## Dockerfile audit: <service>
**Measured:** before <size>, cold <s>s, warm <s>s | after <size>, cold <s>s, warm <s>s  (or "not measured: <why>")

### Findings
| # | Severity | Line | Problem | Fix |
|---|---|---|---|---|

### Rewritten Dockerfile
```dockerfile
...
```

### .dockerignore
```
...
```

### Verify
<build command with cache flags, run command, health check, `docker stop` timing>

### Left alone on purpose
<things that look odd but are intentional, and open questions>
````
