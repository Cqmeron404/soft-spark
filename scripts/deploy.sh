#!/usr/bin/env bash
# Deploy helpers. Does not invent secrets — fail if required prod env is missing.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

cmd="${1:-help}"

web_env=(
  NEXT_PUBLIC_API_URL
  NEXT_PUBLIC_VAPID_PUBLIC_KEY
)

api_env=(
  DATABASE_URL
  BETTER_AUTH_SECRET
  BETTER_AUTH_URL
  WEB_ORIGIN
  GOOGLE_PLACES_API_KEY
)

case "$cmd" in
  check)
    echo "== Prod env checklist (values not printed)"
    missing=0
    for v in "${api_env[@]}"; do
      if [ -z "${!v:-}" ]; then echo "MISSING  $v"; missing=1; else echo "set      $v"; fi
    done
    for v in "${web_env[@]}"; do
      if [ -z "${!v:-}" ]; then echo "MISSING  $v (web)"; missing=1; else echo "set      $v"; fi
    done
    echo "optional MATCH_ENGINE_MODE=${MATCH_ENGINE_MODE:-stub}"
    echo "optional OPENAI_API_KEY=$([ -n "${OPENAI_API_KEY:-}" ] && echo set || echo missing)"
    echo "optional VAPID_PUBLIC_KEY=$([ -n "${VAPID_PUBLIC_KEY:-}" ] && echo set || echo missing)"
    echo "optional VAPID_PRIVATE_KEY=$([ -n "${VAPID_PRIVATE_KEY:-}" ] && echo set || echo missing)"
    echo "optional EXPO_ACCESS_TOKEN=$([ -n "${EXPO_ACCESS_TOKEN:-}" ] && echo set || echo missing)"
    if [ "$missing" -ne 0 ]; then
      echo
      echo "Fill secrets in the host dashboard. See README production checklist."
      exit 1
    fi
    echo "ok  required prod env present"
    ;;
  web)
    echo "Deploy web: vercel --cwd apps/web --prod"
    echo "Or from repo root with Root Directory=apps/web in the Vercel project."
    echo "Required web env: NEXT_PUBLIC_API_URL NEXT_PUBLIC_VAPID_PUBLIC_KEY (optional until push go-live)"
    if command -v vercel >/dev/null 2>&1; then
      vercel --cwd apps/web --prod
    else
      echo "vercel CLI not installed. npm i -g vercel && vercel login"
      exit 1
    fi
    ;;
  api)
    echo "Preferred: docker build -f apps/api/Dockerfile -t soft-spark-api . && docker run --env-file .env -p 8787:8787 soft-spark-api"
    echo "Vercel alternative: vercel --cwd apps/api --prod  (SSE realtime is degraded on serverless)"
    if command -v vercel >/dev/null 2>&1; then
      vercel --cwd apps/api --prod
    else
      echo "Skipping live vercel — CLI missing. Use Docker/Fly/Render with apps/api/Dockerfile."
      exit 1
    fi
    ;;
  vapid)
    echo "Generate VAPID keys locally (do not commit):"
    echo "  npx web-push generate-vapid-keys"
    echo "Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT=mailto:you@example.com"
    echo "Mirror the public key to NEXT_PUBLIC_VAPID_PUBLIC_KEY / EXPO is not VAPID."
    ;;
  *)
    echo "Usage: bash scripts/deploy.sh [check|web|api|vapid]"
    echo "Live deploy needs host secrets; this script will not invent them."
    ;;
esac
