import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  transpilePackages: ["@soft-spark/ui", "@soft-spark/shared"],
  outputFileTracingRoot: path.join(dir, "../.."),
  async redirects() {
    return [{ source: "/roam", destination: "/matches", permanent: false }];
  },
};

export default nextConfig;
