#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

const requiredFiles = [
  'web/app/privacy/page.tsx',
  'web/app/privacy/LocalizedPrivacyPolicyPage.tsx',
  'web/app/contact/page.tsx',
  'web/app/contact/ContactForm.tsx',
  'docs/DEPLOYMENT_CHECKLIST.md',
];

const failures = [];
for (const file of requiredFiles) {
  if (!existsSync(file)) failures.push(`Missing required file: ${file}`);
}

function includesAny(file, values) {
  if (!existsSync(file)) return false;
  const text = readFileSync(file, 'utf8').toLowerCase();
  return values.some((value) => text.includes(value.toLowerCase()));
}

if (!includesAny('web/app/privacy/LocalizedPrivacyPolicyPage.tsx', ['privacy', 'data', 'contact'])) {
  failures.push('Privacy policy page does not appear to contain privacy/data/contact wording.');
}
if (!includesAny('web/app/contact/ContactForm.tsx', ['email', 'message', 'turnstile'])) {
  failures.push('Contact form does not appear to contain expected email/message/Turnstile fields.');
}
if (existsSync('web/app/layout.tsx') && !includesAny('web/app/layout.tsx', ['nutsnews'])) {
  failures.push('App layout does not appear to include NutsNews metadata.');
}

if (failures.length > 0) {
  console.error('App Store docs/readiness checks failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('App Store docs/readiness checks passed.');
