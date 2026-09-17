import fs from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

function monorepoRoot() {
  const here = typeof __dirname !== "undefined" ? __dirname : process.cwd();
  return [path.join(here, "../.."), path.join(here, ".."), here].find((dir) =>
    fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))
  );
}

const root = monorepoRoot();

const nextConfig: NextConfig = {
  transpilePackages: ["@soft-spark/ui", "@soft-spark/shared"],
  ...(root ? { outputFileTracingRoot: root } : {}),
};

export default nextConfig;
