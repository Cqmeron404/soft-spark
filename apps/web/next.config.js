const fs = require("node:fs");
const path = require("node:path");

function monorepoRoot() {
  const here = typeof __dirname === "string" ? __dirname : process.cwd();
  return [path.join(here, "../.."), path.join(here, ".."), here].find((dir) =>
    fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))
  );
}

const root = monorepoRoot();

/** @type {import("next").NextConfig} */
const nextConfig = {
  transpilePackages: ["@soft-spark/ui", "@soft-spark/shared"],
  ...(root ? { outputFileTracingRoot: root } : {}),
};

module.exports = nextConfig;
