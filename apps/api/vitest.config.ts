import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// `#finance/*` etc. point at dist/ at runtime (package.json "imports");
// tests run against the TypeScript source instead.
export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^#([\w-]+)\/(.*)$/,
        replacement: fileURLToPath(new URL("./src/$1/$2.ts", import.meta.url)),
      },
    ],
  },
  test: { include: ["src/**/*.test.ts"] },
});
