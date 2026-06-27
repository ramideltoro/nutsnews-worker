# NutsNews SEO Structured Data Audit

This update adds an automated production SEO audit for NutsNews.

The audit checks the live site for the core fields that matter before manually using Google Rich Results Test or Schema.org Validator:

- homepage title and description
- canonical URL
- Open Graph title, description, and image
- Twitter card image metadata
- valid `application/ld+json` JSON-LD
- homepage page-level schema
- article page `Article`, `NewsArticle`, or `BlogPosting` schema
- article headline, description, image, dates, publisher, and `mainEntityOfPage`
- sitemap article URL discovery

## Local usage

From the web app folder:

```bash
cd web
npm run audit:seo
```

Audit a different public URL:

```bash
SEO_AUDIT_BASE_URL="https://www.nutsnews.com" npm run audit:seo
```

Audit more article URLs:

```bash
SEO_AUDIT_ARTICLE_LIMIT=5 npm run audit:seo
```

Optionally include static pages:

```bash
SEO_AUDIT_EXTRA_PATHS="/privacy,/contact" npm run audit:seo
```

Reports are written to:

```text
web/reports/seo/seo-structured-data-audit.md
web/reports/seo/seo-structured-data-audit.json
```

## GitHub Actions

The workflow lives at:

```text
.github/workflows/seo-structured-data.yml
```

It runs on:

- push to `main`
- pull requests
- manual dispatch
- daily schedule at `10:30 UTC`

The workflow audits the live production site by default:

```text
https://www.nutsnews.com
```

It uploads the report as a GitHub Actions artifact.

## Why this exists

Google Rich Results Test and Schema.org Validator are still useful manual checks. This workflow does not replace those tools completely, but it catches the common NutsNews SEO regressions automatically before they sit unnoticed in production.
