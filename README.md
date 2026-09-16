# Soft spark

AI dating bots explore compatibility; when confidence clears the threshold, both people get the same mid-point restaurant invite. Slice 3: deployable web, Places in prod, push (band/invite only), DualStatusRow + onboard photo polish, thin LLM soak.

Clients see **state + confidence band + invite card** only (frozen **A**). Raw scores, `messages[]`, and bot transcripts stay internal. Push and realtime are **band/invite events only** — never chat. InviteCard distances are **miles**. Ember mark + tagline **Your bot dates. You show up.**

## Stack

| Path | Role |
|------|------|
| `apps/web` | Next.js — Vercel config, auth, onboard (circle crop / initials skip), matches, reveal, invite DualStatusRow, web push |
| `apps/mobile` | Expo — DualStatusRow parity, photo step, Expo push token |
| `apps/api` | Hono — Better Auth, Drizzle, SSE, Places-backed VenueSuggester, status-only push, match job |
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
pnpm test    # invite_threshold soak + demo
```

`pnpm demo` signs up two Denver users (Maya, Jordan) via Better Auth, onboards (photoUrl), runs hard-filter → persona bot turns → transcript-derived chemistry → midpoint venues → dual accept, and asserts **booked**. It also checks prod boot/Places guards, 401s, paused bots, client payloads without `confidence` / transcripts / `messages[]`, `match.venue_unavailable` keeping `exploring`, realtime + push registration, DualStatusRow copy, LLM stub fallback, and restart survival.

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
| API | `apps/api/Dockerfile` (preferred) + `apps/api/vercel.json` | Long-lived Node for SSE + match jobs. Serverless Vercel is a fallback (`maxDuration` 60s; SSE degraded). |
| Checklist | `bash scripts/deploy.sh check` | Prints which required vars are missing (values never printed). |
| VAPID | `bash scripts/deploy.sh vapid` | `npx web-push generate-vapid-keys` — do not commit keys. |

**Boot (`NODE_ENV=production`)** refuses to start without `DATABASE_URL` (`postgres://…`) and `BETTER_AUTH_SECRET` (not the dev default). `/health` reports boolean env flags only.

### Prod go-live secrets (exact)

Required:

- `DATABASE_URL` — Postgres URL
- `BETTER_AUTH_SECRET` — 32+ char signing secret (`AUTH_SECRET` alias)
- `BETTER_AUTH_URL` — public API origin (`https://api.example.com`)
- `WEB_ORIGIN` — public web origin (`https://app.example.com`)
- `GOOGLE_PLACES_API_KEY` — **required in prod** behind `VenueSuggester` (seed catalog is local/demo only)
- `NEXT_PUBLIC_API_URL` — web → API

Push (status-only A; stubbed until set):

- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` — web push
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — same public key for the browser
- `EXPO_ACCESS_TOKEN` — optional Expo push auth

LLM soak (optional; stub fallback if missing):

- `MATCH_ENGINE_MODE=llm`
- `OPENAI_API_KEY`
- `OPENAI_BASE_URL` / `OPENAI_MODEL` optional

Copy `.env.example` locally. Set the same names in Vercel / Fly / Render dashboards.

**Blockers for a live URL from this PR:** no Vercel/Places/VAPID/OpenAI secrets in the agent environment, so no production URL is claimed here. After secrets exist: `bash scripts/deploy.sh check && bash scripts/deploy.sh web` and deploy API via Docker/`scripts/deploy.sh api`.

## Env vars

| Variable | Required | Notes |
|----------|----------|--------|
| `DATABASE_URL` | **prod boot** | `postgres://…`. If unset locally, API uses **PGlite** at `PGLITE_DATA_DIR` (default `.data/pglite`). |
| `PGLITE_DATA_DIR` | no | File-backed PGlite when `DATABASE_URL` is not Postgres. |
| `BETTER_AUTH_SECRET` | **prod boot** | Auth signing secret (`AUTH_SECRET` alias). Dev default is rejected in production. |
| `BETTER_AUTH_URL` | prod | Public API origin, default `http://localhost:8787`. |
| `AUTH_MODE` | no | `prod` disables `x-user-id` bypass (also off when `NODE_ENV=production`). |
| `WEB_ORIGIN` | prod | CORS / Better Auth trusted origin, default `http://localhost:3000`. |
| `GOOGLE_PLACES_API_KEY` | **prod VenueSuggester** | Nearby search. Local/demo uses seeded Denver catalog. 0 results → `exploring` + `match.venue_unavailable`. |
| `MATCH_ENGINE_MODE` | no | `stub` (default) or `llm`. Without `OPENAI_API_KEY`, LLM mode **stub-falls back**. |
| `OPENAI_API_KEY` | llm | Chat Completions for `ConversationRunner` + optional chemistry judge. |
| `OPENAI_BASE_URL` / `OPENAI_MODEL` | no | OpenAI-compatible override. |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | web push | Status-only payloads (`invite.sent`, `invite_ready`, `invite.accepted\|declined`, band updates). No transcripts. |
| `EXPO_ACCESS_TOKEN` | no | Optional bearer for Expo push API. |
| `PARTYKIT_HOST` | no | e.g. `http://127.0.0.1:1999`. API also fans out over SSE `GET /realtime/stream`. |
| `PARTYKIT_TOKEN` | no | Optional bearer when publishing to Partykit. |
| `NEXT_PUBLIC_API_URL` | web | Default `http://localhost:8787`. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | web push | Browser subscribe key. |
| `EXPO_PUBLIC_API_URL` | Expo | Default `http://localhost:8787`. |
| `ALLOW_VENUE_SEED` | no | Must be `1` to seed catalog when `NODE_ENV=production` (not for go-live). |

Logo (Ember, locked): `apps/web/public/brand/` and `apps/mobile/assets/brand/`. Tokens: `packages/ui/src/tokens.ts`.

## API

Protected routes (`/users/me/*`, `/matches*`, `/realtime/*`) require a Better Auth session (cookie or `Authorization: Bearer`). Unauthenticated → **401**.

| Method | Path | Notes |
|--------|------|--------|
| GET | `/health` | `{ ok, env: { database, authSecret, places, llm, webPush } }` — booleans only |
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
