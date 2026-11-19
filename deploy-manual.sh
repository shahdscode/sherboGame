#!/usr/bin/env bash

set -Eeuo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_ROOT="/var/www/sherbogame"
PUBLIC_URL="http://187.77.71.97:3201/"

if [[ $EUID -eq 0 ]]; then
  PRIVILEGED=()
elif command -v sudo >/dev/null 2>&1; then
  PRIVILEGED=(sudo)
else
  echo "Run this script as root or install sudo."
  exit 1
fi

cd "$PROJECT_DIR"

if [[ ! -f .env ]] || ! grep -qE '^VITE_API_URL=https?://.+/api/v1/?$' .env; then
  echo "VITE_API_URL must be an HTTP(S) /api/v1 endpoint in .env"
  exit 1
fi

echo "Installing dependencies..."
npm ci --no-audit --no-fund

echo "Running tests..."
npm test

echo "Building production files..."
npm run build

release_id="$(date -u +%Y%m%d%H%M%S)-$(git rev-parse --short=8 HEAD)"
release_dir="$WEB_ROOT/releases/$release_id"
next_link="$WEB_ROOT/.current-$release_id"

echo "Publishing release $release_id..."
"${PRIVILEGED[@]}" mkdir -p "$release_dir"
"${PRIVILEGED[@]}" rsync -a --delete --delay-updates dist/ "$release_dir/"
"${PRIVILEGED[@]}" test -s "$release_dir/index.html"
"${PRIVILEGED[@]}" ln -sfn "releases/$release_id" "$next_link"
"${PRIVILEGED[@]}" mv -Tf "$next_link" "$WEB_ROOT/current"

curl --fail --silent --show-error "$PUBLIC_URL" >/dev/null

echo "Deployment complete: $PUBLIC_URL"
echo "Active release: $release_id"
