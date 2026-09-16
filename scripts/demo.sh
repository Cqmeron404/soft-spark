#!/usr/bin/env bash
# HTTP demo against a running API. Uses maya-http@ / jordan-http@ so it does not
# collide with the public UI demo accounts (maya@ / jordan@ from DEMO_ACCOUNTS).
set -euo pipefail
API="${API_URL:-http://localhost:8787}"

echo "== Soft spark HTTP demo against $API"

code=$(curl -s -o /tmp/ss-unauth.json -w "%{http_code}" "$API/matches")
test "$code" = "401"
echo "ok  GET /matches without session → 401"

maya_auth=$(curl -s -D /tmp/ss-maya-hdr.txt -o /tmp/ss-maya-auth.json -X POST "$API/auth/sign-up/email" \
  -H 'content-type: application/json' \
  -d '{"email":"maya-http@softspark.dev","password":"spark-demo-maya","name":"Maya"}')
jordan_auth=$(curl -s -D /tmp/ss-jordan-hdr.txt -o /tmp/ss-jordan-auth.json -X POST "$API/auth/sign-up/email" \
  -H 'content-type: application/json' \
  -d '{"email":"jordan-http@softspark.dev","password":"spark-demo-jordan","name":"Jordan"}')

maya_cookie=$(awk -F': ' 'tolower($1)=="set-cookie"{print $2}' /tmp/ss-maya-hdr.txt | head -1 | cut -d';' -f1)
jordan_cookie=$(awk -F': ' 'tolower($1)=="set-cookie"{print $2}' /tmp/ss-jordan-hdr.txt | head -1 | cut -d';' -f1)
maya_token=$(node -e "const j=require('/tmp/ss-maya-auth.json'); console.log(j.token||'')")
jordan_token=$(node -e "const j=require('/tmp/ss-jordan-auth.json'); console.log(j.token||'')")

maya_h=(-H "cookie: $maya_cookie")
jordan_h=(-H "cookie: $jordan_cookie")
if [ -n "$maya_token" ]; then maya_h=(-H "authorization: Bearer $maya_token"); fi
if [ -n "$jordan_token" ]; then jordan_h=(-H "authorization: Bearer $jordan_token"); fi

echo "ok  Better Auth sign-up Maya + Jordan"

curl -s -o /tmp/ss-maya.json -X POST "$API/users/me/onboard" "${maya_h[@]}" -H 'content-type: application/json' -d '{
  "botDatingOptIn": true,
  "profile": {"displayName":"Maya","age":29,"gender":"woman","interestedIn":["man"]},
  "prefs": {"cuisine":["italian","american"],"budget":3,"maxTravelKm":25,"dealbreakers":[],"lookingFor":"relationship","interests":["food","hiking"]},
  "homeGeo": {"lat":39.739,"lng":-104.979},
  "homeTz": "America/Denver",
  "vibeTags": ["Curious","Soft"]
}'
curl -s -o /tmp/ss-jordan.json -X POST "$API/users/me/onboard" "${jordan_h[@]}" -H 'content-type: application/json' -d '{
  "botDatingOptIn": true,
  "profile": {"displayName":"Jordan","age":31,"gender":"man","interestedIn":["woman"]},
  "prefs": {"cuisine":["italian","american"],"budget":3,"maxTravelKm":20,"dealbreakers":[],"lookingFor":"relationship","interests":["food","hiking"]},
  "homeGeo": {"lat":39.759,"lng":-104.999},
  "homeTz": "America/Denver",
  "vibeTags": ["Curious","Witty"]
}'

MAYA_ID=$(node -e "console.log(JSON.parse(require('fs').readFileSync('/tmp/ss-maya.json','utf8')).user.id)")
JORDAN_ID=$(node -e "console.log(JSON.parse(require('fs').readFileSync('/tmp/ss-jordan.json','utf8')).user.id)")
echo "ok  onboard Maya=$MAYA_ID Jordan=$JORDAN_ID"

job=$(curl -s -X POST "$API/internal/orchestrate" -H 'content-type: application/json' \
  -d "{\"userAId\":\"$MAYA_ID\",\"userBId\":\"$JORDAN_ID\"}")
MATCH_ID=$(node -e "console.log(JSON.parse(process.argv[1]).matchId)" "$job")
STATE=$(node -e "console.log(JSON.parse(process.argv[1]).state)" "$job")
echo "ok  orchestrate match=$MATCH_ID state=$STATE"

matches=$(curl -s "$API/matches" "${maya_h[@]}")
node -e 'const m=JSON.parse(process.argv[1]); if ("confidence" in m[0]) process.exit(1); console.log("ok  GET /matches band="+m[0].band+" state="+m[0].state)' "$matches"

detail=$(curl -s "$API/matches/$MATCH_ID" "${maya_h[@]}")
INVITE_ID=$(node -e "console.log(JSON.parse(process.argv[1]).invite.id)" "$detail")

curl -s -X POST "$API/matches/$MATCH_ID/invites/$INVITE_ID/accept" "${maya_h[@]}" >/dev/null
booked=$(curl -s -X POST "$API/matches/$MATCH_ID/invites/$INVITE_ID/accept" "${jordan_h[@]}")
node -e 'const m=JSON.parse(process.argv[1]); if (m.state!=="booked") process.exit(1); console.log("ok  dual accept → booked")' "$booked"

echo "Slice 3 HTTP demo complete."
