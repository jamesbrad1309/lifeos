# Linting & Formatting: Biome + oxlint

Both are Rust-based, no ESLint/Prettier. They overlap in purpose, so the
split here is deliberate rather than "install both and hope":

| tool | role in this repo |
|---|---|
| **Biome** | formatter + the general-purpose linter/organizer (import sorting, base correctness rules), single config, zero setup |
| **oxlint** | a very fast *additional* correctness pass with broader rule coverage, run in CI before/alongside Biome to catch things Biome's smaller rule set misses |

Rationale: Biome alone is the right choice for a project this size (one
unified tool, less config surface) — oxlint is added on top specifically for
its larger rule coverage and speed in CI, not to replace Biome's formatter.
If the extra tool ever feels like redundant noise, it's safe to drop oxlint
and run Biome alone.

## Root config

```jsonc
// biome.json
{
  "$schema": "https://biomejs.dev/schemas/latest/schema.json",
  "formatter": { "enabled": true, "indentStyle": "space" },
  "linter": { "enabled": true, "rules": { "recommended": true } },
  "javascript": { "formatter": { "quoteStyle": "double" } },
  "files": { "ignore": ["dist", "node_modules", "**/*.graphql"] }
}
```

```jsonc
// .oxlintrc.json
{
  "$schema": "https://raw.githubusercontent.com/oxc-project/oxc/main/npm/oxlint/configuration_schema.json",
  "categories": { "correctness": "error" },
  "ignorePatterns": ["dist", "node_modules"]
}
```

## Root `package.json` scripts

```json
{
  "scripts": {
    "lint": "oxlint . && biome lint .",
    "format": "biome format --write .",
    "check": "biome check --write ."
  }
}
```

Run `oxlint` first — it's the faster of the two, so a broad correctness
failure surfaces before spending time in Biome's pass.

## Editor integration

Both ship an editor extension (VS Code: "Biome" and "oxc/oxlint"). Set Biome
as the default formatter for `.ts`/`.tsx`/`.json` in workspace settings so
format-on-save doesn't fight with any lingering Prettier config.

## No ESLint

Deliberately no ESLint/`eslint-plugin-*`/Prettier in this repo — Biome covers
formatting and the base lint rule set, oxlint covers the rest. Don't add
ESLint back in "just for one plugin" without confirming Biome/oxlint truly
lack the rule first; that's usually not the case in 2026.
