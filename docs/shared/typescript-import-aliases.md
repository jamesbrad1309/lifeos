# Native `#` Import Aliases (No Plugin)

Goal: `import { HabitCard } from "#components/HabitCard"` instead of
`import { HabitCard } from "../../../components/HabitCard"` — **without**
`vite-tsconfig-paths`, `tsconfig-paths` (Node/Jest), `babel-plugin-module-resolver`,
or any other alias-resolution plugin.

## The mechanism: Node's subpath imports (`package.json#imports`)

This is a real Node.js runtime feature (since Node 12.19), not a bundler
convenience — a package declares its own private aliases in its own
`package.json`:

```json
{
  "imports": {
    "#components/*": "./src/components/*.tsx",
    "#lib/*": "./src/lib/*.ts"
  }
}
```

Rules:
- The alias key **must** start with `#` (not `@` or `~` — those are
  convention-only and require a plugin to resolve). `#` is reserved by Node
  specifically for this feature.
- A bare `"#/*"` is invalid — the spec requires at least one character after
  `#`, so use `"#lib/*"`, `"#app/*"`, etc.
- These aliases are **private to the package** that declares them — they
  can't be imported from outside that package. That's a feature here: it
  keeps `apps/web`'s aliases from leaking into `apps/api`.

Because Node resolves this natively at runtime, and both TypeScript and
modern bundlers (Vite/esbuild/Rollup) implement the same resolution
algorithm, no extra tool is needed for it to work in dev, in a Jest/Vitest
run, or in a compiled `node dist/main.js` — unlike `tsconfig.json` `paths`,
which is a TypeScript-compiler-only concept that `tsc` itself doesn't even
rewrite at emit time (hence why `paths`-based aliases traditionally needed
`tsconfig-paths`/`vite-tsconfig-paths` to actually resolve at runtime).

## TypeScript support

| TS version | support |
|---|---|
| 4.5+ | `tsc` resolves `#imports` correctly under `moduleResolution: "node16"/"nodenext"` |
| 5.4+ | language server (auto-import, go-to-definition) catches up |
| 6.0+ | `moduleResolution: "bundler"` also understands the `#` syntax (needed for Vite, which doesn't use Node's ESM resolution algorithm directly) |

## Required tsconfig (per app)

```json
{
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolvePackageJsonImports": true
  }
}
```

- `moduleResolution: "bundler"` — matches how Vite actually resolves modules
  (do **not** use `"node16"/"nodenext"` for the Vite app; that resolution
  mode enforces full ESM runtime semantics like mandatory file extensions,
  which Vite doesn't require).
- For `apps/api` (NestJS, runs directly on Node, no bundler), prefer
  `moduleResolution: "nodenext"` instead — it matches the actual runtime
  (Node) resolving the compiled output.
- `resolvePackageJsonImports: true` — without this, `tsc` won't look at
  `package.json#imports` at all even on a modern `moduleResolution`.

## Per-app setup, not per-workspace

Each app (`apps/web`, `apps/api`) declares its **own** `imports` field in its
own `package.json` and its own alias prefix conventions — there's no
top-level/shared alias config, because Node scopes `imports` resolution to
the nearest `package.json` above the importing file. This is why the
monorepo doc ([monorepo-layout.md](../architecture/monorepo-layout.md))
draws a hard line between these intra-app `#` aliases and real cross-package
imports (`@lifeos/graphql-schema`), which go through pnpm's workspace
linking instead.

## Suggested alias prefixes

| app | prefix examples |
|---|---|
| `apps/web` | `#components/*`, `#lib/*`, `#hooks/*`, `#graphql/*` |
| `apps/api` | `#habits/*`, `#common/*`, `#config/*` |

Keep prefixes matching top-level `src/` folders 1:1 so the alias is never a
mystery — `#habits/*` → `./src/habits/*`.

## Known rough edges

- Vite has had bugs where an `imports` entry with an **array** of fallback
  targets (e.g. trying both `.ts` and `.tsx`) only resolves the first array
  element. Avoid arrays — give each alias one explicit target extension.
- Some tools lag on `imports` field support (check before adding a new one
  to the toolchain, e.g. a specific test runner or bundler plugin) —
  Vite, Vitest, and modern TypeScript all support it as of the versions
  above; this is no longer a bleeding-edge feature by 2026, but always
  re-verify for a *specific* dependency version before assuming it works.
