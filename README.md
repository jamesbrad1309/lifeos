# LifeOS

A habit tracker for **custom habits**: each one gets its own schedule, unit,
target and start time. You check habits off (or log a value) each day and
track streaks over time.

- **Web:** React 19, TypeScript, Vite, Tailwind, shadcn/ui, Apollo Client (`apps/web`)
- **API:** NestJS hosting an Apollo GraphQL BFF, Prisma, PostgreSQL, pino logging (`apps/api`)
- **Tooling:** pnpm workspace, native TypeScript `#` import aliases, Biome + oxlint, Docker

## Quick start

Requirements: Node ≥ 22, pnpm 10, Docker.

```bash
pnpm quickstart
```

This one command:

1. copies `.env.example` to `.env` if `.env` doesn't exist
2. installs dependencies
3. starts Postgres in Docker
4. runs the migrations
5. starts the web app and the API in watch mode

When it's running:

| Service  | URL                             |
| -------- | ------------------------------- |
| Web      | http://localhost:5173           |
| GraphQL  | http://localhost:3000/graphql   |
| Postgres | `localhost:5433` (lifeos/lifeos) |

In development, Vite proxies `/graphql` to the API.

### Run everything in Docker

```bash
docker compose up --build
```

This serves the web app at http://localhost:8080 and the API at
http://localhost:3000. You don't need Node installed, but there's no hot
reload.

## Scripts

Run from the repo root:

| Command         | What it does                         |
| --------------- | ------------------------------------ |
| `pnpm dev`      | Web + API in watch mode              |
| `pnpm dev:web`  | Web only                             |
| `pnpm dev:api`  | API only                             |
| `pnpm build`    | Build both apps                      |
| `pnpm lint`     | oxlint + Biome lint                  |
| `pnpm format`   | Biome format (writes changes)        |
| `pnpm check`    | Biome lint + format (writes changes) |

Database scripts, run in the API package:

```bash
pnpm --filter api migrate:dev      # create/apply a migration after editing schema.prisma
pnpm --filter api prisma:studio    # browse the database
```

## Configuration

`.env` lives at the repo root (see `.env.example`):

| Variable       | Default                                             |
| -------------- | --------------------------------------------------- |
| `DATABASE_URL` | `postgres://lifeos:lifeos@localhost:5433/lifeos`    |
| `API_PORT`     | `3000`                                              |
| `WEB_PORT`     | `5173`                                              |
| `NODE_ENV`     | `development`                                       |
| `LOG_LEVEL`    | `debug` in dev, `info` in prod                      |

## Layout

```
apps/
  api/        NestJS + GraphQL + Prisma (schema in prisma/schema.prisma)
  web/        React + Vite frontend
docker/       Dockerfiles and nginx config
docs/         Architecture and design notes
scripts/      quickstart.sh
```

## Docs

Design notes are in [`docs/`](docs/index.md) and mirrored to the
[wiki](https://github.com/jamesbrad1309/lifeos/wiki). They cover the
architecture, data model, use cases (with build status), GraphQL/Nest
structure, logging, and the Docker setup.
