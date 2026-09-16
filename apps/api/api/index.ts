/**
 * Vercel Hobby serverless entry. This file must exist in git: `functions`
 * globs match source files under `api/`, not build-only output like `api/index.js`.
 *
 * Default export is a Node (req, res) handler (`@hono/node-server`). Do not wrap
 * with `hono/vercel` here — that adapter expects a Fetch `Request` whose
 * `headers.get` exists. The Hobby Node runtime passes IncomingMessage instead.
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
