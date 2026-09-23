// tsc only compiles .ts files, so the colocated *.graphql SDL files need a
// manual copy into dist/, mirroring their src/ path (see docs/backend/graphql-bff.md).
import { cpSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const apiRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const srcDir = join(apiRoot, "src");
const distDir = join(apiRoot, "dist");

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (entry.name.endsWith(".graphql")) {
      const dest = join(distDir, relative(srcDir, full));
      mkdirSync(dirname(dest), { recursive: true });
      cpSync(full, dest);
    }
  }
}

walk(srcDir);
