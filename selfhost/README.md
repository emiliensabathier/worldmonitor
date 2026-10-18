# Self-hosting (emiliensabathier.fr)

Finance variant of World Monitor branded "Sabathier Terminal", served at the root of
https://emiliensabathier.fr behind Caddy (container on `127.0.0.1:3200`).

| Piece | Where on the VPS |
|---|---|
| Working copy (this repo, branch `sabathier-terminal`) | `~/projets/worldmonitor/app` |
| Compose project, `.env` (API keys, mode 600) | `/opt/worldmonitor` |
| Seeders | `worldmonitor-seed.timer` -> `/opt/worldmonitor/scripts/run-seeders.sh` |
| LLM shim in front of `claude -p` | `wmllm.service`, code in `/home/wmllm/app` (copy of `selfhost/wmllm/`) |
| AGPL source offer | `/var/www/site/labs/source.txt` (served at `/labs/source.txt`, repo emiliensabathier/site) |

## Deploy

```sh
git push               # deploy.sh refuses a dirty or unpushed tree
./selfhost/deploy.sh   # build, restart, health check, republish source.txt, prune
```

The build needs ~2-3 GB of RAM; avoid running it while another app is building.

## LLM shim

```sh
sudo install -o wmllm -g wmllm -m 644 selfhost/wmllm/server.mjs /home/wmllm/app/server.mjs
sudo cp selfhost/wmllm/wmllm.service /etc/systemd/system/ && sudo systemctl daemon-reload
sudo systemctl restart wmllm
```

`/home/wmllm/.env` holds `WMLLM_API_KEY`, `WMLLM_HOSTS` and `CLAUDE_CODE_OAUTH_TOKEN`; never commit it.

## Upstream

`upstream` remote = koala73/worldmonitor. After merging upstream, bump `UPSTREAM_COMMIT`
in `deploy.sh` so the source offer stays accurate.

## Tests that do not run in selfhost/check.sh

The check image has no git history and no `pro-test/node_modules`. These upstream tests therefore
fail there and are not regressions: `tests/crawlable-corpus.test.mjs` (shallow boundary commit,
spawns git), `tests/agent-page.test.mjs` (150-160 character meta, `git ls-files`),
`tests/csp-inline-sources.test.mjs` (`git ls-files`), `tests/sentry-release-build.test.mts`
(loads `pro-test/vite.config.ts`). Run them on a machine with a full checkout and `npm ci` in both
the root and `pro-test/`.
