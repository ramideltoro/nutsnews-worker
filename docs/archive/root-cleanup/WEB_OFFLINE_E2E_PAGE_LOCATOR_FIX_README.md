# NutsNews Web Offline E2E Page Locator Fix

This update tightens the offline Web E2E checks for About, Privacy, and Contact pages.

The previous About check used `page.getByText(/About NutsNews/i)`, which can also match Next.js route-announcer text. Playwright strict mode correctly fails when a locator matches more than one element.

The updated test scopes page-content checks to `main` so the regression verifies visible page content and ignores route-announcer accessibility text.

Run:

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews3/web
npm run test:e2e:offline
```
