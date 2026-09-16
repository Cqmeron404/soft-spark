# Soft spark

AI dating bots explore compatibility; when confidence clears the threshold, both people get the same mid-point restaurant invite. Slice 2: Auth → Postgres → Realtime → real venues → Nexus personas.

Clients see **state + confidence band + invite card** only. Raw scores, `messages[]`, and bot transcripts stay internal. Realtime is **band/invite events only** (not chat). InviteCard distances are **miles**.

## Stack

| Path | Role |
|------|------|
| `apps/web` | Next.js — thin auth, onboard (+ photo), matches, reveal, invite |
| `apps/mobile` | Expo — same screens beyond the Slice 1 shell |
| `apps/api` | Hono — Better Auth, Drizzle store, SSE realtime, match job |
| `apps/realtime` | Partykit party (`match` rooms) for band/invite fan-out |
| `packages/db` | Drizzle schema + Postgres / PGlite + seed |
| `packages/shared` | `MatchState`, bands, events, client DTOs, miles helpers |
| `packages/match-engine` | Nexus interfaces + stub/LLM runners + midpoint venues |
| `packages/ui` | Soft spark tokens / `BandChip` / `SignalLine` / `InviteCard` |

## Quick start

```bash
pnpm install
pnpm typecheck
pnpm build
pnpm seed    # venue catalog (PGlite file at .data/pglite unless DATABASE_URL is set)
pnpm demo
```

`pnpm demo` signs up two Denver users (Maya, Jordan) via Better Auth, onboards, runs hard-filter → persona bot turns → transcript-derived chemistry → midpoint venues → dual accept, and asserts **booked**. It also checks 401s, paused bots, client payloads without `confidence` / transcripts / `messages[]`, `match.venue_unavailable` keeping `exploring`, realtime invite events, and restart survival.

### HTTP demo

```bash
pnpm dev:api          # http://localhost:8787
bash scripts/demo.sh  # curl: sign-up → onboard → booked
```

Web (API must be running):

```bash
pnpm dev:web          # http://localhost:3000
```

Signed-out → `/signin`. Signed-in without a dating profile → `/onboard`. Else `/matches`. Optional Partykit: `pnpm dev:realtime` then set `PARTYKIT_HOST`.

## Env vars

| Variable | Required | Notes |
|----------|----------|--------|
| `DATABASE_URL` | prod | `postgres://…` for Postgres. If unset, API uses **PGlite** at `PGLITE_DATA_DIR` (default `.data/pglite`) so data survives restart without Docker. |
| `PGLITE_DATA_DIR` | no | File-backed PGlite directory when `DATABASE_URL` is not a Postgres URL. |
| `BETTER_AUTH_SECRET` | prod | Auth signing secret (`AUTH_SECRET` alias). Dev default is insecure — set in prod. |
| `BETTER_AUTH_URL` | no | Public API origin, default `http://localhost:8787`. |
| `AUTH_MODE` | no | `prod` disables the Slice 1 `x-user-id` bypass (also off when `NODE_ENV=production`). `dev` allows `x-user-id` only as a last resort. |
| `WEB_ORIGIN` | no | CORS / Better Auth trusted origin, default `http://localhost:3000`. |
| `MATCH_ENGINE_MODE` | no | `stub` (default) or `llm`. LLM path is used only when mode is `llm` **and** `OPENAI_API_KEY` is set; otherwise stub personas + heuristic dims. |
| `OPENAI_API_KEY` | llm | Chat Completions for `ConversationRunner` + optional chemistry judge. |
| `OPENAI_BASE_URL` / `OPENAI_MODEL` | no | OpenAI-compatible override. |
| `GOOGLE_PLACES_API_KEY` | no | Real nearby search. Without it, `VenueSuggester` uses the seeded Denver catalog + haversine mid-point filters. |
| `PARTYKIT_HOST` | no | e.g. `http://127.0.0.1:1999`. API also pushes band/invite events over SSE at `GET /realtime/stream`. |
| `PARTYKIT_TOKEN` | no | Optional bearer when publishing to Partykit. |
| `NEXT_PUBLIC_API_URL` | no | Web, default `http://localhost:8787`. |
| `EXPO_PUBLIC_API_URL` | no | Expo, default `http://localhost:8787`. |

Copy to `.env` locally (gitignored). Logo SVG/PNG slots: `apps/web/public/brand/` and `apps/mobile/assets/brand/` — Aura can replace files without blocking eng. Tokens: `packages/ui/src/tokens.ts`.

## API

Protected routes (`/users/me/*`, `/matches*`, `/realtime/*`) require a Better Auth session (cookie or `Authorization: Bearer`). Unauthenticated → **401**.

| Method | Path | Notes |
|--------|------|--------|
| POST/GET | `/auth/*` | Better Auth (`/auth/sign-up/email`, `/auth/sign-in/email`, `/auth/get-session`, `/auth/sign-out`) |
| POST | `/users/me/onboard` | Session required. `botDatingOptIn: true` else **400**. Creates User + DatingBot |
| GET | `/users/me` | Profile; **404** `profile_incomplete` if signed-in with no onboard |
| PATCH | `/users/me` | Partial profile / prefs / geo / photoUrl |
| GET/PATCH | `/users/me/bot` | `vibeTags`, `paused` |
| GET | `/matches` | `{ id, state, band, updatedAt, peer, reasons }` — **no confidence** |
| GET | `/matches/:id` | + invite summary / `VenueCard` (km in payload; UI shows **miles**) |
| POST | `/matches/:id/invites/:inviteId/accept` | Idempotent; both accept → `booked` |
| POST | `/matches/:id/invites/:inviteId/decline` | Idempotent; either decline → `declined` |
| GET | `/realtime/stream` | SSE: `match.score.updated`, invite DualStatusRow events. No transcripts |
| POST | `/internal/orchestrate` | Demo job: `{ userAId, userBId, emptyVenues? }` |
| GET | `/internal/events` | Forge event log |

## Orchestration

1. Hard filter (mutual `interestedIn`/gender, dealbreakers, travel overlap) → Match `exploring`
2. Bot turns (`bot.turn.requested` / `completed`) within 10 turns / 12 min; **paused** bots are skipped
3. Chemistry dims from transcript (heuristic, or LLM judge when `MATCH_ENGINE_MODE=llm`)
4. `MatchScorer.score` → `match.score.updated` (internal confidence; clients get band)
5. If confidence ≥ 0.75 and safety ok → `suggestVenue` (mid-point ∩ travel ∩ cuisine ∩ budget, ≤3)
   - ≥1 candidate → `invite_ready` → dual invite → `invited` + `invite.sent`
   - 0 candidates → stay `exploring` + `match.venue_unavailable`
6. Safety fail → archive + `match.safety_failed`

Event names match `forge-contract-v0.md`. Scoring weights stay `0.35 / 0.45 / 0.20`. `invite_threshold = 0.75`.
