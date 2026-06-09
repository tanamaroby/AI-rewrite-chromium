#!/usr/bin/env bash
# deploy-mobile.sh — bump version, copy userscript to iCloud Userscript Files
#
# Usage:
#   ./deploy-mobile.sh          # patch bump  (2.0.0 → 2.0.1)
#   ./deploy-mobile.sh minor    # minor bump  (2.0.0 → 2.1.0)
#   ./deploy-mobile.sh major    # major bump  (2.0.0 → 3.0.0)

set -euo pipefail

SRC="mobile/ai-rewriter-mobile.user.js"
DEST_DIR="/Users/main/Library/Mobile Documents/com~apple~CloudDocs/Userscript Files"
BUMP="${1:-patch}"

# ── Read current version ────────────────────────────────────────────────────
CURRENT=$(grep -m1 '@version' "$SRC" | awk '{print $3}')
MAJOR=$(echo "$CURRENT" | cut -d. -f1)
MINOR=$(echo "$CURRENT" | cut -d. -f2)
PATCH=$(echo "$CURRENT" | cut -d. -f3)

# ── Bump ────────────────────────────────────────────────────────────────────
case "$BUMP" in
  major) MAJOR=$((MAJOR+1)); MINOR=0; PATCH=0 ;;
  minor) MINOR=$((MINOR+1)); PATCH=0 ;;
  patch) PATCH=$((PATCH+1)) ;;
  *)
    echo "Unknown bump type '$BUMP'. Use: patch | minor | major"
    exit 1
    ;;
esac

NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}"

# ── Update @version in source file ─────────────────────────────────────────
sed -i '' "s|// @version.*|// @version      ${NEW_VERSION}|" "$SRC"
echo "  version  ${CURRENT} → ${NEW_VERSION}"

# ── Build destination filename with version stamp ───────────────────────────
# e.g. "AI Rewriter — Mobile v2.0.1.user.js"
DEST_FILE="AI Rewriter — Mobile v${NEW_VERSION}.user.js"

# ── Copy to iCloud ──────────────────────────────────────────────────────────
cp "$SRC" "${DEST_DIR}/${DEST_FILE}"

echo "  copied → ${DEST_FILE}"
echo "  done  (iCloud will sync automatically)"
