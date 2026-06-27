# PageSpeed Insights for NutsNews

PageSpeed Insights is the manual production performance check for NutsNews after major UI changes.

Use it when changing:

- the article card layout
- images or image loading behavior
- themes and visual effects
- the home feed
- public pages such as `/about`, `/privacy`, or `/contact`
- anything that may affect JavaScript size, loading speed, SEO, or mobile performance

Google PageSpeed Insights reports on both mobile and desktop experiences and provides suggestions for performance, accessibility, best practices, and SEO. The PageSpeed Insights API can run the same type of analysis from the command line.

NutsNews already has Lighthouse CI for local build checks. PageSpeed Insights is different: it checks the real deployed site, normally `https://www.nutsnews.com/`.

---

## What was added

The web app now includes:

```text
web/scripts/pagespeed-insights.mjs
```

and these npm scripts:

```bash
npm run audit:pagespeed
npm run audit:pagespeed:mobile
npm run audit:pagespeed:desktop
```

The script saves reports in:

```text
web/reports/pagespeed/
```

That folder is ignored by Git because reports are generated artifacts.

---

## Run a mobile and desktop audit

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews3/web

npm run audit:pagespeed
```

By default this audits:

```text
https://www.nutsnews.com/
```

with both mobile and desktop strategies.

---

## Run only mobile

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews3/web

npm run audit:pagespeed:mobile
```

Mobile is the most important one for NutsNews because most readers will browse short positive-news cards on their phone.

---

## Run only desktop

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews3/web

npm run audit:pagespeed:desktop
```

---

## Audit another NutsNews page

Use this after editing a specific page.

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews3/web

PAGESPEED_URL="https://www.nutsnews.com/contact" npm run audit:pagespeed:mobile
```

Other good checks:

```bash
PAGESPEED_URL="https://www.nutsnews.com/about" npm run audit:pagespeed:mobile
PAGESPEED_URL="https://www.nutsnews.com/privacy" npm run audit:pagespeed:mobile
```

---

## Optional API key

The script works without an API key for light manual use. For frequent automated runs, create a Google PageSpeed Insights API key and export it before running:

```bash
export PAGESPEED_INSIGHTS_API_KEY="your_google_pagespeed_api_key"
```

Do not commit this key.

For GitHub Actions, add it as a repository secret named:

```text
PAGESPEED_INSIGHTS_API_KEY
```

---

## Manual GitHub Action

This update also adds a manual workflow:

```text
.github/workflows/pagespeed-insights.yml
```

In GitHub:

1. Open the NutsNews repository.
2. Go to **Actions**.
3. Select **PageSpeed Insights**.
4. Click **Run workflow**.
5. Choose the URL and strategy.
6. Download the generated PageSpeed report artifact.

The workflow is manual on purpose. It should be used after meaningful UI changes, not on every commit.

---

## Recommended NutsNews thresholds

Treat these as practical targets, not permanent hard rules:

| Area | Target |
| --- | ---: |
| Performance | 70+ |
| Accessibility | 90+ |
| Best Practices | 85+ |
| SEO | 90+ |

If the mobile performance score drops after a UI change, check the top diagnostics first. Common NutsNews causes are large images, too much JavaScript, layout shifts, and expensive animations.

---

## Make low scores fail locally

By default, the script reports low scores but does not fail. To make it exit with an error when scores fall below the thresholds:

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews3/web

PAGESPEED_FAIL_ON_LOW_SCORE=1 npm run audit:pagespeed
```

You can customize the thresholds:

```bash
PAGESPEED_MIN_PERFORMANCE=0.75 \
PAGESPEED_MIN_ACCESSIBILITY=0.90 \
PAGESPEED_MIN_BEST_PRACTICES=0.85 \
PAGESPEED_MIN_SEO=0.90 \
PAGESPEED_FAIL_ON_LOW_SCORE=1 \
npm run audit:pagespeed
```

---

## When to run it

Run PageSpeed Insights after:

- changing article card image layout
- adding a new animation or theme effect
- changing the home page feed
- changing public page content or structure
- adding analytics, embeds, widgets, or third-party scripts
- changing image optimization logic

Run mobile first. If mobile looks good, run desktop too.
