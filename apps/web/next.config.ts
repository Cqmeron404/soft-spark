import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@soft-spark/ui", "@soft-spark/shared"],
  // Monorepo: trace workspace packages from the repo root so Vercel Hobby can collect them.
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default nextConfig;
