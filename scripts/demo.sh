#!/usr/bin/env bash
# HTTP demo: two users → booked. Requires API at $API_URL (default localhost:8787).
set -euo pipefail
API="${API_URL:-http://localhost:8787}"

echo "== Soft spark HTTP demo against $API"

code=$(curl -s -o /tmp/ss-noopt.json -w "%{http_code}" -X POST "$API/users/me/onboard" \
  -H 'content-type: application/json' \
  -d '{"botDatingOptIn":false,"profile":{"displayName":"No","age":30,"gender":"woman","interestedIn":["man"]},"prefs":{"cuisine":["italian"],"budget":3,"maxTravelKm":20,"dealbreakers":[]},"homeGeo":{"lat":39.7,"lng":-105}}')
test "$code" = "400"
echo "ok  missing opt-in → 400"

maya=$(curl -s -X POST "$API/users/me/onboard" -H 'content-type: application/json' -d '{
  "botDatingOptIn": true,
  "profile": {"displayName":"Maya","age":29,"gender":"woman","interestedIn":["man"]},
  "prefs": {"cuisine":["italian","american"],"budget":3,"maxTravelKm":25,"dealbreakers":[],"lookingFor":"relationship","interests":["food","hiking"]},
  "homeGeo": {"lat":39.739,"lng":-104.979},
  "homeTz": "America/Denver",
  "vibeTags": ["Curious","Soft"]
}')
jordan=$(curl -s -X POST "$API/users/me/onboard" -H 'content-type: application/json' -d '{
  "botDatingOptIn": true,
  "profile": {"displayName":"Jordan","age":31,"gender":"man","interestedIn":["woman"]},
  "prefs": {"cuisine":["italian","american"],"budget":3,"maxTravelKm":20,"dealbreakers":[],"lookingFor":"relationship","interests":["food","hiking"]},
  "homeGeo": {"lat":39.759,"lng":-104.999},
  "homeTz": "America/Denver",
  "vibeTags": ["Curious","Witty"]
}')

MAYA_ID=$(node -e "console.log(JSON.parse(process.argv[1]).user.id)" "$maya")
JORDAN_ID=$(node -e "console.log(JSON.parse(process.argv[1]).user.id)" "$jordan")
echo "ok  onboard Maya=$MAYA_ID Jordan=$JORDAN_ID"

job=$(curl -s -X POST "$API/internal/orchestrate" -H 'content-type: application/json' \
  -d "{\"userAId\":\"$MAYA_ID\",\"userBId\":\"$JORDAN_ID\"}")
MATCH_ID=$(node -e "console.log(JSON.parse(process.argv[1]).matchId)" "$job")
STATE=$(node -e "console.log(JSON.parse(process.argv[1]).state)" "$job")
echo "ok  orchestrate match=$MATCH_ID state=$STATE"

matches=$(curl -s "$API/matches" -H "x-user-id: $MAYA_ID")
node -e 'const m=JSON.parse(process.argv[1]); if ("confidence" in m[0]) process.exit(1); console.log("ok  GET /matches band="+m[0].band+" state="+m[0].state)' "$matches"

detail=$(curl -s "$API/matches/$MATCH_ID" -H "x-user-id: $MAYA_ID")
INVITE_ID=$(node -e "console.log(JSON.parse(process.argv[1]).invite.id)" "$detail")

curl -s -X POST "$API/matches/$MATCH_ID/invites/$INVITE_ID/accept" -H "x-user-id: $MAYA_ID" >/dev/null
booked=$(curl -s -X POST "$API/matches/$MATCH_ID/invites/$INVITE_ID/accept" -H "x-user-id: $JORDAN_ID")
node -e 'const m=JSON.parse(process.argv[1]); if (m.state!=="booked") process.exit(1); console.log("ok  dual accept → booked")' "$booked"

echo "Slice 1 HTTP demo complete."
