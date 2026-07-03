# AGENTS.md

## Project

This is the NutsNews Worker repository.

- Main repository: https://github.com/ramideltoro/nutsnews-worker
- Shared documentation repository: https://github.com/ramideltoro/nutsnews-docs
- Primary branch: main

## Working Rules

- Never commit secrets, .env files, API keys, tokens, database dumps, Cloudflare credentials, or private credentials.
- Prefer the smallest safe code change that solves the issue.
- Keep product, operations, deployment, cache, automation, and environment documentation in `ramideltoro/nutsnews-docs`, not in this Worker repository.
- Documentation-only updates must not trigger Worker deployments.
