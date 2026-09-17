import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@soft-spark/ui", "@soft-spark/shared"],
};

export default nextConfig;
