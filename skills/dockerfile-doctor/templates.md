# Templates and findings checklist

Open the section for the project's language, then run the checklist against the Dockerfile. Contents: Findings checklist, .dockerignore, Node, Python, Go, Java.

## Findings checklist

| # | Check | Look for | Fix |
|---|---|---|---|
| 1 | Base pinned | `latest`, no tag, floating major | Exact tag plus `@sha256:<digest>` |
| 2 | Multi-stage | Compilers, `-dev` packages, dev dependencies in the final image | Build stage and a minimal runtime stage |
| 3 | Layer order | `COPY . .` above the install step | Copy manifest and lockfile, install, then copy source |
| 4 | `.dockerignore` | Missing, or lacks `.git`, `node_modules`, `.env*`, build output | Add it (below) |
| 5 | Reproducible install | `npm install`, `pip install` without hashes, `apt-get install` of unpinned critical tools | `npm ci`, `pip install --require-hashes -r`, `go mod download`, lockfiles committed |
| 6 | Secrets | `ARG`/`ENV` holding tokens, `COPY` of credential files, `.env` in context | `RUN --mount=type=secret,id=...`; inject at run time |
| 7 | User | No `USER`, or `USER root` at the end | Create or use a non-root user with a fixed UID (for example 10001) and `--chown` on copies |
| 8 | Signals | Shell-form `CMD npm start` or `CMD ./run.sh` | Exec form; `exec` in wrapper scripts; `tini` as init if children are spawned |
| 9 | Health | No `HEALTHCHECK` (when the platform does not provide one) | Cheap local probe without extra tools; platform probes for Kubernetes and cloud runtimes |
| 10 | Single process | `supervisord`, `cron` plus app in one image | Split into separate containers |
| 11 | Package caches | apt lists, apk cache, pip cache, npm cache in layers | Clean in the same `RUN`, or use cache mounts |
| 12 | Architecture | Building amd64 on arm laptop for an arm cloud, or the reverse | `--platform` set deliberately; multi-arch only if needed |
| 13 | Writable paths | App writes to the image filesystem | Writable volume or `tmpfs`; read-only root filesystem where possible |
| 14 | Build args | Arbitrary `ARG` changing the cache every build (timestamps, commit sha above install) | Move volatile `ARG`s below the install layers |

## .dockerignore

```
.git
.gitignore
node_modules
**/__pycache__
*.pyc
.venv
dist
build
target
coverage
.env
.env.*
*.pem
*.key
Dockerfile*
docker-compose*.yml
.github
.vscode
.idea
*.log
```

Remove `dist`/`build`/`target` from the list if the Dockerfile copies prebuilt output. Keep lockfiles out of the ignore list.

## Node

```dockerfile
# syntax=docker/dockerfile:1.7
FROM node:22.11.0-slim@sha256:<digest> AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

FROM deps AS build
COPY . .
RUN npm run build && npm prune --omit=dev

FROM gcr.io/distroless/nodejs22-debian12:nonroot
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=nonroot:nonroot /app/node_modules ./node_modules
COPY --from=build --chown=nonroot:nonroot /app/dist ./dist
EXPOSE 3000
CMD ["dist/server.js"]
```

Distroless Node images set the entrypoint to `node`, so `CMD` is the script. Pin the distroless tag to a digest. pnpm: `corepack enable` and `pnpm install --frozen-lockfile`. Next.js: use `output: "standalone"` and copy `.next/standalone` and `.next/static`.

## Python

```dockerfile
# syntax=docker/dockerfile:1.7
FROM python:3.12.7-slim@sha256:<digest> AS build
ENV PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /app
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
COPY requirements.txt .
RUN pip install --require-hashes -r requirements.txt
COPY . .

FROM python:3.12.7-slim@sha256:<digest>
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PATH="/opt/venv/bin:$PATH"
RUN useradd --uid 10001 --create-home app
COPY --from=build /opt/venv /opt/venv
WORKDIR /app
COPY --from=build --chown=app:app /app .
USER app
EXPOSE 8000
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "app.wsgi:application"]
```

Generate hashes with `pip-compile --generate-hashes` (pip-tools) or `uv pip compile --generate-hashes`. Native wheels needing a compiler belong in the build stage only. Alpine is a poor default for Python because many wheels are glibc-only and builds fall back to slow source compiles.

## Go

```dockerfile
# syntax=docker/dockerfile:1.7
FROM golang:1.23.2@sha256:<digest> AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
COPY . .
RUN --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/app ./cmd/app

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/app /app
EXPOSE 8080
ENTRYPOINT ["/app"]
```

Typical result: 800 MB builder to 10-20 MB final. `CGO_ENABLED=0` is required for `static`; if cgo is needed use `distroless/base` instead. CA certificates and tzdata ship in distroless static; with `scratch`, copy them from the build stage.

## Java

```dockerfile
# syntax=docker/dockerfile:1.7
FROM eclipse-temurin:21.0.5_11-jdk@sha256:<digest> AS build
WORKDIR /src
COPY pom.xml .
COPY .mvn .mvn
COPY mvnw .
RUN --mount=type=cache,target=/root/.m2 ./mvnw -B -q dependency:go-offline
COPY src src
RUN --mount=type=cache,target=/root/.m2 ./mvnw -B -q package -DskipTests

FROM eclipse-temurin:21.0.5_11-jre@sha256:<digest>
RUN useradd --uid 10001 app
WORKDIR /app
COPY --from=build --chown=app:app /src/target/app.jar app.jar
USER app
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "app.jar"]
```

`MaxRAMPercentage` makes the JVM respect container memory limits. Gradle: copy `build.gradle*`, `settings.gradle*` and the wrapper first, run `./gradlew dependencies`, then copy `src`. Spring Boot layered jars (`java -Djarmode=layertools -jar app.jar extract`) split dependencies from application code for better layer reuse. Run tests in CI, not in the image build.
