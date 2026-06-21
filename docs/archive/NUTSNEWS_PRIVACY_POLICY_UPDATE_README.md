# NutsNews Privacy Policy Update

This update adds a public privacy policy page for App Store submission and links it from the fixed site footer.

## Changed files

- `web/app/privacy/page.tsx`
  - New `/privacy` route.
  - Matches the existing NutsNews dark/amber visual style.
  - Includes privacy text covering account-free browsing, local liked stories, app caching, diagnostics, publisher links, children’s privacy, changes, and contact.

- `web/app/components/SiteFooter.tsx`
  - Adds a `Privacy Policy` footer link.

- `web/app/sitemap.ts`
  - Adds `https://www.nutsnews.com/privacy` to the sitemap.

## App Store Connect URL

After deploying to production, use this as the Privacy Policy URL in App Store Connect:

```text
https://www.nutsnews.com/privacy
```
