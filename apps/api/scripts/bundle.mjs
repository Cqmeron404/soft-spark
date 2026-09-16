/** Bundle the Vercel serverless entry, inlining workspace TypeScript. */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(apiRoot, "../..");

await build({
  absWorkingDir: apiRoot,
  entryPoints: ["src/vercel-gateway.ts"],
  outfile: "api/index.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  sourcemap: true,
  logLevel: "info",
  packages: "external",
  alias: {
    "@soft-spark/db": join(repoRoot, "packages/db/src/index.ts"),
    "@soft-spark/match-engine": join(repoRoot, "packages/match-engine/src/index.ts"),
    "@soft-spark/shared": join(repoRoot, "packages/shared/src/index.ts"),
  },
});
