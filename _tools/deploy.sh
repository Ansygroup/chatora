#!/usr/bin/env bash
# ============================================================================
# Chatora — build and (only with two explicit opt-ins) publish the site.
#
# Safe default: builds locally, performs NO network calls and makes NO release.
# Supabase Storage upload changes the public site content; Vercel deploy changes
# Production. These actions require separate explicit approvals below.
# ============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SUPABASE_URL="${SUPABASE_URL:-https://sytogavpspwgjadorprn.supabase.co}"
BUCKET="${BUCKET:-site}"
SR="${SUPABASE_SERVICE_ROLE:-}"
ALLOW_UPLOAD="${ALLOW_SUPABASE_UPLOAD:-NO}"
ALLOW_PROD="${ALLOW_VERCEL_PRODUCTION_DEPLOY:-NO}"

if [[ "$ALLOW_PROD" == "YES" && "$ALLOW_UPLOAD" != "YES" ]]; then
  echo "✗ Production deploy requires ALLOW_SUPABASE_UPLOAD=YES too: the Vercel adapter serves the public Storage bucket."
  exit 2
fi

echo "▶ 1/3  Building pages locally"
python3 _tools/build.py

if [[ "$ALLOW_UPLOAD" != "YES" ]]; then
  echo "▶ 2/3  Supabase Storage upload skipped (set ALLOW_SUPABASE_UPLOAD=YES only after explicit release approval)."
else
  if [[ -z "$SR" ]]; then
    echo "✗ SUPABASE_SERVICE_ROLE is required for an explicitly approved Storage upload."
    exit 2
  fi
  if [[ "$SUPABASE_URL" != https://* ]]; then
    echo "✗ Refusing Storage upload to a non-HTTPS SUPABASE_URL."
    exit 2
  fi

  echo "▶ 2/3  Uploading approved site files to public Storage bucket: $BUCKET"
  response_file="$(mktemp)"
  file_list="$(mktemp)"
  trap 'rm -f "$response_file" "$file_list"' EXIT

  if ! bucket_status="$(curl --silent --show-error --output "$response_file" --write-out "%{http_code}" \
      -X POST "$SUPABASE_URL/storage/v1/bucket" \
      -H "Authorization: Bearer $SR" -H "apikey: $SR" -H "Content-Type: application/json" \
      -d "{\"id\":\"$BUCKET\",\"name\":\"$BUCKET\",\"public\":true,\"file_size_limit\":5242880}")"; then
    echo "✗ Could not create/check the Storage bucket. No files were uploaded."
    exit 1
  fi
  case "$bucket_status" in
    200|201) echo "   Bucket created." ;;
    409) echo "   Bucket already exists." ;;
    *) echo "✗ Bucket request returned HTTP $bucket_status. No files were uploaded."; exit 1 ;;
  esac

  find . -type f \( \
      -name '*.html' -o -name '*.css' -o -name '*.js' -o -name '*.svg' \
      -o -name '*.jpg' -o -name '*.jpeg' -o -name '*.png' -o -name '*.webp' \
      -o -name '*.woff' -o -name '*.woff2' -o -name '*.jsonld' -o -name '*.xml' \
      -o -name '*.txt' -o -name '*.ico' \
    \) \
    -not -path './_pages/*' -not -path './_partials/*' -not -path './_tools/*' \
    -not -path './_deploy/*' -not -path './docs/*' -not -path './supabase/*' \
    -print0 | sort -z > "$file_list"

  failures=0
  uploaded=0
  while IFS= read -r -d '' file; do
    rel="${file#./}"
    case "${rel##*.}" in
      html) content_type='text/html; charset=utf-8' ;;
      css) content_type='text/css; charset=utf-8' ;;
      js) content_type='text/javascript; charset=utf-8' ;;
      svg) content_type='image/svg+xml' ;;
      jpg|jpeg) content_type='image/jpeg' ;;
      png) content_type='image/png' ;;
      webp) content_type='image/webp' ;;
      woff) content_type='font/woff' ;;
      woff2) content_type='font/woff2' ;;
      jsonld) content_type='application/ld+json' ;;
      xml) content_type='application/xml; charset=utf-8' ;;
      txt) content_type='text/plain; charset=utf-8' ;;
      ico) content_type='image/x-icon' ;;
      *) content_type='application/octet-stream' ;;
    esac

    if ! status="$(curl --silent --show-error --output "$response_file" --write-out "%{http_code}" \
        -X POST "$SUPABASE_URL/storage/v1/object/$BUCKET/$rel" \
        -H "Authorization: Bearer $SR" -H "apikey: $SR" -H "x-upsert: true" \
        -H "cache-control: 3600" -H "Content-Type: $content_type" \
        --data-binary "@$file")"; then
      echo "   ✗ network error: $rel"
      failures=$((failures + 1))
      continue
    fi
    case "$status" in
      200|201) uploaded=$((uploaded + 1)) ;;
      *) echo "   ✗ HTTP $status: $rel"; failures=$((failures + 1)) ;;
    esac
  done < "$file_list"

  en_pages="$(find . -maxdepth 1 -type f -name '*.html' | wc -l | tr -d ' ')"
  ar_pages="$(find ./ar -maxdepth 1 -type f -name '*.html' | wc -l | tr -d ' ')"
  es_pages="$(find ./es -maxdepth 1 -type f -name '*.html' | wc -l | tr -d ' ')"
  fr_pages="$(find ./fr -maxdepth 1 -type f -name '*.html' | wc -l | tr -d ' ')"
  de_pages="$(find ./de -maxdepth 1 -type f -name '*.html' | wc -l | tr -d ' ')"
  pt_pages="$(find ./pt -maxdepth 1 -type f -name '*.html' | wc -l | tr -d ' ')"
  echo "   Uploaded: $uploaded files · built HTML: EN=$en_pages AR=$ar_pages ES=$es_pages FR=$fr_pages DE=$de_pages PT=$pt_pages · errors: $failures"
  if (( failures > 0 )); then
    echo "✗ Upload incomplete. Production deploy will not run; review the failed object list above."
    exit 1
  fi
fi

if [[ "$ALLOW_PROD" != "YES" ]]; then
  echo "▶ 3/3  Vercel Production deploy skipped (set ALLOW_VERCEL_PRODUCTION_DEPLOY=YES only after explicit release approval)."
else
  if ! command -v vercel >/dev/null 2>&1 || [[ -z "${VERCEL_TOKEN:-}" ]]; then
    echo "✗ Vercel CLI and VERCEL_TOKEN are required for an explicitly approved Production deploy."
    exit 2
  fi
  echo "▶ 3/3  Deploying Vercel Production (explicit opt-in provided)"
  vercel deploy --prod --yes --token "$VERCEL_TOKEN" --cwd _deploy/preview
fi

echo "✔ Local build complete. Any publish actions above required their separate explicit opt-ins."
