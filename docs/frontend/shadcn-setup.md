# shadcn/ui Setup (with native `#` aliases)

shadcn/ui's CLI historically assumed `tsconfig.json` `paths` aliases
(`@/components`, etc.). As of the **May 2026 "Package Imports & Target
Aliases"** update, the CLI natively supports Node's `package.json#imports`
(the same `#`-prefixed mechanism this project uses everywhere else), so we
don't need `paths` at all in `apps/web`.

## 1. Init shadcn/ui

```bash
pnpm --filter web dlx shadcn@latest init
```

When it asks for import aliases, point it at the `#` roots (configured in
step 2/3 below) instead of the default `@/*` suggestion.

## 2. `apps/web/tsconfig.app.json`

```json
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "resolvePackageJsonImports": true
  }
}
```

`compilerOptions.paths` is **not** needed with this approach — that's the
whole point (see [typescript-import-aliases.md](../shared/typescript-import-aliases.md)
for why this replaces the alias-plugin route entirely).

## 3. `apps/web/package.json`

```json
{
  "imports": {
    "#components/*": "./src/components/*.tsx",
    "#lib/*": "./src/lib/*.ts",
    "#hooks/*": "./src/hooks/*.ts"
  }
}
```

## 4. `apps/web/components.json`

Map shadcn's own alias config to the same `#` roots so `shadcn add <component>`
writes files with the right import paths automatically:

```json
{
  "aliases": {
    "components": "#components",
    "ui": "#components/ui",
    "lib": "#lib",
    "hooks": "#hooks",
    "utils": "#lib/utils"
  }
}
```

## 5. Usage

```tsx
import { Button } from "#components/ui/button";
import { cn } from "#lib/utils";
```

## Adding components

```bash
pnpm --filter web dlx shadcn@latest add button card dialog
```

Generated files land under `src/components/ui/*` and import each other using
the `#components/*` alias automatically, since `components.json` told the CLI
about it.

## Known caveat

Vite's resolution of array-valued `imports` entries (multiple fallback
extensions for one alias) has had rough edges (only resolves the first
matching form) — keep each `imports` entry a single string target, not an
array, per key (as in the example above), to avoid it entirely.
