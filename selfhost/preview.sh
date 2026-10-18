#!/usr/bin/env bash
# Build the working tree as worldmonitor:preview and run it on 127.0.0.1:3201 next to production,
# with production's environment and network (same Redis, same keys). Stop: ./selfhost/preview.sh stop
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
NAME=wm-preview
if [ "${1:-}" = stop ]; then
  sudo docker rm -f "$NAME" >/dev/null 2>&1 || true
  exit 0
fi
sudo docker buildx build -f selfhost/Dockerfile.cross --build-arg SITE_URL=https://emiliensabathier.fr/terminal/ \
  -t worldmonitor:preview --load .
envfile=$(mktemp)
chmod 600 "$envfile"
trap 'rm -f "$envfile"' EXIT
sudo docker inspect worldmonitor --format '{{range .Config.Env}}{{println .}}{{end}}' > "$envfile"
net=$(sudo docker inspect worldmonitor --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' | awk '{print $1}')
sudo docker rm -f "$NAME" >/dev/null 2>&1 || true
sudo docker run -d --name "$NAME" --network "$net" --env-file "$envfile" -p 127.0.0.1:3201:8080 worldmonitor:preview >/dev/null
for _ in $(seq 40); do curl -fsS -o /dev/null http://127.0.0.1:3201/ && break; sleep 2; done
curl -fsS -o /dev/null http://127.0.0.1:3201/ || { echo "Preview not answering" >&2; exit 1; }
echo "Preview on http://127.0.0.1:3201/"
