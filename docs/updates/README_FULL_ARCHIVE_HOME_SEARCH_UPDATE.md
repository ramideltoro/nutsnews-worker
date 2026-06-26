# NutsNews full archive home search update

This update keeps full archive search in the backend, but changes the website UX so search happens directly on the home page instead of sending visitors to a separate `/search` page.

## What changed

- Adds Supabase full-text search support through `public.search_articles(...)`.
- Adds `/api/search` for the website and iOS app to use later.
- Adds a full archive search text box directly above the home feed.
- Search results render directly on the home page.
- Clear search returns the normal home feed and infinite scroll.
- Removes the standalone `/search` page if an earlier search update created it.
- Restores the home hero so there is no separate “Search all NutsNews” button.
- Restores the footer so there is no separate Search link.

## Required order

1. Copy this update into `/Users/ramideltoro/WebstormProjects/nutsnews3`.
2. Run the Supabase SQL migration.
3. Test `/api/search` locally.
4. Test the home page inline search locally.
5. Deploy.
6. Test production `/api/search` and the production home page.
7. Only then update the iOS app to use `/api/search`.

## Production endpoint

After deployment, iOS should eventually call:

```text
https://www.nutsnews.com/api/search?q=dogs&page=0&limit=20
```
