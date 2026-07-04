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
- All documentation-only changes belong in `ramideltoro/nutsnews-docs`.
- Documentation-only changes in `ramideltoro/nutsnews-docs` must be committed and pushed directly to `main`. Do not create a PR for docs-only changes in the docs repo.
- If direct push to `main` in `ramideltoro/nutsnews-docs` is blocked by branch protection, stop and report the blocker. Do not silently create a PR.
- Any change to this repository, including Worker code, runtime behavior, CI workflow, tests, dependencies, secrets/configuration, deployment, cache, database, infrastructure, or AGENTS.md instruction changes, must go through the normal branch and pull request flow unless Rami explicitly says otherwise.
- Pull requests must be normal ready-to-merge PRs, not draft PRs.
- If using `gh pr create`, do not pass `--draft`.
- If using a GitHub connector/API, set `draft: false`.
- If a PR is accidentally created as draft, mark it ready before reporting completion.
- Do not merge PRs unless Rami explicitly says to merge.
