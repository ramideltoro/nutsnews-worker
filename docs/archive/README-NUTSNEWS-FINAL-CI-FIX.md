# NutsNews final CI fix

This patch fixes two CI/local issues after the home/contact update:

1. **Web Offline E2E strict-mode duplicate title failure**
   - The homepage now renders the same mock article in several category sections.
   - The French language assertion also needs `.first()` so Playwright does not fail when translated titles appear multiple times.

2. **Snyk web dependency install timeout**
   - The previous dependency bundle accidentally included sandbox/internal registry URLs in `web/package-lock.json`.
   - This patch rewrites those lockfile `resolved` URLs back to `https://registry.npmjs.org/`.
   - It keeps the dependency fixes for `webpack@5.108.0` and `brace-expansion@5.0.7`.

Changed files:

- `scripts/web_offline_e2e_regression.mjs`
- `web/package.json`
- `web/package-lock.json`

Recommended checks:

```bash
npm --prefix web install --registry=https://registry.npmjs.org/
npm --prefix web run test:e2e:offline
npm --prefix web run lint
npm --prefix web run build
```

Note: If local build still shows Sentry 403 while uploading source maps, that is a Sentry auth/token permission issue, not a code compile failure.
