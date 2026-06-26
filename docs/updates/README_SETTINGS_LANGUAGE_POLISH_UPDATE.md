# NutsNews Settings Language Polish Update

This is a small follow-up to the settings menu update.

## What changed

- Makes the language flags larger and gives the flag badge a true circular size so 🇺🇸 and 🇫🇷 fill the circle better.
- Adds a client-side `HeroTagline` component for the home banner tagline.
- Translates the banner tagline based on the selected site language:
  - English: `Positive News, Simplified`
  - French: `Actualités positives, simplifiées`
- Keeps the language selection stored in the existing `nutsnews.web.language` localStorage key.
- Keeps future-language support centralized through `web/lib/languages.ts`.

## Files changed

- `web/app/components/HeroTagline.tsx`
- `web/app/components/ThemeSwitcher.tsx`
- `web/app/globals.css`
- `web/app/page.tsx`
- `web/lib/languages.ts`

## Validation

Run from `web`:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Manual test:

1. Open the home page.
2. Open Settings → Language.
3. Confirm the flags are larger inside the circular badges.
4. Choose Français.
5. Confirm the banner tagline changes to `Actualités positives, simplifiées`.
6. Switch back to English and confirm it returns to `Positive News, Simplified`.
