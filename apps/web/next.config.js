const path = require("node:path");

/** @type {import("next").NextConfig} */
const nextConfig = {
  transpilePackages: ["@soft-spark/ui", "@soft-spark/shared"],
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

module.exports = nextConfig;
