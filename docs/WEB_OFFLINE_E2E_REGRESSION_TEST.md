# NutsNews Web Offline E2E Regression Test

This test runs the real Next.js web app against mocked Supabase/PostgREST, Turnstile, and Resend services.

It can be run from either the repository root or the `web/` directory. The test starts Next.js with an absolute `web` working directory so `npm run test:e2e:offline` works reliably in local terminals and GitHub Actions.

The test verifies:

- Home page renders with mock articles.
- Footer navigation works for Home, Search, About, Contact, and Privacy.
- Search returns a mock article.
- About and Contact pages render.
- Contact form submits through mocked Turnstile and mocked Resend.
- A mock `quota_usage_events` email event is recorded.
- Switching to French renders translated article text.

Run:

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews3/web
npm install
npx playwright install --with-deps chromium
npm run test:e2e:offline
```

A passing run ends with:

```text
✅ NutsNews fully offline Web E2E regression passed.
✓ Cleanup complete; exiting Web E2E regression.
```

## Locator and mock-image stability

The test uses strict Playwright selectors. For the settings panel, it targets the settings region directly with `getByRole("region", { name: "NutsNews settings" })` so the locator does not also match the settings button.

Mock article images are served from the local mock external service so the test remains fully offline and Next Image does not try to resolve external DNS.


## Stability notes

The browser test scopes ambiguous controls, such as the search submit button, to their owning dialog so Playwright strict mode cannot match footer/open/close buttons by accident. The browser test also intercepts `/_next/image` requests and returns a tiny mock PNG so the test remains fully offline even when mock article images point at localhost.


## Locator stability notes

The browser checks scope page-content assertions to `main` where possible. This avoids Playwright strict-mode conflicts with Next.js route-announcer text such as `About NutsNews | NutsNews`, which is useful for accessibility but is not the visible page content being tested.
