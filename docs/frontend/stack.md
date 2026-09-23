# Frontend Stack: Vite + React + TypeScript

`apps/web` — scaffolded with Vite's react-ts template, then shadcn/ui added
on top.

## Baseline scaffold

```bash
pnpm create vite@latest apps/web -- --template react-ts
```

This gives:
- `vite.config.ts`
- `tsconfig.json` / `tsconfig.app.json` / `tsconfig.node.json` (Vite splits
  app code and Node-side config (`vite.config.ts`) into separate tsconfigs)
- React 18+, strict TypeScript by default

## Styling: Tailwind (required by shadcn/ui)

```bash
pnpm --filter web add tailwindcss @tailwindcss/vite
```

```ts
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
```

## GraphQL client

Use Apollo Client (or urql) against the NestJS `/graphql` endpoint. Colocate
queries with the components that use them; generate typed hooks from the
backend schema with GraphQL Code Generator so a schema change is a
compile-time error in `apps/web`, not a runtime one.

## What's intentionally deferred to other docs

- Import aliases (`#components/*`, not `@/*`) — see
  [typescript-import-aliases.md](../shared/typescript-import-aliases.md).
- shadcn/ui installation specifics — see [shadcn-setup.md](shadcn-setup.md).
- Lint/format tooling — see [linting-formatting.md](../tooling/linting-formatting.md).
