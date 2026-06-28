# NutsNews Web Offline E2E Footer Contact Locator Fix

This update fixes another Playwright strict-mode locator in the fully offline Web E2E regression test.

The failure happened on the Privacy page because `getByRole("link", { name: "Contact" })` matched both:

- the Privacy page CTA link to the contact page
- the footer `Contact` link

The test now scopes footer page navigation checks to the actual `footer` element and uses exact link names:

```ts
const footer = page.locator("footer");
await footer.getByRole("link", { name: "Contact", exact: true }).click();
```

This keeps the test focused on the requirement that footer links work, while avoiding false failures from duplicate page content.
