# NutsNews Feed Visibility Fade Fix

This patch fixes an issue where the home page banner could appear while the article feed stayed hidden after the page fade animation update.

## What changed

- Removed the page-wrapper fade animation from `.modern-home-shell` and `.public-themed-page`.
- Restored the prior safe theme/home-button CSS baseline so the article feed is never hidden by the global animation.
- Kept the existing theme system, home button, settings button, hero styling, cards, and public page theme styling unchanged.

## Files updated

- `web/app/globals.css`
