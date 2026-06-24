#!/usr/bin/env bash
set -euo pipefail

REMOTE_HOST="${REMOTE_HOST:-rami@192.168.1.115}"
REMOTE_DIR="${REMOTE_DIR:-/opt/nutsnews/local-ai-service}"
TMP_DIR="/tmp/nutsnews-local-ai-summary-length-update"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [[ ! -f "${PROJECT_ROOT}/local-ai-service/server.mjs" ]]; then
  echo "Could not find local-ai-service/server.mjs from ${PROJECT_ROOT}" >&2
  exit 1
fi

echo "Preparing remote update on ${REMOTE_HOST}..."
ssh "${REMOTE_HOST}" "rm -rf '${TMP_DIR}' && mkdir -p '${TMP_DIR}'"

rsync -av \
  "${PROJECT_ROOT}/local-ai-service/server.mjs" \
  "${PROJECT_ROOT}/local-ai-service/package.json" \
  "${PROJECT_ROOT}/local-ai-service/.env.example" \
  "${REMOTE_HOST}:${TMP_DIR}/"

ssh "${REMOTE_HOST}" "REMOTE_DIR='${REMOTE_DIR}' TMP_DIR='${TMP_DIR}' bash -s" <<'REMOTE_SCRIPT'
set -euo pipefail

sudo mkdir -p "${REMOTE_DIR}"
sudo install -m 0644 "${TMP_DIR}/server.mjs" "${REMOTE_DIR}/server.mjs"
sudo install -m 0644 "${TMP_DIR}/package.json" "${REMOTE_DIR}/package.json"
sudo install -m 0644 "${TMP_DIR}/.env.example" "${REMOTE_DIR}/.env.example"

if [[ ! -f "${REMOTE_DIR}/.env" ]]; then
  echo "Remote .env not found at ${REMOTE_DIR}/.env" >&2
  exit 1
fi

sudo python3 - <<PY
from pathlib import Path
path = Path("${REMOTE_DIR}/.env")
updates = {
    "ACCEPTED_SUMMARY_MIN_CHARS": "260",
    "ACCEPTED_SUMMARY_MAX_CHARS": "340",
    "OLLAMA_NUM_PREDICT": "320",
}
lines = path.read_text().splitlines()
seen = set()
updated = []
for line in lines:
    stripped = line.strip()
    if not stripped or stripped.startswith("#") or "=" not in line:
        updated.append(line)
        continue
    key = line.split("=", 1)[0]
    if key in updates:
        updated.append(f"{key}={updates[key]}")
        seen.add(key)
    else:
        updated.append(line)
for key, value in updates.items():
    if key not in seen:
        updated.append(f"{key}={value}")
path.write_text("\n".join(updated).rstrip() + "\n")
PY

sudo systemctl restart nutsnews-local-ai
sleep 2
sudo systemctl status nutsnews-local-ai --no-pager --lines=12

AI_KEY="$(sudo grep '^LOCAL_AI_API_KEY=' "${REMOTE_DIR}/.env" | cut -d= -f2-)"

echo
printf 'Local AI stats after update:\n'
curl -fsS http://127.0.0.1:8788/stats \
  -H "x-nutsnews-ai-key: ${AI_KEY}" \
  | python3 -c 'import json,sys; data=json.load(sys.stdin); local=data.get("localAi",{}); print(json.dumps({"ok": data.get("ok"), "model": local.get("defaultModel"), "acceptedSummaryMinChars": local.get("acceptedSummaryMinChars"), "acceptedSummaryMaxChars": local.get("acceptedSummaryMaxChars"), "numPredict": local.get("numPredict")}, indent=2))'
REMOTE_SCRIPT

echo
echo "Local AI summary length update applied."
