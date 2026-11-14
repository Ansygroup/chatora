#!/usr/bin/env bash
# ============================================================================
# Chatora — build, verify and (only with an explicit opt-in) publish the site.
#
# Safe default: builds and checks locally, performs NO network calls and makes
# NO release.
#
# Hosting model: the built files are deployed to Vercel as a plain static site
# from the repository root. vercel.json supplies the headers (CSP, caching) and
# .vercelignore keeps every source/tooling/server directory out of the upload.
# The previous model (a Vercel function proxying a public Supabase Storage
# bucket, see _deploy/preview/) made every page depend on a second service and
# is no longer used.
#
#   _tools/deploy.sh                                   build + verify only
#   ALLOW_VERCEL_PRODUCTION_DEPLOY=YES VERCEL_TOKEN=…  _tools/deploy.sh
#   ALLOW_VERCEL_PREVIEW_DEPLOY=YES    VERCEL_TOKEN=…  _tools/deploy.sh
# ============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PY="${PYTHON:-python3}"
ALLOW_PROD="${ALLOW_VERCEL_PRODUCTION_DEPLOY:-NO}"
ALLOW_PREVIEW="${ALLOW_VERCEL_PREVIEW_DEPLOY:-NO}"

echo "▶ 1/4  Checking build dependencies"
if ! "$PY" -c "import bs4" >/dev/null 2>&1; then
  echo "✗ Python package beautifulsoup4 is missing. Run: $PY -m pip install -r _tools/requirements.txt"
  exit 2
fi
if ! command -v node >/dev/null 2>&1; then
  echo "✗ Node.js (>= 20) is required: the builders evaluate the i18n dictionaries with it."
  exit 2
fi

echo "▶ 2/4  Building all six languages"
"$PY" _tools/build.py

echo "▶ 3/4  Verifying the build"
"$PY" _tools/linkcheck.py
for lang in "" ar es fr de pt; do
  dir="./${lang}"
  count="$(find "$dir" -maxdepth 1 -type f -name '*.html' | wc -l | tr -d ' ')"
  if (( count < 28 )); then
    echo "✗ Expected 28 HTML pages in ${dir}, found ${count}. Refusing to publish a partial site."
    exit 1
  fi
done
for private in _pages _partials _tools _deploy docs mcp supabase .github; do
  if ! grep -qx "/${private}" .vercelignore; then
    echo "✗ /${private} is not listed in .vercelignore. Refusing to publish private files."
    exit 1
  fi
done
for test_file in assets/js/*.smoke_test.mjs supabase/functions/*/smoke_test.mjs; do
  node "$test_file" >/dev/null
done
echo "   Links, page counts, private-path guard and smoke tests passed."

if [[ "$ALLOW_PROD" != "YES" && "$ALLOW_PREVIEW" != "YES" ]]; then
  echo "▶ 4/4  Deploy skipped (set ALLOW_VERCEL_PREVIEW_DEPLOY=YES or ALLOW_VERCEL_PRODUCTION_DEPLOY=YES after explicit release approval)."
  echo "✔ Local build verified. Nothing was published."
  exit 0
fi

if [[ -z "${VERCEL_TOKEN:-}" ]]; then
  echo "✗ VERCEL_TOKEN is required for an explicitly approved deploy."
  exit 2
fi
if command -v vercel >/dev/null 2>&1; then VERCEL=(vercel); else VERCEL=(npx --yes vercel@latest); fi

if [[ "$ALLOW_PROD" == "YES" ]]; then
  echo "▶ 4/4  Deploying Vercel Production (explicit opt-in provided)"
  "${VERCEL[@]}" deploy --prod --yes --token "$VERCEL_TOKEN" --cwd "$ROOT"
else
  echo "▶ 4/4  Deploying a Vercel Preview (explicit opt-in provided)"
  "${VERCEL[@]}" deploy --yes --token "$VERCEL_TOKEN" --cwd "$ROOT"
fi
echo "✔ Deploy finished."
