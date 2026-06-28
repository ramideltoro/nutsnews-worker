# NutsNews Hydration Language Fix

This update fixes a homepage hydration mismatch caused by the hero tagline reading `localStorage` during the first client render.

Before the fix, the server rendered English text, but the client could render French or Japanese immediately if that language was stored in the browser. React then reported a server/client text mismatch.

Changes:

- `web/app/components/HeroTagline.tsx`
  - Uses the existing `useSelectedLanguage()` hook.
  - The first client render matches the server default language.
  - The saved language is applied after hydration.

- `web/next.config.ts`
  - Adds image quality `72` to `images.qualities` so Next.js accepts the existing article image quality setting.

Test:

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews3/web
npm run lint
npm run build
npm run dev
```

Then open the homepage, switch languages, and confirm the hydration error is gone.
