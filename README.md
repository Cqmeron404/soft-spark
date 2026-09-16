# Soft spark

AI dating bots explore compatibility; when confidence clears the threshold, both people get the same mid-point restaurant invite. Slice 1 scaffold for [Cqmeron404/soft-spark](https://github.com/Cqmeron404/soft-spark).

Clients see **state + confidence band + invite card** only. Raw scores and bot transcripts stay internal.

## Stack

| Path | Role |
|------|------|
| `apps/web` | Next.js App Router — onboard, matches, reveal, invite |
| `apps/mobile` | Expo shell with the same routes stubbed |
| `apps/api` | Hono — Slice 1 REST + in-process match job |
| `packages/db` | Drizzle + Postgres schema |
| `packages/shared` | `MatchState`, `ConfidenceBand`, events, client DTOs |
| `packages/match-engine` | Nexus interfaces + stubs (wired to `match-logic-v0`) |
| `packages/ui` | Soft spark tokens / `BandChip` / `SignalLine` / `InviteCard` |

## Quick start

```bash
pnpm install
pnpm typecheck
pnpm build
pnpm demo
```

`pnpm demo` onboards two Denver users (Maya, Jordan), runs hard-filter → bot turns → score → venue → dual accept, and asserts **booked**. It also checks opt-in `400`, client payloads without `confidence`, and `match.venue_unavailable` keeping `exploring`.

### HTTP demo

```bash
pnpm dev:api          # http://localhost:8787
bash scripts/demo.sh  # curl: two users → booked
```

Web (API must be running):

```bash
pnpm dev:web          # http://localhost:3000
```

On `/onboard`, use **Fill Maya** then **Fill Jordan** (switch users in the header), then **Run match job** on `/matches`. **Maybe later** only dismisses the reveal sheet; **Pass** is a hard decline.

## API (session stub)

Slice 1 auth is `x-user-id: <userId>` (or `Authorization: Bearer <userId>`). Better Auth can replace this later.

| Method | Path | Notes |
|--------|------|--------|
| POST | `/users/me/onboard` | Requires `botDatingOptIn: true` else **400**. Creates User + DatingBot |
| GET | `/users/me` | Profile + prefs + homeGeo |
| PATCH | `/users/me` | Partial profile / prefs / geo |
| GET/PATCH | `/users/me/bot` | `vibeTags`, `paused` |
| GET | `/matches` | `{ id, state, band, updatedAt, peer, reasons }` — **no confidence** |
| GET | `/matches/:id` | + invite summary / `VenueCard` |
| POST | `/matches/:id/invites/:inviteId/accept` | Idempotent; both accept → `booked` |
| POST | `/matches/:id/invites/:inviteId/decline` | Idempotent; either decline → `declined` |
| POST | `/internal/orchestrate` | Demo job: `{ userAId, userBId, emptyVenues? }` |
| GET | `/internal/events` | Forge event log |

## Orchestration

1. Hard filter (mutual `interestedIn`/gender, dealbreakers, travel overlap) → Match `exploring`
2. Bot turns (`bot.turn.requested` / `completed`) within 10 turns / 12 min; pause skips that bot
3. `MatchScorer.score` → `match.score.updated` (internal confidence)
4. If confidence ≥ 0.75 and safety ok → `suggestVenue`
   - ≥1 candidate → `invite_ready` → dual invite → `invited` + `invite.sent`
   - 0 candidates → stay `exploring` + `match.venue_unavailable`
5. Safety fail → archive + `match.safety_failed`

Event names match `forge-contract-v0.md`. Stubs may force a happy-path chemistry so the demo reaches `invite_ready`; scoring still uses the frozen weights (`0.35 / 0.45 / 0.20`).

## Data

Postgres schema lives in `packages/db`. Slice 1 API uses an in-memory store so `pnpm demo` runs without Docker. Point `DATABASE_URL` at Postgres when wiring Drizzle.

Invite window for the demo: Fri–Sun **18:00–20:00** `America/Denver`.
