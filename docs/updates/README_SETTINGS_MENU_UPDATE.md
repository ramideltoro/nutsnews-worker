# NutsNews Settings Menu Update

This update reorganizes the footer Settings panel into a two-level menu.

## What changed

- Settings now opens to a top-level menu.
- Top-level menu items are `Theme` and `Language`.
- Theme options moved into a dedicated Theme level.
- Language options moved into a dedicated Language level.
- Language badges now show country flags instead of text language codes.
- Supported languages now include a `flag` field so future languages can be added cleanly.

## Files changed

- `web/app/components/ThemeSwitcher.tsx`
- `web/app/globals.css`
- `web/lib/languages.ts`

## Validation

Run from `web`:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

The Settings UI should behave like this:

1. Tap/click Settings.
2. See a top-level menu with Theme and Language.
3. Tap Theme to choose a theme.
4. Tap back to return to Settings.
5. Tap Language to choose English or Français.
6. Confirm the circular language badge shows 🇺🇸 or 🇫🇷 instead of `EN` or `FR`.
