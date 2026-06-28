# NutsNews Cloudflare Turnstile Update

This bundle adds Cloudflare Turnstile to the NutsNews contact form.

## Files updated

- `web/app/contact/ContactForm.tsx`
- `web/app/api/contact/route.ts`
- `docs/CLOUDFLARE_TURNSTILE_CONTACT_FORM.md`
- `docs/DEPLOYMENT_CHECKLIST.md`
- `web/README.md`

## Local copy command

From your Mac:

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews2

unzip -o ~/Downloads/nutsnews-turnstile-update.zip -d /tmp/nutsnews-turnstile-update
rsync -av /tmp/nutsnews-turnstile-update/ ./
```

## Required environment variables

Add these to `web/.env.local` locally and to Vercel Production:

```env
NEXT_PUBLIC_TURNSTILE_SITE_KEY=your_cloudflare_turnstile_site_key
TURNSTILE_SECRET_KEY=your_cloudflare_turnstile_secret_key
```

## Verify

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews2/web
npm install
npx tsc --noEmit
npm run build
npm run dev
```

Open `http://localhost:3000/contact` and confirm the Turnstile widget appears above the Send button.
