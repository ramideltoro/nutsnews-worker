# NutsNews Qwen Summary Length Update

This update makes accepted Qwen/Ollama AI article summaries return in the 240-300 character range.

## Changed files

- `local-ai-service/server.mjs`
- `local-ai-service/.env.example`
- `docs/HOME_SERVER_LOCAL_AI.md`

## What changed

- Adds configurable summary limits:
  - `ACCEPTED_SUMMARY_MIN_CHARS=240`
  - `ACCEPTED_SUMMARY_MAX_CHARS=300`
- Updates the Qwen/Ollama prompt to request 240-300 character summaries for accepted stories.
- Adds server-side summary normalization so accepted summaries are trimmed/filled into the configured range before the Worker receives them.
- Keeps rejected article summaries as an empty string.
- Raises the default `OLLAMA_NUM_PREDICT` from `180` to `260` so the longer summary plus JSON fields has enough output room.
- Updates local AI documentation.

## Apply to local project

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews2
unzip -o ~/Downloads/nutsnews-qwen-summary-240-300-update.zip -d /tmp/nutsnews-qwen-summary-240-300-update
rsync -av /tmp/nutsnews-qwen-summary-240-300-update/qwen-summary-240-300-update/ ./
node --check local-ai-service/server.mjs
```

## Deploy to home server local AI service

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews2
scp local-ai-service/server.mjs rami@chingadera:/tmp/server.mjs
ssh rami@chingadera 'sudo cp /tmp/server.mjs /opt/nutsnews/local-ai-service/server.mjs && sudo chown root:root /opt/nutsnews/local-ai-service/server.mjs'
```

Update the real service `.env` on the home server:

```bash
ssh rami@chingadera
sudo nano /opt/nutsnews/local-ai-service/.env
```

Make sure these values exist:

```bash
ACCEPTED_SUMMARY_MIN_CHARS=240
ACCEPTED_SUMMARY_MAX_CHARS=300
OLLAMA_NUM_PREDICT=260
```

Restart and verify:

```bash
sudo systemctl restart nutsnews-local-ai
sudo systemctl status nutsnews-local-ai --no-pager
curl -s http://127.0.0.1:8788/stats -H "x-nutsnews-ai-key: $LOCAL_AI_API_KEY" | python3 -m json.tool
```

## Commit

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews2
git status
git add local-ai-service/server.mjs local-ai-service/.env.example docs/HOME_SERVER_LOCAL_AI.md
git commit -m "Constrain Qwen summaries to 240-300 characters"
```
