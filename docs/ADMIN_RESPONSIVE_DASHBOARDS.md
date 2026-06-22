# Responsive Admin Dashboards

The NutsNews admin area is designed to work on both desktop and mobile. The public reader site is mobile-first, but the admin dashboards are denser because they include operational tables, metrics, filters, and long status values.

This document explains the responsive admin dashboard layer added for mobile support.

---

## Goal

The admin dashboards should be usable on a phone without breaking the layout.

The mobile goals are:

* No page-level horizontal overflow.
* Tables remain usable through contained horizontal scrolling.
* Headers shrink cleanly on small screens.
* Cards stack vertically before they become cramped.
* Long URLs, model names, source names, error messages, and email addresses wrap instead of pushing the viewport wider.
* Buttons and quick-nav pills remain large enough for touch.
* Preformatted setup blocks wrap safely.

---

## Protected Admin Wrapper

The protected admin layout wraps all protected admin pages with:

```tsx
<div className="admin-responsive-shell">{children}</div>
```

File:

```text
web/app/admin/(protected)/layout.tsx
```

This allows shared responsive behavior to apply consistently to:

```text
/admin
/admin/articles
/admin/ai-usage
/admin/feed-health
/admin/feeds
/admin/home-server
/admin/local-ai
/admin/shards
```

---

## Shared Responsive CSS

The shared mobile rules live in:

```text
web/app/globals.css
```

The CSS is scoped to:

```css
.admin-responsive-shell
```

This keeps the changes focused on the protected admin area and avoids changing the public NutsNews reader experience.

---

## What the CSS Fixes

### Mobile Page Padding

On small screens, admin pages use tighter page padding:

```text
0.75rem left/right
1rem top/bottom
```

This gives cards and tables more room on phone screens.

### Rounded Card and Section Size

Large desktop card radiuses and padding are reduced on mobile:

```text
Desktop: large rounded dashboard panels
Mobile: smaller rounded panels with tighter padding
```

This keeps the dashboards from feeling oversized on phones.

### Responsive Headings

Admin pages often have large dashboard titles. On mobile, headings are clamped so they remain readable without overflowing:

```text
h1: clamp(1.85rem, 9vw, 2.5rem)
h2: clamp(1.35rem, 6vw, 1.85rem)
h3: clamp(1.45rem, 8vw, 2.1rem)
```

### Long Text Wrapping

The responsive shell allows long operational text to wrap:

```text
URLs
email addresses
model names
feed names
error messages
status messages
pre/code blocks
table cell content
```

### Touch-Friendly Controls

Admin nav pills, buttons, and hash-link controls keep a minimum 44px height on mobile.

### Tables

The dashboards intentionally keep dense tables as tables. On mobile, tables are contained inside horizontal scroll regions rather than forcing the entire page to overflow.

Important behavior:

```text
Only the table region scrolls sideways.
The page itself remains fixed to the viewport width.
Cells use tighter padding on mobile.
Tables use smaller text on mobile.
```

---

## Why This Approach Was Chosen

The admin dashboards contain operational data that is naturally tabular:

```text
article reviews
AI usage runs
feed health rows
feed management rows
Worker shard status
latest local AI runs
home-server service status
```

Converting every table to separate mobile card layouts would require larger, riskier page-specific rewrites. The shared responsive layer gives a safer first pass:

* It fixes the biggest mobile usability issues quickly.
* It touches one layout file and one global stylesheet.
* It avoids changing Supabase queries or dashboard data logic.
* It preserves the desktop dashboard design.
* It can be extended later page-by-page if one dashboard needs a custom mobile card layout.

---

## Files Changed

```text
web/app/admin/(protected)/layout.tsx
web/app/globals.css
```

Documentation files updated:

```text
README.md
docs/README.md
docs/ADMIN_RESPONSIVE_DASHBOARDS.md
```

---

## Validation

Run from the repo root:

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews2

cd web
npx tsc --noEmit
npm run build
```

Then test locally:

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews2/web
npm run dev
```

Open these routes on a mobile-sized browser viewport:

```text
http://localhost:3000/admin
http://localhost:3000/admin/articles
http://localhost:3000/admin/ai-usage
http://localhost:3000/admin/feed-health
http://localhost:3000/admin/feeds
http://localhost:3000/admin/home-server
http://localhost:3000/admin/local-ai
http://localhost:3000/admin/shards
```

Check that:

* The page itself does not horizontally overflow.
* Tables scroll inside their table panel.
* Header text does not get cut off.
* Sign-out card does not force the page wider.
* Quick navigation pills wrap cleanly.
* Long error/source/model strings wrap or truncate inside their panels.

---

## Future Improvements

Possible future refinements:

* Page-specific mobile cards for the most important table rows.
* Sticky first columns for dense tables.
* Compact mobile filters for `/admin/articles`.
* Collapsible sections for long dashboards.
* Per-dashboard mobile screenshots in the docs.
* Automated visual regression checks for mobile admin routes.

