# Snyk Security Scan

NutsNews uses Snyk as an extra dependency scanner alongside Dependabot and CodeQL.

## What it checks

The workflow scans both npm projects:

- `web/` — the Next.js app, API routes, admin pages, contact form, and UI dependencies.
- `worker/` — the Cloudflare Worker feed/AI pipeline dependencies.

It runs `snyk test` with a `high` severity threshold, so high and critical dependency issues fail the workflow. Lower severity issues still appear in Snyk output but do not block normal development.

On pushes to `main`, it also runs `snyk monitor` so the projects appear in the Snyk dashboard for ongoing monitoring.

## Required GitHub secret

Create this repository secret:

```txt
SNYK_TOKEN
```

Get it from Snyk after logging in:

```txt
Snyk → Account settings → Auth Token
```

Then add it in GitHub:

```txt
GitHub repo → Settings → Secrets and variables → Actions → New repository secret
```

## When it runs

- Pushes to `main`
- Pull requests into `main`
- Weekly scheduled scan
- Manual workflow dispatch from the Actions tab

## Local commands

From the web app:

```bash
cd web
SNYK_TOKEN="your_token" npx snyk test --file=package.json --package-manager=npm --severity-threshold=high --project-name=nutsnews-web
```

From the worker:

```bash
cd worker
SNYK_TOKEN="your_token" npx snyk test --file=package.json --package-manager=npm --severity-threshold=high --project-name=nutsnews-worker
```

## Why this is useful for NutsNews

NutsNews has public API routes, a contact form, admin routes, Cloudflare Workers, and several environment secrets. Snyk provides another layer of dependency risk visibility, especially around vulnerable npm packages and remediation advice.
