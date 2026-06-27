#!/usr/bin/env node
const BASE_URL = String(process.env.NUTSNEWS_BASE_URL || 'https://www.nutsnews.com').replace(/\/+$/, '');
const TIMEOUT_MS = Number(process.env.HTTP_TIMEOUT_MS || 15000);

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { 'user-agent': 'NutsNews-GitHub-Actions-SEO-Check/1.0' } });
    const text = await response.text();
    if (!response.ok) throw new Error(`${url} returned ${response.status}: ${text.slice(0, 300)}`);
    return { response, text };
  } finally {
    clearTimeout(timeout);
  }
}

function assertIncludes(text, needle, label) {
  if (!text.includes(needle)) throw new Error(`${label} is missing expected text: ${needle}`);
}

console.log(`Checking ${BASE_URL}/robots.txt and ${BASE_URL}/sitemap.xml`);
const robots = await fetchText(`${BASE_URL}/robots.txt`);
assertIncludes(robots.text, 'Sitemap:', 'robots.txt');
assertIncludes(robots.text, `${BASE_URL}/sitemap.xml`, 'robots.txt');

const sitemap = await fetchText(`${BASE_URL}/sitemap.xml`);
assertIncludes(sitemap.text, '<urlset', 'sitemap.xml');
assertIncludes(sitemap.text, `${BASE_URL}/`, 'sitemap.xml');
assertIncludes(sitemap.text, `${BASE_URL}/privacy`, 'sitemap.xml');
assertIncludes(sitemap.text, `${BASE_URL}/contact`, 'sitemap.xml');

const urlCount = (sitemap.text.match(/<url>/g) || []).length;
console.log(`Sitemap URL count: ${urlCount}`);
if (urlCount < 3) throw new Error('Sitemap has fewer than 3 URLs.');
console.log('Sitemap and robots checks passed.');
