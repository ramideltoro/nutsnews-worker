# NutsNews App Store Privacy Policy Update

This update strengthens the `/privacy` page for App Store review by matching the current iOS app behavior more clearly.

## iOS app behavior reviewed

The current native app code shows:

- No account login or registration.
- No payment flow.
- No use of camera, microphone, photos, contacts, health, location, push notifications, or advertising identifier APIs.
- No third-party SDK package dependencies in the Xcode project.
- Article feed data is fetched from `https://www.nutsnews.com/api/articles` using `URLSession`.
- Article responses are cached locally in the app caches directory.
- Liked stories, theme choice, and haptics preference are stored locally with `UserDefaults` / `@AppStorage`.
- Original publisher links open through `SFSafariViewController`.

## Changed files

- `web/app/privacy/page.tsx`
  - Rewrites the privacy policy to be more explicit for App Store review.
  - Adds positive privacy highlights.
  - Clarifies local storage, caching, network requests, diagnostics, website analytics, publisher links, and no tracking.

- `web/app/components/SiteFooter.tsx`
  - Keeps the public `Privacy Policy` footer link.

- `web/app/sitemap.ts`
  - Keeps `/privacy` in the sitemap.

## App Store Connect URL

After deployment, use this Privacy Policy URL:

```text
https://www.nutsnews.com/privacy
```

## Validation

`npx tsc --noEmit` passed for this update.
