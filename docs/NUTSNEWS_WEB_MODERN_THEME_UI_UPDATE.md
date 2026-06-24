# NutsNews Web Modern Theme UI Update

This update refreshes the NutsNews home page with a more modern, elegant visual system while preserving the existing `Nuts [icon] News` brand treatment and the amber default identity.

## What changed

- Rebuilt the home hero banner with glassy surfaces, ambient glow, animated shine, soft rings, and modern stat chips.
- Added a site-wide floating gear button for reader theme settings.
- Added four selectable web themes:
  - `Amber` — the current NutsNews amber identity.
  - `The Modern SaaS` — charcoal, graphite, off-white, and electric blue.
  - `The Creative Premium` — midnight navy, deep slate, muted silver, and neon purple.
  - `The Moody Cyberpunk` — deep green-gray, oiled slate, soft gray, and cyber yellow.
- Persisted the selected theme in `localStorage` using `nutsnews.web.theme`.
- Converted the home page, story cards, CTA button, loading state, empty state, and footer to CSS custom properties so they react to the selected theme.
- Added animated ambient background orbs, a subtle grid, card glow, hover lift, image zoom, button glow, and reduced-motion fallbacks.

## Files changed

- `web/app/layout.tsx`
- `web/app/page.tsx`
- `web/app/globals.css`
- `web/app/components/ArticleFeed.tsx`
- `web/app/components/SiteFooter.tsx`
- `web/app/components/ThemeSwitcher.tsx`

## Validation

Validated with:

```bash
cd web
npm run lint
npx tsc --noEmit
```

`npm run build` could not complete inside the sandbox because `next/font/google` could not fetch the Geist font files from Google Fonts in the offline environment. The failure was network/font-fetch related, not a TypeScript or lint failure.
