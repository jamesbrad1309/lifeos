import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    // Must come before react(): it generates src/routeTree.gen.ts from
    // src/routes/ and splits each route's component into its own chunk.
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      // apps/bff — the browser never talks to apps/api directly. Defaults to a
      // BFF started with `pnpm dev:bff`; with the backend in Docker instead,
      // point it at the gateway: `BFF_URL=http://localhost:8080 pnpm dev:web`.
      "/graphql": process.env.BFF_URL ?? "http://localhost:4000",
      // CSV uploads (a plain multipart route on the BFF, streamed to the API).
      "/uploads": process.env.BFF_URL ?? "http://localhost:4000",
    },
  },
});
