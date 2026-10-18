#!/usr/bin/env bash
# Run a command (tsc, vitest, node --test...) inside a throwaway container that holds the repo's
# dependencies and the current working tree. Usage: ./selfhost/check.sh npx tsc --noEmit
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
sudo docker buildx build -q -f selfhost/Dockerfile.check -t worldmonitor-check:latest --load . >/dev/null
# Each run rebuilds the source layer: drop the build cache it orphans (the disk is shared and
# nearly full), keeping the cached npm ci layer that the current image still references.
trap 'sudo docker builder prune -f >/dev/null 2>&1 || true' EXIT
sudo docker run --rm -e NODE_OPTIONS=--max-old-space-size=3072 worldmonitor-check:latest "$@"
