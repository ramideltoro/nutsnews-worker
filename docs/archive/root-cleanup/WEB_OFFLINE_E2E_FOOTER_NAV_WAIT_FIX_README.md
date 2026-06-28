# NutsNews Web Offline E2E Footer Navigation Wait Fix

This update makes the offline web E2E footer navigation checks less flaky on GitHub Actions.

The CI runner can take several seconds to cold-compile `/about`, `/privacy`, and `/contact` during `next dev`. The previous test used the default 5 second URL assertion timeout, which could fail while the page was still compiling.

Changes:

- Footer links are scoped to the actual `<footer>`.
- Each footer link href is verified before clicking.
- Footer navigation now waits up to 20 seconds for `/about`, `/privacy`, and `/contact`.
- Page content assertions also use the same 20 second timeout.

Run:

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews3/web
npm run test:e2e:offline
```
