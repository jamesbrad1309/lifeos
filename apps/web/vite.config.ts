import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      // apps/bff — the browser never talks to apps/api directly. Defaults to a
      // BFF started with `pnpm dev:bff`; with the backend in Docker instead,
      // point it at the gateway: `BFF_URL=http://localhost:8080 pnpm dev:web`.
      "/graphql": process.env.BFF_URL ?? "http://localhost:4000",
    },
  },
});
