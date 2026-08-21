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
- Once the intended scope is complete, required checks pass, no blocking review remains, and rollout prerequisites are satisfied, Codex may mark a pull request ready and merge it without separate approval.
- Never merge a pull request with failing required checks, unresolved blocking review feedback, ambiguous scope, or unmet production-safety prerequisites.

## Isolated Git Workflow and Cleanup

- Before changing files, fetch the latest remote default branch and create a new task-specific branch in a disposable clone or isolated `git worktree`. Never make task changes in a shared checkout or directly on `main` or `master`.
- Use a fresh branch, worktree, and directory for every task. Do not reuse a prior task's branch or checkout.
- Keep the task checkout isolated from unrelated repositories and user work. Preserve all pre-existing changes.
- After the work is safely committed and pushed, the pull request is opened or merged as required, and validation results are recorded, remove the disposable local checkout to avoid consuming disk space.
- For a disposable clone, verify `git status --short` is clean and all required commits exist on the remote, then delete only that exact clone directory. For a worktree, run `git worktree remove <exact-path>` from the owning repository and then `git worktree prune`.
- Delete the local task branch only after confirming it is merged or no longer needed and no unpushed commits remain.
- Never delete a shared or canonical clone, the current working directory, an unverified path, or a checkout containing uncommitted, untracked, unpushed, or unrelated work. If cleanup cannot be proven safe, stop and report the exact path and blocker instead of deleting it.
