#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const outputDir = path.join(repoRoot, '.wiki-build');

const excludedDirs = new Set([
  '.git',
  '.github',
  '.next',
  '.wiki-build',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.vercel',
  '.wrangler',
]);

const alwaysInclude = new Set([
  'README.md',
  'web/README.md',
]);

function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = toPosix(path.relative(repoRoot, fullPath));

    if (entry.isDirectory()) {
      if (excludedDirs.has(entry.name)) continue;
      files.push(...walk(fullPath));
      continue;
    }

    if (!entry.isFile()) continue;
    if (!entry.name.toLowerCase().endsWith('.md')) continue;

    const isMainDoc = relativePath.startsWith('docs/') || alwaysInclude.has(relativePath);
    const isProjectReadme = /(^|\/)README\.md$/i.test(relativePath);
    const isUpdateNote = /README\.md$/i.test(entry.name) || /UPDATE|ONBOARDING|CHECKLIST|AUDIT|TROUBLESHOOTING|OPERATIONS|ARCHITECTURE/i.test(entry.name);

    if (isMainDoc || isProjectReadme || isUpdateNote) {
      files.push(relativePath);
    }
  }

  return files;
}

function readTitle(relativePath) {
  const content = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
  const h1 = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (h1) return cleanTitle(h1);

  const base = path.basename(relativePath, '.md');
  const dir = path.dirname(relativePath);
  if (base.toLowerCase() === 'readme') {
    if (relativePath === 'README.md') return 'NutsNews Project Home';
    return `${titleCase(path.basename(dir))} README`;
  }
  return titleCase(base.replace(/[_-]+/g, ' '));
}

function cleanTitle(title) {
  return title
    .replace(/[`*_#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleCase(value) {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

function slugify(title, relativePath, usedSlugs) {
  const base = title
    .replace(/&/g, ' and ')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

  let slug = base || path.basename(relativePath, '.md');
  if (relativePath === 'README.md') slug = 'Project-README';

  const original = slug;
  let index = 2;
  while (usedSlugs.has(slug)) {
    slug = `${original}-${index}`;
    index += 1;
  }
  usedSlugs.add(slug);
  return slug;
}

function markdownAnchorFromHeading(heading) {
  return heading
    .toLowerCase()
    .trim()
    .replace(/<[^>]+>/g, '')
    .replace(/[`*_~]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function resolveMarkdownTarget(sourceRelativePath, target) {
  if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('#') || target.startsWith('mailto:')) {
    return null;
  }

  const [targetPathPart, anchorPart = ''] = target.split('#');
  const decodedPath = decodeURIComponent(targetPathPart || '');
  if (!decodedPath.toLowerCase().endsWith('.md')) return null;

  const sourceDir = path.dirname(sourceRelativePath);
  const normalized = toPosix(path.normalize(path.join(sourceDir, decodedPath))).replace(/^\.\//, '');
  return { path: normalized, anchor: anchorPart };
}

function rewriteLinks(content, sourceRelativePath, pathToPage) {
  return content.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, target) => {
    const resolved = resolveMarkdownTarget(sourceRelativePath, target.trim());
    if (!resolved) return match;

    const page = pathToPage.get(resolved.path);
    if (!page) return match;

    const anchor = resolved.anchor ? `#${resolved.anchor}` : '';
    return `[${label}](${page.slug}${anchor})`;
  });
}

function classify(page) {
  const p = page.relativePath;
  const t = page.title.toLowerCase();

  if (p === 'README.md' || p === 'docs/README.md' || ['PROJECT.md', 'ARCHITECTURE.md', 'OPERATIONS.md'].some((name) => p.endsWith(name))) {
    return 'Start Here';
  }
  if (/DEPLOY|CONTROLLER|SHARD|WORKER|SUPABASE|BACKUP|RESTORE|HOME_SERVER|LOCAL_AI|ORACLE|CLOUDFLARE|UPSTASH|GRAFANA|OBSERVABILITY|UPTIMEROBOT|SENTRY/i.test(p)) {
    return 'Operations and Infrastructure';
  }
  if (/PERFORMANCE|IMAGE|CACHE|SEO|LIGHTHOUSE|PAGESPEED|ACCESSIBILITY|AXE|SNYK|CODEQL|DEPENDENCY/i.test(p)) {
    return 'Quality, Performance, and Security';
  }
  if (/THEME|TRANSLATION|FADE|HOME_BUTTON|PUBLIC_PAGE|UI|RESPONSIVE|ARTICLE_REVIEW|FEED|RSS|ARCHIVE|SEARCH/i.test(p) || /theme|translation|responsive|review|feed|rss|archive|search/.test(t)) {
    return 'Product and Experience';
  }
  if (p.startsWith('web/')) return 'Web App';
  if (p.startsWith('worker/') || p.startsWith('controller/') || p.startsWith('local-ai-service/')) return 'Services';
  if (p.startsWith('reports/')) return 'Reports';
  return 'Other Documentation';
}

function sortPages(a, b) {
  const priority = [
    'README.md',
    'docs/README.md',
    'docs/PROJECT.md',
    'docs/ARCHITECTURE.md',
    'docs/OPERATIONS.md',
    'docs/DEPLOYMENT_CHECKLIST.md',
    'docs/TROUBLESHOOTING.md',
  ];
  const ai = priority.indexOf(a.relativePath);
  const bi = priority.indexOf(b.relativePath);
  if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  return a.title.localeCompare(b.title);
}

const markdownFiles = walk(repoRoot).sort();
const usedSlugs = new Set(['Home', '_Sidebar', '_Footer']);
const pages = markdownFiles.map((relativePath) => {
  const title = readTitle(relativePath);
  const slug = slugify(title, relativePath, usedSlugs);
  return { relativePath, title, slug };
});

const pathToPage = new Map(pages.map((page) => [page.relativePath, page]));
fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });

const generatedAt = new Date().toISOString();

for (const page of pages) {
  const sourcePath = path.join(repoRoot, page.relativePath);
  const rawContent = fs.readFileSync(sourcePath, 'utf8').replace(/\r\n/g, '\n');
  const body = rewriteLinks(rawContent, page.relativePath, pathToPage);
  const wikiContent = [
    `<!-- Auto-generated from ${page.relativePath}. Do not edit this wiki page directly. -->`,
    '',
    `> Source: \`${page.relativePath}\`  `,
    `> Last generated: ${generatedAt}`,
    '',
    body.trimEnd(),
    '',
  ].join('\n');

  fs.writeFileSync(path.join(outputDir, `${page.slug}.md`), wikiContent);
}

const grouped = new Map();
for (const page of [...pages].sort(sortPages)) {
  const group = classify(page);
  if (!grouped.has(group)) grouped.set(group, []);
  grouped.get(group).push(page);
}

const groupOrder = [
  'Start Here',
  'Product and Experience',
  'Operations and Infrastructure',
  'Quality, Performance, and Security',
  'Web App',
  'Services',
  'Reports',
  'Other Documentation',
];

const homeLines = [
  '<!-- Auto-generated by scripts/build_github_wiki.mjs. Do not edit directly in the wiki. -->',
  '',
  '# NutsNews Wiki',
  '',
  'Welcome to the NutsNews GitHub Wiki. This wiki is generated automatically from the Markdown documentation in the repository, so the GitHub repo stays the source of truth.',
  '',
  '## Start Here',
  '',
  '| Page | Source |',
  '| --- | --- |',
];

const starterPaths = ['README.md', 'docs/README.md', 'docs/PROJECT.md', 'docs/ARCHITECTURE.md', 'docs/OPERATIONS.md', 'docs/DEPLOYMENT_CHECKLIST.md', 'docs/TROUBLESHOOTING.md'];
for (const sourcePath of starterPaths) {
  const page = pathToPage.get(sourcePath);
  if (!page) continue;
  homeLines.push(`| [${page.title}](${page.slug}) | \`${page.relativePath}\` |`);
}

homeLines.push('', '## Full Documentation Library', '');
for (const groupName of groupOrder) {
  const groupPages = grouped.get(groupName);
  if (!groupPages?.length) continue;
  homeLines.push(`### ${groupName}`, '');
  for (const page of groupPages) {
    homeLines.push(`- [${page.title}](${page.slug}) — \`${page.relativePath}\``);
  }
  homeLines.push('');
}

homeLines.push(
  '## How This Wiki Is Maintained',
  '',
  '- Edit documentation in the repository, not directly in the wiki.',
  '- Push changes to `main` or run the `Sync GitHub Wiki` workflow manually.',
  '- The workflow rebuilds this wiki and pushes the generated pages to the repo wiki.',
  '',
  `Generated: ${generatedAt}`,
  '',
);
fs.writeFileSync(path.join(outputDir, 'Home.md'), homeLines.join('\n'));

const sidebarLines = [
  '<!-- Auto-generated by scripts/build_github_wiki.mjs. -->',
  '',
  '* [Home](Home)',
];

for (const groupName of groupOrder) {
  const groupPages = grouped.get(groupName);
  if (!groupPages?.length) continue;
  sidebarLines.push(`* **${groupName}**`);
  for (const page of groupPages) {
    sidebarLines.push(`  * [${page.title}](${page.slug})`);
  }
}
sidebarLines.push('');
fs.writeFileSync(path.join(outputDir, '_Sidebar.md'), sidebarLines.join('\n'));

const footerLines = [
  '<!-- Auto-generated by scripts/build_github_wiki.mjs. -->',
  '',
  `Generated from the NutsNews repository documentation on ${generatedAt}. Edit the repository docs, then run the wiki sync workflow.`,
  '',
];
fs.writeFileSync(path.join(outputDir, '_Footer.md'), footerLines.join('\n'));

const manifest = {
  generatedAt,
  pageCount: pages.length,
  pages: pages.map((page) => ({ title: page.title, source: page.relativePath, wikiFile: `${page.slug}.md` })),
};
fs.writeFileSync(path.join(outputDir, 'wiki-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Generated ${pages.length} wiki pages in ${path.relative(repoRoot, outputDir)}`);
