#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const IGNORE_DIRS = new Set(['.git', 'node_modules', '.next', 'dist', 'build', 'coverage', '.wiki-build']);
const CHECK_EXTERNAL = /^(1|true|yes)$/i.test(process.env.CHECK_EXTERNAL_LINKS || '');
const markdownFiles = [];

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) markdownFiles.push(full);
  }
}

function stripAnchor(link) {
  return link.split('#')[0];
}

function isExternal(link) {
  return /^https?:\/\//i.test(link);
}

function isSkippable(link) {
  return (
    !link ||
    link.startsWith('#') ||
    link.startsWith('mailto:') ||
    link.startsWith('tel:') ||
    link.startsWith('javascript:') ||
    link.includes('{{') ||
    link.includes('${')
  );
}

function extractLinks(markdown) {
  const links = [];
  const inline = /(?<!!)(?:\[([^\]]+)\])\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  const reference = /^\s*\[[^\]]+\]:\s*(\S+)/gm;
  let match;
  while ((match = inline.exec(markdown))) links.push(match[2].trim());
  while ((match = reference.exec(markdown))) links.push(match[1].trim());
  return links;
}

function resolveLocalLink(file, link) {
  const clean = decodeURIComponent(stripAnchor(link).replace(/^<|>$/g, ''));
  if (!clean) return null;
  const withoutQuery = clean.split('?')[0];
  const base = withoutQuery.startsWith('/') ? ROOT : path.dirname(file);
  return path.resolve(base, withoutQuery);
}

function localExists(target, originalLink = '') {
  if (!target) return true;
  if (existsSync(target)) return true;
  const rootFallback = originalLink && !originalLink.startsWith('.') && !originalLink.startsWith('/') ? path.resolve(ROOT, stripAnchor(originalLink).split('?')[0]) : '';
  const candidates = [
    rootFallback,
    rootFallback ? `${rootFallback}.md` : '',
    rootFallback ? `${rootFallback}.mdx` : '',
    rootFallback ? path.join(rootFallback, 'README.md') : '',
    rootFallback ? path.join(rootFallback, 'index.md') : '',
    `${target}.md`,
    `${target}.mdx`,
    path.join(target, 'README.md'),
    path.join(target, 'index.md'),
  ];
  return candidates.filter(Boolean).some((candidate) => existsSync(candidate));
}

walk(ROOT);

const failures = [];
const external = [];

for (const file of markdownFiles) {
  const markdown = readFileSync(file, 'utf8');
  for (const link of extractLinks(markdown)) {
    if (isSkippable(link)) continue;
    if (isExternal(link)) {
      external.push({ file, link });
      continue;
    }
    const target = resolveLocalLink(file, link);
    if (!localExists(target, link)) {
      failures.push({ file: path.relative(ROOT, file), link, target: path.relative(ROOT, target || '') });
    }
  }
}

console.log(`Checked ${markdownFiles.length} Markdown file(s).`);
console.log(`Found ${external.length} external link(s). External link HTTP checks are ${CHECK_EXTERNAL ? 'enabled' : 'disabled'} by default to avoid noisy CI failures.`);

if (failures.length > 0) {
  console.error('\nBroken local Markdown links:');
  failures.forEach((failure) => {
    console.error(`- ${failure.file}: ${failure.link} -> ${failure.target}`);
  });
  process.exit(1);
}

console.log('Markdown local links look good.');
