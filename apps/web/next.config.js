const path = require("path");

/** @type {import("next").NextConfig} */
const nextConfig = {
  transpilePackages: ["@soft-spark/ui", "@soft-spark/shared"],
  // apps/web is the Vercel Root Directory; workspace packages live two levels up.
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

module.exports = nextConfig;
