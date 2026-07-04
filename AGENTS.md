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
- Documentation-only changes do not require a pull request. For documentation-only changes, work from the latest repository default branch, commit the documentation update, push directly to the default branch, and report the commit SHA.
- This direct-push rule applies only to documentation-only changes.
- Application code, runtime behavior, CI workflow, test, dependency, secret/configuration, deployment, cache, Worker, database, and infrastructure changes still require the normal branch and PR flow unless the user explicitly says otherwise.
- If branch protection blocks a documentation-only direct push, stop and report the blocker instead of opening a PR automatically.
