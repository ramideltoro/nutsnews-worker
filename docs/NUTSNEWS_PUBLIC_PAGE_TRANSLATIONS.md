# NutsNews Public Page Translation Update

This update extends the existing web language preference beyond the home feed.

## What changed

- About page content now renders in English, French, or Japanese based on the selected NutsNews language.
- Contact page content now renders in English, French, or Japanese.
- Contact form labels, placeholders, submit state, success text, and error fallbacks now render in the selected language.
- Privacy page content now renders in English, French, or Japanese.
- Footer navigation labels now render in the selected language.
- Settings menu labels, section headings, ARIA labels, and theme descriptions now render in the selected language.
- Theme names remain unchanged: Amber, The Modern SaaS, The Creative Premium, Bambi, Sakura, and San Juan.

## Implementation notes

The update reuses the existing `nutsnews.web.language` localStorage value and the existing `nutsnews:language-change` event.

A shared `useSelectedLanguage` hook lets client-rendered public page content update immediately when the language is changed in Settings.

The public pages keep their server metadata in English for now, while visible page content follows the selected language on the client.

## Validation

Run from `web/`:

```bash
npm run lint
npx tsc --noEmit
npm run build
```
