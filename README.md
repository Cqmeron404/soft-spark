# Soft spark

AI dating bots explore compatibility; when confidence clears the threshold, both people get the same mid-point restaurant invite. Slice 3: deployable web, Places in prod, push (band/invite only), DualStatusRow + onboard photo polish, thin LLM soak.

Clients see **state + confidence band + invite card** only (frozen **A**). Raw scores, `messages[]`, and bot transcripts stay internal. Push and realtime are **band/invite events only** — never chat. InviteCard distances are **miles**. Ember mark + tagline **Your bot dates. You show up.**

## Stack

| Path | Role |
|------|------|
| `apps/web` | Next.js — Vercel config, auth, onboard (circle crop / initials skip), matches, reveal, invite DualStatusRow, web push |
| `apps/mobile` | Expo — DualStatusRow parity, photo step, Expo push token |
| `apps/api` | Hono — Better Auth, Drizzle, SSE, seed or Places VenueSuggester, status-only push, match job |
| `apps/realtime` | Partykit party (`match` rooms) for band/invite fan-out |
| `packages/db` | Drizzle schema + Postgres / PGlite + **local/demo** venue catalog seed |
| `packages/shared` | `MatchState`, bands, events, client DTOs, miles, DualStatusRow copy, push payloads |
| `packages/match-engine` | Nexus drop-ins + stub/LLM `ConversationRunner` (stub fallback) + midpoint venues |
| `packages/ui` | Soft spark tokens / `BandChip` / `SignalLine` / `InviteCard` / `DualStatusRow` / `PhotoCrop` |

## Quick start

```bash
pnpm install
pnpm typecheck
pnpm build
pnpm seed    # local/demo Denver catalog only (blocked when NODE_ENV=production)
pnpm demo
pnpm soak    # alias of demo; stub by default
pnpm test    # invite_threshold 0.75 soak + demo
```

`pnpm demo` (and `pnpm soak`) signs up two Denver users (Maya, Jordan) via Better Auth, onboards (photoUrl), runs hard-filter → persona bot turns → transcript-derived chemistry → midpoint venues → dual accept, and asserts **booked**. It also checks prod boot/Places guards (seed flags skip Places), 401s, paused bots (one + both), client payloads without `confidence` / transcripts / `messages[]`, `match.venue_unavailable` keeping `exploring`, intent soft mismatch, safety inject → `match.safety_failed`, early `low_fit_early_exit`, rollback `MATCH_ENGINE_MODE=stub`, LLM down stub fallback, DualStatusRow copy, and restart survival.

Persona turns must still clear **invite_threshold 0.75** — the threshold is frozen; do not lower it if soak dips.

**Rollback:** `MATCH_ENGINE_MODE=stub` — no code change. Stub is used even if `OPENAI_API_KEY` is set. LLM empty/error still stub-falls back when mode is `llm`.

**Live LLM soak (optional):** `MATCH_ENGINE_MODE=llm pnpm soak` when `OPENAI_API_KEY` is present. CI skips live completions if the key is missing (no secret invented).

### HTTP demo

```bash
pnpm dev:api          # http://localhost:8787
bash scripts/demo.sh  # curl: sign-up → onboard → booked
pnpm dev:web          # http://localhost:3000
```

Signed-out → marketing `/` then `/auth/sign-up` (**Get started**) or `/auth/sign-in`. Signed-in without a dating profile → `/onboard`. Else `/matches`. Optional Partykit: `pnpm dev:realtime` then set `PARTYKIT_HOST`.

## Production deploy

Live deploy needs **host secrets**. This repo does **not** invent credentials. Wiring:

| Surface | Config | Notes |
|---------|--------|--------|
| Web | `apps/web/vercel.json` + root `vercel.json` | Vercel project Root Directory = `apps/web` (or deploy from repo root). Set `NEXT_PUBLIC_API_URL`. |
| API | `apps/api/vercel.json` + `apps/api/Dockerfile` | Vercel Root Directory = `apps/api`, Framework **Other** (`framework: null`). Serverless entry is committed `apps/api/api/index.ts` — `functions` must glob that source file (a generated `api/index.js` will fail the build). The Hobby runtime is **Node (req, res)**; the gateway converts IncomingMessage into a Web `Request` (`headers.get`), **buffers POST bodies** (streaming `Readable.toWeb` hangs `request.json()` until timeout), and answers `GET /health` plus `OPTIONS /auth/*` without waiting on Postgres. `installCommand` / `buildCommand` still run from the **repo root** so workspace packages emit `dist/` JS. `maxDuration` 60s (SSE degraded). Docker is preferred for long-lived Node. |
| Checklist | `bash scripts/deploy.sh check` | Prints which required vars are missing (values never printed). |
| VAPID | `bash scripts/deploy.sh vapid` | `npx web-push generate-vapid-keys` — do not commit keys. |

**Boot (`NODE_ENV=production`)** refuses to start without `DATABASE_URL` (`postgres://…`) and `BETTER_AUTH_SECRET` (not the dev default). Missing Google Places does **not** fail boot when `ALLOW_VENUE_SEED=1` or `VENUE_MODE=seed`. `/health` reports `venues` as `seed` | `places` plus boolean env flags (no secret values).

### Prod go-live secrets (exact)

Required (Phase 1 auth/DB — Vercel **API** project):

- `DATABASE_URL` — Postgres URL
- `BETTER_AUTH_SECRET` — 32+ char signing secret (`AUTH_SECRET` alias)
- `BETTER_AUTH_URL` — public API origin (`https://soft-spark-api.vercel.app`)
- `WEB_ORIGIN` — public web origin (`https://soft-spark.vercel.app`). Must match the browser `Origin` header exactly (no trailing slash). Used for CORS `Access-Control-Allow-Origin` and Better Auth `trustedOrigins`.
- `AUTH_MODE=prod` — optional; already implied when `NODE_ENV=production`

**Cookies (cross-site Hobby):** web `soft-spark.vercel.app` and API `soft-spark-api.vercel.app` are different sites (`vercel.app` is a public suffix — do **not** set cookie `Domain=.vercel.app`). The API sets host-only session cookies with `SameSite=None; Secure` in production so credentialed `fetch(..., { credentials: "include" })` can store them. Keep `BETTER_AUTH_URL=https://soft-spark-api.vercel.app` (API public origin, no trailing slash).

Venues (**$0 go-live**, Vercel API) — pick **one**:

- `ALLOW_VENUE_SEED=1` **or** `VENUE_MODE=seed` — Denver catalog (no Places key)
- later: `GOOGLE_PLACES_API_KEY` with seed **unset** / not `VENUE_MODE=seed`

Match engine (default stub — no OpenAI spend):

- `MATCH_ENGINE_MODE=stub` (default / rollback; omit or set explicitly)

Web (Vercel **web** project):

- `NEXT_PUBLIC_API_URL` — web → API (`https://soft-spark-api.vercel.app`)

Push (status-only A; stubbed until set):

- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` — web push
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — same public key for the browser
- `EXPO_ACCESS_TOKEN` — optional Expo push auth

LLM soak (optional; stub fallback if missing). **Rollback = `MATCH_ENGINE_MODE=stub`** (no code change; ignores a present key):

- `MATCH_ENGINE_MODE=llm`
- `OPENAI_API_KEY`
- `OPENAI_BASE_URL` / `OPENAI_MODEL` optional

Copy `.env.example` locally. Set the same names in Vercel / Fly / Render dashboards.

**Blockers for a live URL from this PR:** redeploy the **API** project after merge so `POST /auth/sign-up/email` returns HTTP (200/4xx) instead of hanging. `/health` stays JSON without booting on GET. Workspace packages ship `dist/` JS; the Hobby function entry is `apps/api/api/index.ts`.

**Postgres schema (Neon):** the API already runs `CREATE TABLE IF NOT EXISTS` for Better Auth + app tables on boot (`applySchema`). Live Hobby already has `DATABASE_URL` (see `/health` → `env.database: true`) — **do not invent or commit it**. If you provision a **new** empty database, either let the first function boot apply DDL, or from a machine that has the host `DATABASE_URL` (use the **direct** Neon URL, not the `-pooler` URL):

```bash
# optional; boot DDL is enough for Hobby
pnpm --filter @soft-spark/db exec drizzle-kit push
```

## Env vars

| Variable | Required | Notes |
|----------|----------|--------|
| `DATABASE_URL` | **prod boot** | `postgres://…`. If unset locally, API uses **PGlite** at `PGLITE_DATA_DIR` (default `.data/pglite`). |
| `PGLITE_DATA_DIR` | no | File-backed PGlite when `DATABASE_URL` is not Postgres. |
| `BETTER_AUTH_SECRET` | **prod boot** | Auth signing secret (`AUTH_SECRET` alias). Dev default is rejected in production. |
| `BETTER_AUTH_URL` | prod | Public API origin, default `http://localhost:8787`. |
| `AUTH_MODE` | no | `prod` disables `x-user-id` bypass (also off when `NODE_ENV=production`). |
| `WEB_ORIGIN` | prod | Exact web origin(s) for CORS + Better Auth `trustedOrigins`. No trailing slash. Comma-separated if needed. Live: `https://soft-spark.vercel.app`. |
| `GOOGLE_PLACES_API_KEY` | prod Places | Nearby search when seed is **not** forced. 0 results → `exploring` + `match.venue_unavailable`. |
| `ALLOW_VENUE_SEED` | $0 venues | `1` allows Denver catalog seed **and** catalog VenueSuggester in production (no Places key). |
| `VENUE_MODE` | $0 venues | `seed` same as `ALLOW_VENUE_SEED=1`. Forced seed wins over a present Places key. Unset + key → `places`. |
| `MATCH_ENGINE_MODE` | always | `stub` (default / **rollback**) or `llm`. Stub never calls OpenAI even if a key is set. Mode=`llm` without `OPENAI_API_KEY` forces stub + log. |
| `OPENAI_API_KEY` | llm | Chat Completions for `ConversationRunner` + optional chemistry judge. |
| `OPENAI_BASE_URL` / `OPENAI_MODEL` | no | OpenAI-compatible override. |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | web push | Status-only payloads (`invite.sent`, `invite_ready`, `invite.accepted\|declined`, band updates). No transcripts. |
| `EXPO_ACCESS_TOKEN` | no | Optional bearer for Expo push API. |
| `PARTYKIT_HOST` | no | e.g. `http://127.0.0.1:1999`. API also fans out over SSE `GET /realtime/stream`. |
| `PARTYKIT_TOKEN` | no | Optional bearer when publishing to Partykit. |
| `NEXT_PUBLIC_API_URL` | web | Default `http://localhost:8787`. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | web push | Browser subscribe key. |
| `EXPO_PUBLIC_API_URL` | Expo | Default `http://localhost:8787`. |

Logo (Ember, locked Aura pack): `apps/web/public/brand/` and `apps/mobile/assets/brand/`. Prefer PNG wordmark over SVG. Tokens: `packages/ui/src/tokens.ts`.

## API

Protected routes (`/users/me/*`, `/matches*`, `/realtime/*`) require a Better Auth session (cookie or `Authorization: Bearer`). Unauthenticated → **401**.

| Method | Path | Notes |
|--------|------|--------|
| GET | `/health` | `{ ok, venues: "seed"\|"places", matchEngine, env: { database, authSecret, places, llm, webPush } }` — no secrets |
| GET | `/push/vapid-public` | `{ configured, publicKey }` for web push subscribe |
| POST/GET | `/auth/*` | Better Auth |
| POST | `/users/me/onboard` | Session required. `botDatingOptIn: true` else **400**. Optional `photoUrl` |
| GET | `/users/me` | Profile; **404** `profile_incomplete` if signed-in with no onboard |
| PATCH | `/users/me` | Partial profile / prefs / geo / photoUrl |
| GET/PATCH | `/users/me/bot` | `vibeTags`, `paused` |
| POST/GET | `/users/me/push` | Register web PushSubscription or Expo token |
| GET | `/matches` | `{ id, state, band, updatedAt, peer, reasons }` — **no confidence** |
| GET | `/matches/:id` | + invite summary / `VenueCard` (km in payload; UI shows **miles**) |
| POST | `/matches/:id/invites/:inviteId/accept` | Idempotent; both accept → `booked` |
| POST | `/matches/:id/invites/:inviteId/decline` | Idempotent; either decline → `declined` |
| GET | `/realtime/stream` | SSE: band + DualStatusRow events. No transcripts |
| POST | `/internal/orchestrate` | Demo job: `{ userAId, userBId, emptyVenues? }` |
| GET | `/internal/events` | Forge event log |

## Orchestration

1. Hard filter (mutual `interestedIn`/gender, dealbreakers, travel overlap) → Match `exploring`
2. Bot turns (`bot.turn.requested` / `completed`) within 10 turns / 12 min; **paused** bots are skipped. LLM failure → stub persona + `bot.turn.fallback`
3. Chemistry dims from the **private** transcript (heuristic; LLM judge when `MATCH_ENGINE_MODE=llm` + key). Clients never see `messages[]`.
4. `MatchScorer.score` → `match.score.updated` (internal confidence; clients get **band**). Push on band updates.
5. If confidence ≥ **0.75** (`invite_threshold`, frozen) and safety ok → `suggestVenue`
   - ≥1 candidate → `invite_ready` → dual invite → `invited` + `invite.sent` (push both users)
   - 0 candidates → stay `exploring` + `match.venue_unavailable`
6. Safety fail → archive + `match.safety_failed`

Event names match `forge-contract-v0.md`. Scoring weights stay `0.35 / 0.45 / 0.20`. `invite_threshold = 0.75`.

## LLM soak + regression (Nexus checklist)

`pnpm soak` / `pnpm demo` on **stub** (default). `MATCH_ENGINE_MODE=llm pnpm soak` when a key is present; CI skips live completions without inventing one.

| Scenario | Assert |
|----------|--------|
| Happy path | Overlapping Denver profiles → `invited`/`booked`; ≤2 snake_case reasons; **no** client `confidence` / `messages[]` / transcript |
| Intent soft mismatch | relationship vs casual still possible; `intent_mismatch` may appear; not a hard filter |
| `venue_unavailable` | score ≥0.75 but 0 places → stay `exploring` + `match.venue_unavailable` |
| Safety fail | inject harassment / sexual_pressure / pii_dump → `match.safety_failed` + archived; no invite |
| Paused bot | one paused → other can turn; both paused → stop |
| LLM down | mode=`llm` with bad key → phase/persona fallback + safety check; match does not crash |
| Early low-fit | weak chemistry+profileFit after turn 4 → archive `low_fit_early_exit` |
| Rollback | `MATCH_ENGINE_MODE=stub` never calls OpenAI even if `OPENAI_API_KEY` is set |

Regression gates: client DTOs are state + band + reasons + invite only; internal events still include turn text; `canEnterInviteReady` requires ≥1 venue; invite window Fri–Sun 18:00–20:00; chemistry from transcript (not forced `HAPPY_PATH_DIMS`); safety gate before persist on every turn; persona turns must not drift `invite_threshold` 0.75.

Spike in safety_fail or fallback after deploy → stay on stub.
