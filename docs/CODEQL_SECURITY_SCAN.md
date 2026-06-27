# CodeQL Security Scan

NutsNews uses GitHub CodeQL for security scanning.

## What it scans

- `web/` Next.js app
- `worker/` Cloudflare Workers code
- `.github/workflows/` GitHub Actions workflows

## What it helps catch

- JavaScript and TypeScript security issues
- Unsafe code patterns in API routes and worker code
- GitHub Actions workflow security issues
- Problems that GitHub can show as code scanning alerts on pull requests

## When it runs

- On pushes to `main`
- On pull requests into `main`
- Weekly on Tuesday
- Manually from the GitHub Actions tab

## Where to view results

Go to:

```txt
GitHub repo -> Security -> Code scanning
```

Or check the workflow run:

```txt
GitHub repo -> Actions -> CodeQL Security Scan
```

## Notes

This workflow uses `build-mode: none` because NutsNews is JavaScript/TypeScript and GitHub Actions workflow analysis. That keeps the scan simple and avoids needing to install dependencies or run the full Next.js build.

The scan excludes generated and build output folders such as `node_modules`, `.next`, `coverage`, `reports`, and `worker/generated-wrangler`.
