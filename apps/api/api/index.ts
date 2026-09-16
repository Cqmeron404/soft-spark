/**
 * Vercel Hobby serverless entry. This file must exist in git: `functions`
 * globs match source files under `api/`, not build-only output like `api/index.js`.
 */
export {
  default,
  GET,
  POST,
  PATCH,
  PUT,
  OPTIONS,
  DELETE,
  runtime,
  dynamic,
} from "../src/vercel-gateway.js";

export const maxDuration = 60;
