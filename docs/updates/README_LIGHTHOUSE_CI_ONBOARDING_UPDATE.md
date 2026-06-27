# Lighthouse CI Documentation Update

This update documents the correct Google Lighthouse CI onboarding flow for NutsNews.

It captures an important repository-layout correction:

```text
The repository root is nutsnews3/
The Next.js web app is nutsnews3/web/
```

Because of that, Lighthouse CI must be installed and run inside `web/`, while the GitHub Actions workflow file remains in `.github/workflows/` at the repository root.

---

## Documentation Added

New guide:

```text
docs/LIGHTHOUSE_CI_ONBOARDING.md
```

Updated indexes:

```text
README.md
docs/README.md
docs/OBSERVABILITY.md
```

---

## What the Guide Covers

The new guide includes:

* Cleanup commands if `@lhci/cli` was accidentally installed at the repository root, including restoring the tracked root `package-lock.json` if needed.
* Correct install command from `web/`.
* Correct `web/lighthouserc.js` location.
* Correct `.github/workflows/lighthouse-ci.yml` workflow with `working-directory: web`.
* GitHub secrets needed for the Next.js/Supabase build.
* Local validation commands.
* First threshold policy for performance, accessibility, best practices, SEO, LCP, CLS, and TBT.
* Warning that Worker/controller refresh URLs must not be audited.

---

## Correct Local Validation Commands

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews3/web

npm run build
npx lhci autorun
```

If `Missing script: "build"` or `Missing script: "start"` appears, the command was likely run from the repository root instead of `web/`.

---

## Correct Git Commit Scope

After adding the real Lighthouse CI files, commit these from the repository root:

```bash
git add web/package.json web/package-lock.json web/lighthouserc.js .github/workflows/lighthouse-ci.yml

git commit -m "Add Lighthouse CI checks"
```

This documentation update does not add the actual Lighthouse CI runtime files. It documents how to add them correctly.
