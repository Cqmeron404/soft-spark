/** Bundle a workspace package `src/index.ts` → `dist/index.js` (Node-loadable ESM). */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { build } from "esbuild";

const pkgRoot = process.cwd();
const pkg = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8"));
const platform = pkg.name === "@soft-spark/shared" ? "neutral" : "node";

await build({
  absWorkingDir: pkgRoot,
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
  bundle: true,
  platform,
  format: "esm",
  target: "node20",
  packages: "external",
  sourcemap: true,
  logLevel: "info",
});
