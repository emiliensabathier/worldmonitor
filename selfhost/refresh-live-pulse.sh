#!/usr/bin/env bash
# The production build refuses a crawlable live-pulse snapshot older than 10 days. Upstream republishes
# it weekly; this instance cannot freeze its own (no country risk scores in the finance variant), so take
# upstream's latest, drop the older ones and regenerate the teasers derived from it. Commit the result.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
git fetch -q upstream
latest=$(git ls-tree --name-only upstream/main docs/snapshots/ | grep 'crawlable-live-pulse-' | sort | tail -1)
[ -n "$latest" ] || { echo "no live-pulse snapshot on upstream/main" >&2; exit 1; }
if [ -f "$latest" ]; then echo "already current: $latest"; exit 0; fi
git show "upstream/main:$latest" > "$latest"
for old in docs/snapshots/crawlable-live-pulse-*.json; do [ "$old" = "$latest" ] || git rm -q "$old"; done
node scripts/build-welcome-teasers.mjs
git add "$latest" pro-test public/home.md
echo "now on $latest — commit and push before deploying"
