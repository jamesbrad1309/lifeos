import { config } from "dotenv";
import { z } from "zod";

// Local dev reads the repo-root .env (same file the API uses). In Docker the
// variables are injected by docker-compose.yml and these files don't exist,
// so dotenv silently no-ops.
config({ path: ["../../.env", ".env"] });

const envSchema = z.object({
  BFF_PORT: z.coerce.number().int().positive().default(4000),
  /** Base URL of the internal REST API (apps/api) — never exposed to browsers. */
  API_URL: z.string().url().default("http://localhost:3000"),
  /** Per-call timeout for API requests, so one hung upstream call can't hang a GraphQL request forever. */
  API_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(`Invalid environment configuration: ${result.error.message}`);
  }
  return result.data;
}

export const env = loadEnv();
