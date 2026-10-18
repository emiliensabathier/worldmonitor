#!/usr/bin/env bash
# Build and deploy Sabathier Terminal on the VPS (native amd64), then republish
# the AGPL source offer served at /labs/source.txt.
# Run from the working copy (~/projets/worldmonitor/app) once the branch is pushed:
# the offer points at the pushed tree, so an unpushed build would publish wrong source.
set -euo pipefail

UPSTREAM_COMMIT=8ddb53f36bb8aeaa10d50417dba36b016d65d3f0
DEPLOY_DIR=/opt/worldmonitor
SITE_URL=https://emiliensabathier.fr/
SOURCE_OFFER=/var/www/labs-hub/source.txt
BRANCH_URL=https://github.com/emiliensabathier/worldmonitor/tree/sabathier-terminal
HEALTH_URL=http://127.0.0.1:3200/
HEALTH_TRIES=30

cd "$(git rev-parse --show-toplevel)"

if [ -n "$(git status --porcelain)" ]; then
  echo "Working tree not clean: commit and push before deploying." >&2
  exit 1
fi
git fetch -q origin
if [ "$(git rev-parse HEAD)" != "$(git rev-parse '@{u}')" ]; then
  echo "HEAD differs from origin: push (or pull) before deploying." >&2
  exit 1
fi
HEAD_COMMIT=$(git rev-parse HEAD)

echo "== build $HEAD_COMMIT"
sudo docker buildx build -f selfhost/Dockerfile.cross --build-arg SITE_URL="$SITE_URL" \
  -t worldmonitor:latest --load .

echo "== restart"
(cd "$DEPLOY_DIR" && sudo docker compose up -d --no-build worldmonitor)
for _ in $(seq "$HEALTH_TRIES"); do
  if curl -fsS -o /dev/null "$HEALTH_URL"; then break; fi
  sleep 2
done
curl -fsS -o /dev/null "$HEALTH_URL" || { echo "Site not answering on $HEALTH_URL" >&2; exit 1; }

echo "== source offer"
offer=$(mktemp)
{
  cat <<EOF
Source code of the dashboard served at ${SITE_URL%/}

This site runs World Monitor (https://github.com/koala73/worldmonitor),
licensed AGPL-3.0-only, at upstream commit
$UPSTREAM_COMMIT, with the patch below applied
and built with VITE_VARIANT=finance and SITE_URL=$SITE_URL.

Complete corresponding source = that commit + this patch.
Same tree as a git branch: $BRANCH_URL (commit $HEAD_COMMIT)

EOF
  git diff "$UPSTREAM_COMMIT" HEAD -- . ':(exclude)public/favico' ':(exclude)public/favicon.ico'
  echo "# Binary icons under public/favico/ and public/favicon.ico replaced with an ES monogram (own artwork)."
} > "$offer"
sudo install -m 644 "$offer" "$SOURCE_OFFER"
rm -f "$offer"

echo "== cleanup"
sudo docker image prune -f >/dev/null
echo "Deployed $HEAD_COMMIT"
