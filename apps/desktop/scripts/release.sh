#!/usr/bin/env bash
# One-shot Weered desktop release.
#
# Usage:
#   ./scripts/release.sh                # build + sign at current version
#   ./scripts/release.sh --bump patch   # bump patch (0.1.2 → 0.1.3) + build + sign
#   ./scripts/release.sh --bump minor   # bump minor (0.1.x → 0.2.0)
#   ./scripts/release.sh --bump major   # bump major (0.x.x → 1.0.0)
#
# If GH_RELEASE_TOKEN is set in the environment, this also creates a release
# on Weeredjs/Weered-releases tagged desktop-v$VERSION and uploads the
# installer + .sig. Without the token it prints exact upload instructions.

set -euo pipefail

cd "$(dirname "$0")/.."

KEY_PATH="src-tauri/keys/weered_updater.key"
TAURI_CONF="src-tauri/tauri.conf.json"
CARGO_TOML="src-tauri/Cargo.toml"
RELEASE_REPO="${DESKTOP_RELEASES_REPO:-Weeredjs/Weered-releases}"

if [ ! -f "$KEY_PATH" ]; then
  echo "ERROR: signing key not found at $KEY_PATH"
  echo "  Either generate one (pnpm tauri signer generate -w $KEY_PATH -p '' --ci)"
  echo "  Or restore from droplet (scp root@142.93.148.29:/root/weered_updater.key $KEY_PATH)"
  exit 1
fi

# ── Version bump ─────────────────────────────────────────────────────────────
BUMP=""
if [ "${1:-}" = "--bump" ] && [ -n "${2:-}" ]; then
  BUMP="$2"
fi

CURRENT_VERSION=$(grep -E '"version"' "$TAURI_CONF" | head -1 | sed -E 's/.*"([0-9]+\.[0-9]+\.[0-9]+)".*/\1/')
if [ -z "$CURRENT_VERSION" ]; then
  echo "ERROR: could not read current version from $TAURI_CONF"
  exit 1
fi

if [ -n "$BUMP" ]; then
  IFS='.' read -r MAJ MIN PAT <<<"$CURRENT_VERSION"
  case "$BUMP" in
    patch) PAT=$((PAT + 1));;
    minor) MIN=$((MIN + 1)); PAT=0;;
    major) MAJ=$((MAJ + 1)); MIN=0; PAT=0;;
    *) echo "ERROR: --bump must be patch|minor|major"; exit 1;;
  esac
  NEW_VERSION="$MAJ.$MIN.$PAT"
  echo ">> Bumping $CURRENT_VERSION → $NEW_VERSION"
  # In-place edit (works on both BSD and GNU sed via temp file)
  sed -i.bak -E "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" "$TAURI_CONF"
  sed -i.bak -E "s/^version = \"$CURRENT_VERSION\"/version = \"$NEW_VERSION\"/" "$CARGO_TOML"
  rm -f "$TAURI_CONF.bak" "$CARGO_TOML.bak"
  VERSION="$NEW_VERSION"
else
  VERSION="$CURRENT_VERSION"
  echo ">> Building current version $VERSION (no bump)"
fi

# ── Build ────────────────────────────────────────────────────────────────────
export TAURI_SIGNING_PRIVATE_KEY="$(cat "$KEY_PATH")"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""

echo ">> Building (this takes 5-15 min on first run, ~2 min incremental)"
pnpm tauri build

NSIS="src-tauri/target/release/bundle/nsis/Weered_${VERSION}_x64-setup.exe"
MSI="src-tauri/target/release/bundle/msi/Weered_${VERSION}_x64_en-US.msi"

if [ ! -f "$NSIS" ]; then
  echo "ERROR: build did not produce $NSIS"
  exit 1
fi

# ── Sign (Tauri auto-signs when env vars are set, but defense-in-depth) ──────
echo ">> Signing artifacts"
pnpm tauri signer sign -f "$KEY_PATH" -p "" "$NSIS" 2>&1 | tail -5
if [ -f "$MSI" ]; then
  pnpm tauri signer sign -f "$KEY_PATH" -p "" "$MSI" 2>&1 | tail -5
fi

# ── Publish ──────────────────────────────────────────────────────────────────
TAG="desktop-v${VERSION}"

if [ -z "${GH_RELEASE_TOKEN:-}" ]; then
  echo ""
  echo "================================================================"
  echo "Build complete. Manual upload required (no GH_RELEASE_TOKEN set):"
  echo ""
  echo "  1. Go to: https://github.com/${RELEASE_REPO}/releases/new"
  echo "  2. Tag: $TAG"
  echo "  3. Title: Weered Desktop $VERSION"
  echo "  4. Upload BOTH of these files (and the .sig sibling for each):"
  echo "       $(pwd)/$NSIS"
  echo "       $(pwd)/${NSIS}.sig"
  if [ -f "$MSI" ]; then
    echo "       $(pwd)/$MSI"
    echo "       $(pwd)/${MSI}.sig"
  fi
  echo ""
  echo "  5. Click Publish. The API will pick it up within 5 min."
  echo "================================================================"
  exit 0
fi

echo ">> Creating GitHub release $TAG on $RELEASE_REPO"
RELEASE_JSON=$(curl -fsS \
  -X POST \
  -H "Authorization: Bearer $GH_RELEASE_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/${RELEASE_REPO}/releases" \
  -d "{\"tag_name\":\"$TAG\",\"name\":\"Weered Desktop $VERSION\",\"draft\":false,\"prerelease\":false}")

UPLOAD_URL=$(echo "$RELEASE_JSON" | sed -n 's/.*"upload_url": "\([^{]*\){.*/\1/p')
if [ -z "$UPLOAD_URL" ]; then
  echo "ERROR: failed to read upload_url from release response"
  echo "$RELEASE_JSON" | head -20
  exit 1
fi

upload() {
  local file="$1"
  local name="$(basename "$file")"
  echo ">>   uploading $name"
  curl -fsS \
    -X POST \
    -H "Authorization: Bearer $GH_RELEASE_TOKEN" \
    -H "Content-Type: application/octet-stream" \
    --data-binary @"$file" \
    "${UPLOAD_URL}?name=${name}" > /dev/null
}

upload "$NSIS"
upload "${NSIS}.sig"
if [ -f "$MSI" ]; then
  upload "$MSI"
  [ -f "${MSI}.sig" ] && upload "${MSI}.sig"
fi

echo ""
echo "================================================================"
echo "Released: https://github.com/${RELEASE_REPO}/releases/tag/$TAG"
echo "API picks it up within 5 min (or pm2 restart weered-api)."
echo "================================================================"
