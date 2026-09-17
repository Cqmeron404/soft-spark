import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@soft-spark/ui", "@soft-spark/shared"],
  async redirects() {
    return [{ source: "/roam", destination: "/matches", permanent: false }];
  },
};

export default nextConfig;


export default nextConfig;
