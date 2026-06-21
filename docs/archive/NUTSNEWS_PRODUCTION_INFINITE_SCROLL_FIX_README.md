# NutsNews Production Infinite Scroll Fix

This update fixes the homepage infinite scroll behavior where local development loads more stories, but production stops after the first set of cards.

## What changed

### `web/app/page.tsx`
- Passes both `nextPage` and `nextCursor` into the feed component.

### `web/app/components/ArticleFeed.tsx`
- Uses page-based pagination as the primary production path: `/api/articles?page=1`, `/api/articles?page=2`, etc.
- Keeps cursor pagination as a fallback for older cached homepage payloads.
- Continues de-duplicating articles on the client.

### `web/lib/articles.ts`
- Keeps the public feed snapshot optimization when it has more pages.
- If the production `public_feed_snapshot` is short/stale and would end pagination early, verifies against the canonical `articles` table before returning `nextPage: null`.
- Cursor fallback now reads from the canonical `articles` table instead of depending on snapshot state.

## Why this should fix production

Production can use the optimized `public_feed_snapshot` path while local may fall back to the source `articles` table. If the production snapshot is short/stale, the first page can return `nextPage: null`, so the browser never tries to fetch more stories. This update prevents a short/stale snapshot from ending infinite scroll early.

## Validation

`npx tsc --noEmit` passed.

`npm run lint` still reports one existing unrelated lint issue in `web/lib/adminArticleReviews.ts`.
