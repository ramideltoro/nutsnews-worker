# Greek language hydration fix

This update fixes a React hydration warning that appeared after selecting Greek and reloading the home page.

## Problem

`ThemeSwitcher` read `nutsnews.web.language` from `localStorage` during the initial client render. The server rendered the settings gear with English copy, while the first client render immediately used Greek copy. That changed attributes such as `aria-label` during hydration and caused a mismatch.

## Fix

`ThemeSwitcher` now starts with the same default language used by server rendering, then reads the stored browser language after hydration. It also listens for NutsNews language change and storage events so the settings menu stays in sync after the page is hydrated.

## Verification

1. Select Greek from the NutsNews settings menu.
2. Reload the home page.
3. Confirm the page loads without the hydration warning.
4. Open settings and confirm the settings labels still render in Greek after hydration.
