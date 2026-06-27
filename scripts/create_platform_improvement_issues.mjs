#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import process from "node:process";

const DEFAULT_REPO = "ramideltoro/nutsnews";

const args = new Set(process.argv.slice(2));
const repoArgIndex = process.argv.findIndex((arg) => arg === "--repo");
const repo = repoArgIndex >= 0 ? process.argv[repoArgIndex + 1] : DEFAULT_REPO;
const shouldCreate = args.has("--create");
const shouldSkipLabelCreate = args.has("--skip-labels");
const DRY_RUN = !shouldCreate;

const labelDefinitions = [
  ["area:platform", "6f42c1", "Platform architecture, scale, and reliability"],
  ["area:performance", "0e8a16", "Performance, caching, Core Web Vitals, and payload size"],
  ["area:resiliency", "fbca04", "Failure handling, backups, recovery, and degradation"],
  ["area:security", "d73a4a", "Security, abuse prevention, secrets, and access control"],
  ["area:data", "1d76db", "Database, migrations, retention, and data quality"],
  ["area:ai-quality", "5319e7", "AI curation quality, prompts, evals, and translations"],
  ["area:growth", "c5def5", "Growth, discovery, newsletter, and sharing"],
  ["area:admin", "bfdadc", "Admin dashboards and internal tools"],
  ["area:operations", "fef2c0", "Runbooks, incident response, monitoring, and maintenance"],
  ["priority:critical", "b60205", "Critical platform risk or production safety item"],
  ["priority:high", "d93f0b", "High-impact improvement"],
  ["priority:medium", "fbca04", "Medium-impact improvement"],
  ["type:feature", "a2eeef", "New capability or user/admin feature"],
  ["type:maintenance", "ededed", "Maintenance, refactor, cleanup, or operational work"],
  ["type:research", "d4c5f9", "Research, design, or planning issue"],
  ["type:security", "d73a4a", "Security-focused work"],
];

const issues = [
  {
    title: "Add production readiness scorecard dashboard",
    labels: ["area:platform", "area:admin", "priority:high", "type:feature"],
    body: `## Why\nNutsNews now has many production moving parts: Vercel, Cloudflare CDN, Workers, Supabase, local AI, Sentry, Better Stack, PageSpeed, Lighthouse, axe, and GitHub Actions. A single dashboard should answer whether the platform is healthy enough to ship or promote.\n\n## Scope\n- Add an admin dashboard or generated report that summarizes build status, latest worker run, feed freshness, article API health, translation coverage, image coverage, backup freshness, and recent error count.\n- Include clear green/yellow/red status.\n- Link each failed signal to the relevant admin page, GitHub Action, or runbook.\n\n## Acceptance criteria\n- Admin can see production readiness in under 30 seconds.\n- Dashboard includes at least: public API health, latest worker/controller success, DB growth signal, translation coverage, image coverage, backup freshness, and CI status.\n- Failure states include next-step instructions.`,
  },
  {
    title: "Add end-to-end Playwright smoke tests for critical reader flows",
    labels: ["area:platform", "area:performance", "priority:high", "type:maintenance"],
    body: `## Why\nCurrent checks cover accessibility and Lighthouse, but NutsNews also needs flow-level confidence that the public product works after every change.\n\n## Scope\nCreate Playwright smoke tests for:\n- Home page loads articles.\n- Infinite scroll loads another page.\n- Language switching still loads articles.\n- Contact page renders and blocks invalid submissions.\n- Privacy and About pages render.\n- Article detail page opens from a card or known URL.\n\n## Acceptance criteria\n- Tests run in CI.\n- Screenshots/videos are uploaded on failure.\n- Tests do not require production secrets.`,
  },
  {
    title: "Add API contract tests for public article, search, sitemap, and contact endpoints",
    labels: ["area:platform", "area:data", "priority:high", "type:maintenance"],
    body: `## Why\nNutsNews depends on stable public API response shapes for web, iOS, SEO, and future clients. Contract tests prevent accidental shape changes.\n\n## Scope\nAdd tests validating:\n- /api/articles response schema.\n- Cursor and page pagination fields.\n- Language fallback fields.\n- /api/search schema and empty-state behavior.\n- sitemap.xml and robots.txt content.\n- /api/contact validation behavior without sending email.\n\n## Acceptance criteria\n- CI fails if required fields disappear or type changes.\n- Tests run against local build or mocked Supabase responses.\n- Add docs explaining expected response contracts.`,
  },
  {
    title: "Add SLOs and error budgets for reader, API, worker, and translation health",
    labels: ["area:operations", "area:resiliency", "priority:high", "type:research"],
    body: `## Why\nA solid platform needs explicit reliability targets. Without SLOs, it is hard to know whether incidents are serious or acceptable noise.\n\n## Scope\nDefine SLOs for:\n- Homepage availability and latency.\n- /api/articles success rate and latency.\n- Worker/controller successful runs.\n- Feed freshness.\n- Translation completion rate.\n- Backup freshness.\n\n## Acceptance criteria\n- Add docs with target SLOs and alert thresholds.\n- Add dashboard/report signals where possible.\n- Define what counts as critical/high/medium incidents.`,
  },
  {
    title: "Add automated post-deploy verification and rollback runbook",
    labels: ["area:operations", "area:resiliency", "priority:high", "type:maintenance"],
    body: `## Why\nDeployments should not rely on manual browsing alone. NutsNews needs repeatable post-deploy checks and a clear rollback path.\n\n## Scope\n- Expand post-deploy verification for homepage, API, search, contact, sitemap, Turnstile, and admin login redirect.\n- Document how to rollback Vercel, Worker, controller, and database changes.\n- Add GitHub Action/manual workflow to run verification against production.\n\n## Acceptance criteria\n- One command or workflow verifies production after deploy.\n- Runbook explains rollback for web, workers, and DB migrations.\n- Verification output is saved as an artifact.`,
  },
  {
    title: "Add Cloudflare cache observability dashboard and alerts",
    labels: ["area:performance", "area:operations", "priority:high", "type:feature"],
    body: `## Why\nCaching protects Supabase and improves reader speed. NutsNews needs visibility into cache hit rate, bypasses, stale responses, and accidental no-store headers.\n\n## Scope\n- Track response cache headers for home, article pages, /api/articles, sitemap, robots, and static assets.\n- Add scheduled check or dashboard showing expected vs actual cache policy.\n- Alert when /api/articles is not cacheable or cache headers regress.\n\n## Acceptance criteria\n- Report shows cache policy per key public route.\n- Regression fails CI or scheduled action.\n- Docs explain Cloudflare/Vercel cache expectations.`,
  },
  {
    title: "Add graceful degradation mode for Supabase, Worker, and local AI outages",
    labels: ["area:resiliency", "area:platform", "priority:critical", "type:feature"],
    body: `## Why\nNutsNews should stay usable during dependency failures. The public site should serve cached/frozen good news if Supabase, workers, or local AI are unavailable.\n\n## Scope\n- Define degraded modes for public feed, search, article detail, translations, and admin dashboards.\n- Use last-known-good public feed snapshot where possible.\n- Surface friendly status messages instead of empty/broken states.\n- Log degradation events.\n\n## Acceptance criteria\n- Public homepage can still render during Supabase read failure using last-known-good data or clear maintenance state.\n- Worker AI failures do not block all article ingestion indefinitely.\n- Admin pages display dependency status clearly.`,
  },
  {
    title: "Add ingestion backpressure, queue visibility, and worker lock safety",
    labels: ["area:platform", "area:resiliency", "priority:critical", "type:feature"],
    body: `## Why\nRSS ingestion, AI review, translation, image hydration, and database writes need pressure controls so spikes do not waste AI calls or overload Supabase.\n\n## Scope\n- Track queued/unreviewed article count by source/shard.\n- Add worker lock/lease safety for repeated runs.\n- Add backpressure when queue or DB size exceeds thresholds.\n- Add visibility into skipped/deferred work.\n\n## Acceptance criteria\n- Worker report shows queued, deferred, locked, retried, and processed counts.\n- Duplicate work is prevented across overlapping worker runs.\n- Cost protection and queue protection are documented.`,
  },
  {
    title: "Add canonical URL normalization and stronger article deduplication",
    labels: ["area:data", "area:platform", "priority:high", "type:feature"],
    body: `## Why\nRSS feeds often include tracking parameters, syndicated copies, and alternate URLs. Better deduplication improves quality and reduces database growth.\n\n## Scope\n- Normalize URLs by removing common tracking parameters.\n- Prefer canonical article URLs from page metadata when available.\n- Add duplicate detection using title/source/date similarity.\n- Add admin view for suspected duplicates.\n\n## Acceptance criteria\n- New ingestion avoids common duplicate variants.\n- Existing duplicate clusters can be reported.\n- Original publisher attribution remains intact.`,
  },
  {
    title: "Add source trust tiers and publisher allowlist management",
    labels: ["area:data", "area:admin", "priority:high", "type:feature"],
    body: `## Why\nNutsNews quality depends on trusted sources. A mature platform needs source tiers, review status, and promotion/disable workflows.\n\n## Scope\n- Add source trust tiers such as trusted, watchlist, experimental, disabled.\n- Show tier in feed management admin.\n- Let source quality scoring influence tier recommendations.\n- Add audit trail for source changes.\n\n## Acceptance criteria\n- Admin can see source tier and quality score together.\n- Low-quality/failing sources can be safely disabled.\n- Tier changes are logged.`,
  },
  {
    title: "Add article lifecycle policy for retention, archival, and cleanup",
    labels: ["area:data", "area:resiliency", "priority:high", "type:research"],
    body: `## Why\nSupabase free-tier limits and long-term growth require a clear article lifecycle. Not every raw/rejected/old record should live forever in hot tables.\n\n## Scope\n- Define retention for rejected reviews, raw candidates, feed health history, worker runs, translations, and published articles.\n- Add archival/export strategy for older data.\n- Add cleanup scripts with dry-run mode.\n\n## Acceptance criteria\n- Documented retention rules by table/data type.\n- Cleanup script estimates rows/size before deleting.\n- Important published records remain recoverable.`,
  },
  {
    title: "Add AI content safety regression test suite",
    labels: ["area:ai-quality", "area:platform", "priority:critical", "type:maintenance"],
    body: `## Why\nNutsNews promises uplifting stories and filters out stressful topics. Prompt/model changes need regression tests so politics, war, crime, tragedy, or money-heavy articles do not slip through.\n\n## Scope\n- Create a fixture set of accept/reject articles.\n- Test local AI and fallback model outputs against expected decisions.\n- Include edge cases: medical hardship, disaster recovery, politics-adjacent, celebrity, finance, and animal rescue stories.\n\n## Acceptance criteria\n- CI/manual script reports precision/recall against fixture set.\n- Prompt/model changes require running evals.\n- Failures include title, expected decision, actual decision, and reason.`,
  },
  {
    title: "Add prompt/model versioning and AI decision audit reports",
    labels: ["area:ai-quality", "area:observability", "priority:high", "type:feature"],
    body: `## Why\nAI behavior changes over time. NutsNews should know which prompt/model accepted or rejected each story.\n\n## Scope\n- Store prompt version and model version with AI reviews.\n- Add dashboard/report comparing acceptance rate by version.\n- Add rollback instructions for bad prompt/model changes.\n\n## Acceptance criteria\n- Each AI review can be traced to a prompt version.\n- Admin can compare current vs previous acceptance/rejection quality.\n- Docs define how to bump versions.`,
  },
  {
    title: "Add multilingual quality checks and translation fallback policy",
    labels: ["area:ai-quality", "area:data", "priority:high", "type:maintenance"],
    body: `## Why\nNutsNews supports multiple languages, and translation gaps have caused recurring issues. A platform-grade setup needs quality checks, not only backfills.\n\n## Scope\n- Validate translated summary existence, length, and language code.\n- Detect English text accidentally stored as French/Japanese.\n- Define fallback behavior when translation is missing.\n- Add daily report and admin visibility.\n\n## Acceptance criteria\n- Translation coverage report includes quality warnings.\n- Missing translations do not break the public feed.\n- Docs explain backfill and fallback behavior.`,
  },
  {
    title: "Add newsletter and daily digest foundation",
    labels: ["area:growth", "area:product", "priority:medium", "type:feature"],
    body: `## Why\nA daily digest is a natural growth and retention feature for positive news. Build the foundation carefully before adding full marketing automation.\n\n## Scope\n- Design opt-in signup flow.\n- Decide provider: Resend/Brevo/etc.\n- Add digest generation from top approved articles.\n- Include unsubscribe and privacy requirements.\n\n## Acceptance criteria\n- Documented newsletter architecture.\n- Signup does not increase spam risk.\n- Digest preview can be generated without sending.`,
  },
  {
    title: "Add no-login saved stories using local device storage",
    labels: ["area:growth", "area:product", "priority:medium", "type:feature"],
    body: `## Why\nReaders may want to keep uplifting stories without creating an account. This adds value without user-auth complexity.\n\n## Scope\n- Let readers save/unsave stories locally.\n- Add saved stories page/filter.\n- Store only minimal local data.\n- Sync behavior can be deferred.\n\n## Acceptance criteria\n- Saved stories persist across page reloads on the same device.\n- Feature works without login.\n- Privacy policy covers local storage if needed.`,
  },
  {
    title: "Add related stories, source pages, and archive discovery",
    labels: ["area:growth", "area:web", "priority:medium", "type:feature"],
    body: `## Why\nNutsNews needs better browsing beyond the first feed page. Related stories and source/archive pages improve discovery, SEO, and session depth.\n\n## Scope\n- Add source pages showing recent stories by publisher.\n- Add related stories on article detail pages.\n- Add archive browsing by month/topic/source.\n- Ensure pages are crawlable and paginated safely.\n\n## Acceptance criteria\n- Article detail pages show related stories.\n- Source/archive pages have canonical URLs and metadata.\n- Sitemap strategy scales without huge payloads.`,
  },
  {
    title: "Add homepage performance budget and bundle analyzer workflow",
    labels: ["area:performance", "area:web", "priority:high", "type:maintenance"],
    body: `## Why\nNutsNews is image-heavy and mobile-first. Performance should have hard budgets so UI changes do not silently slow the feed.\n\n## Scope\n- Add bundle analyzer or build-size report.\n- Define JS/CSS/image/LCP budgets.\n- Fail or warn in CI when budgets regress.\n- Document common performance fixes.\n\n## Acceptance criteria\n- CI produces a bundle/performance report.\n- Homepage has explicit LCP and JS budget targets.\n- Budget changes require intentional review.`,
  },
  {
    title: "Add edge-cached public feed snapshot fallback using Cloudflare KV or R2",
    labels: ["area:performance", "area:resiliency", "priority:high", "type:feature"],
    body: `## Why\nSupabase is the source of truth, but the public feed should survive temporary DB/API outages and reduce repeated reads.\n\n## Scope\n- Publish a last-known-good feed snapshot to Cloudflare KV or R2.\n- Let /api/articles or Worker edge serve it during DB failures.\n- Include version/timestamp metadata.\n- Define invalidation/update rules.\n\n## Acceptance criteria\n- Public feed can serve from edge snapshot during Supabase read failure.\n- Snapshot age is visible in response headers/admin.\n- Fallback is documented and tested.`,
  },
  {
    title: "Add secure image proxy/cache design with domain controls",
    labels: ["area:performance", "area:security", "priority:medium", "type:research"],
    body: `## Why\nCurrent image delivery accepts many publisher hosts. A mature image strategy should improve speed while reducing security and reliability risk.\n\n## Scope\n- Design optional image proxy/cache using Cloudflare Images/R2/Worker or another free/low-cost path.\n- Add domain allowlist or risk scoring for image hosts.\n- Preserve publisher attribution and avoid hotlink surprises.\n\n## Acceptance criteria\n- Design doc compares current Next Image path vs proxy/cache path.\n- Security risks and costs are documented.\n- Migration can be rolled out gradually.`,
  },
  {
    title: "Add security hardening pass for CSP, headers, admin routes, and forms",
    labels: ["area:security", "priority:critical", "type:security"],
    body: `## Why\nNutsNews now has contact forms, admin dashboards, OAuth, third-party images, Sentry, analytics, and Turnstile. Security headers and route protection should be reviewed as a platform item.\n\n## Scope\n- Add/verify Content Security Policy.\n- Review frame, image, connect, script, and style sources.\n- Verify admin no-store headers and auth boundaries.\n- Verify contact form abuse controls and Turnstile server-side verification.\n- Add security header tests.\n\n## Acceptance criteria\n- Public and admin routes have intentional security headers.\n- CSP works with required services only.\n- CI or script catches missing critical headers.`,
  },
  {
    title: "Add secrets inventory, rotation schedule, and leak response runbook",
    labels: ["area:security", "area:operations", "priority:high", "type:maintenance"],
    body: `## Why\nNutsNews uses many secrets across Vercel, GitHub Actions, Supabase, Cloudflare, Sentry, Resend, OpenAI/local AI, and PageSpeed. A clear inventory prevents confusion and speeds incident response.\n\n## Scope\n- List every secret, where it lives, what it does, and rotation frequency.\n- Document how to rotate each one.\n- Add leak response checklist.\n- Add GitHub secret scanning/dependabot security notes.\n\n## Acceptance criteria\n- Docs include an env var/secret matrix.\n- Rotation steps are actionable.\n- No secret values are committed.`,
  },
  {
    title: "Add public API and contact form rate limiting",
    labels: ["area:security", "area:platform", "priority:high", "type:feature"],
    body: `## Why\nPublic endpoints can be abused or accidentally overused. Rate limiting protects Supabase, Resend, and worker/API costs.\n\n## Scope\n- Rate limit /api/articles, /api/search, and /api/contact appropriately.\n- Use Upstash Redis, Cloudflare Rules, Turnstile, or lightweight edge rate limits.\n- Add response headers for limit status where appropriate.\n- Ensure normal readers are not harmed.\n\n## Acceptance criteria\n- Contact spam is throttled.\n- Search/API abuse is throttled.\n- Limits are documented and observable.`,
  },
  {
    title: "Add database migration and schema drift checks",
    labels: ["area:data", "area:operations", "priority:high", "type:maintenance"],
    body: `## Why\nThe database schema is central to NutsNews. Schema drift between local migrations and Supabase production creates hard-to-debug failures.\n\n## Scope\n- Add CI/manual check for migration order and local reset.\n- Add schema drift detection using Supabase CLI or SQL schema dump.\n- Document safe migration process and rollback expectations.\n\n## Acceptance criteria\n- CI or manual workflow validates migrations.\n- Docs explain how to apply and verify migrations.\n- Drift is reported before production changes.`,
  },
  {
    title: "Add automated backup integrity checks and restore fire drills",
    labels: ["area:data", "area:resiliency", "priority:critical", "type:maintenance"],
    body: `## Why\nBackups only matter if they restore. NutsNews should regularly prove that backups are usable.\n\n## Scope\n- Validate backup artifacts exist, are fresh, and are non-empty.\n- Periodically restore to a disposable/local database.\n- Run validation SQL after restore.\n- Report results to GitHub Actions/admin docs.\n\n## Acceptance criteria\n- Restore validation can be run with one command.\n- Latest successful restore check is visible.\n- Failure includes next steps.`,
  },
  {
    title: "Add incident response policy, severity levels, and alert routing",
    labels: ["area:operations", "area:resiliency", "priority:high", "type:maintenance"],
    body: `## Why\nAs monitoring grows, alerts need severity and ownership. Otherwise every alert feels equally urgent.\n\n## Scope\n- Define SEV1/SEV2/SEV3 for NutsNews.\n- Map alerts to severity: site down, API failing, worker stale, DB full, backups stale, translation gaps, image failures.\n- Add incident checklist and postmortem template.\n\n## Acceptance criteria\n- Docs explain what to do for each severity.\n- Alerts have clear thresholds and channels.\n- Post-incident review template exists.`,
  },
  {
    title: "Add admin audit log for sensitive operational changes",
    labels: ["area:admin", "area:security", "priority:medium", "type:feature"],
    body: `## Why\nAdmin actions such as disabling feeds, changing source trust, reviewing articles, or triggering backfills should be traceable.\n\n## Scope\n- Add audit log table for admin actions.\n- Log actor, action, target, before/after values, and timestamp.\n- Show recent audit events in admin.\n\n## Acceptance criteria\n- Sensitive admin actions are logged.\n- Audit log is protected and no-store.\n- Docs explain retention and privacy.`,
  },
  {
    title: "Add publisher attribution and content compliance review",
    labels: ["area:operations", "area:growth", "priority:medium", "type:research"],
    body: `## Why\nNutsNews links to original publishers and summarizes articles. A platform-grade product should have clear attribution and content-use guardrails.\n\n## Scope\n- Review source attribution on cards, detail pages, social previews, and future newsletter.\n- Document summary/excerpt limits and publisher link behavior.\n- Add source opt-out/removal workflow.\n\n## Acceptance criteria\n- Attribution rules are documented.\n- Contact/removal process exists.\n- Future digest/social features follow the same policy.`,
  },
  {
    title: "Add privacy-first analytics and consent architecture",
    labels: ["area:security", "area:growth", "priority:medium", "type:research"],
    body: `## Why\nNutsNews may use analytics for article clicks, categories, themes, iOS/web usage, and growth. The platform should keep analytics privacy-friendly from the start.\n\n## Scope\n- Define what events are allowed and disallowed.\n- Decide analytics provider and retention.\n- Update privacy policy as needed.\n- Ensure analytics do not collect sensitive personal data.\n\n## Acceptance criteria\n- Analytics event taxonomy is documented.\n- Privacy policy reflects chosen tools.\n- Tracking can be disabled or minimized.`,
  },
  {
    title: "Add sitemap scaling strategy for large article archive",
    labels: ["area:web", "area:growth", "priority:medium", "type:feature"],
    body: `## Why\nAs NutsNews grows, one sitemap may become too large or too slow. SEO needs a scalable sitemap strategy.\n\n## Scope\n- Add sitemap index if article count grows.\n- Split article sitemaps by date/month or pages.\n- Ensure canonical URLs and lastmod are accurate.\n- Include public pages and archive/source pages when added.\n\n## Acceptance criteria\n- Sitemap generation remains fast at large article counts.\n- Google/Bing can discover important pages.\n- SEO audit checks sitemap health.`,
  },
  {
    title: "Add cost forecasting and free-tier guardrails dashboard",
    labels: ["area:operations", "area:data", "priority:high", "type:feature"],
    body: `## Why\nNutsNews is designed around free-tier cloud services. Cost and quota risks should be visible before limits are hit.\n\n## Scope\n- Track DB size, egress, AI calls/tokens, Worker invocations, Redis/KV usage, email sends, and PageSpeed/API usage where available.\n- Add thresholds and warnings.\n- Document what to do when each limit is approached.\n\n## Acceptance criteria\n- Admin/report shows current quota risk.\n- Warnings appear before hard limits.\n- Runbook includes mitigation steps.`,
  },
  {
    title: "Add staging environment and production data safety rules",
    labels: ["area:platform", "area:operations", "priority:high", "type:maintenance"],
    body: `## Why\nFeature work, database migrations, and worker changes should be tested without risking production data or live feeds.\n\n## Scope\n- Define staging Vercel environment and optional staging Supabase project.\n- Add staging worker/controller configuration.\n- Prevent staging jobs from writing to production by accident.\n- Document env var differences.\n\n## Acceptance criteria\n- Staging deploy can exercise key paths safely.\n- Secrets are separated by environment.\n- Docs explain how to promote from staging to production.`,
  },
  {
    title: "Add feature flag system for risky launches",
    labels: ["area:platform", "area:resiliency", "priority:medium", "type:feature"],
    body: `## Why\nNutsNews changes quickly. Feature flags make it safer to launch or rollback new UI, AI behavior, feeds, caching, and admin tools without emergency deploys.\n\n## Scope\n- Choose simple env-based, Supabase-based, or Cloudflare KV-based flags.\n- Add flags for risky reader-facing and worker features.\n- Add admin/read-only flag visibility.\n\n## Acceptance criteria\n- At least one public feature and one worker behavior can be toggled safely.\n- Flags are documented.\n- Defaults are safe when flag storage fails.`,
  },
];

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
  });

  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    const stdout = result.stdout?.trim();
    throw new Error(`${command} ${commandArgs.join(" ")} failed${stderr ? `\n${stderr}` : ""}${stdout ? `\n${stdout}` : ""}`);
  }

  return result.stdout ?? "";
}

function normalizeTitle(title) {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

function ensureGh() {
  const check = spawnSync("gh", ["--version"], { encoding: "utf8", stdio: "pipe" });
  if (check.status !== 0) {
    throw new Error("GitHub CLI `gh` is required. Install it and run `gh auth login` first.");
  }
}

function getExistingIssueTitles() {
  const output = run("gh", [
    "issue",
    "list",
    "--repo",
    repo,
    "--state",
    "all",
    "--limit",
    "1000",
    "--json",
    "title,number,state",
  ]);
  const parsed = JSON.parse(output || "[]");
  return new Map(parsed.map((issue) => [normalizeTitle(issue.title), issue]));
}

function ensureLabels() {
  if (shouldSkipLabelCreate) {
    console.log("Skipping label creation because --skip-labels was provided.");
    return;
  }

  for (const [name, color, description] of labelDefinitions) {
    const result = spawnSync(
      "gh",
      ["label", "create", name, "--repo", repo, "--color", color, "--description", description],
      { encoding: "utf8", stdio: "pipe" },
    );

    if (result.status === 0) {
      console.log(`Created label: ${name}`);
      continue;
    }

    const message = `${result.stderr ?? ""}${result.stdout ?? ""}`;
    if (/already exists/i.test(message)) {
      console.log(`Label exists: ${name}`);
      continue;
    }

    console.warn(`Could not create label ${name}. Continuing. ${message.trim()}`);
  }
}

function createIssue(issue) {
  const args = [
    "issue",
    "create",
    "--repo",
    repo,
    "--title",
    issue.title,
    "--body",
    `${issue.body}\n\n---\nGenerated from the NutsNews platform improvement backlog scan.`,
  ];

  if (issue.labels?.length) {
    args.push("--label", issue.labels.join(","));
  }

  return run("gh", args).trim();
}

function main() {
  ensureGh();

  console.log(`Repository: ${repo}`);
  console.log(`Mode: ${DRY_RUN ? "dry run" : "create issues"}`);
  console.log(`Planned issue count: ${issues.length}`);

  const existing = getExistingIssueTitles();
  const toCreate = [];
  const skipped = [];

  for (const issue of issues) {
    const found = existing.get(normalizeTitle(issue.title));
    if (found) {
      skipped.push({ title: issue.title, number: found.number, state: found.state });
    } else {
      toCreate.push(issue);
    }
  }

  if (skipped.length) {
    console.log("\nAlready exists, skipping:");
    for (const issue of skipped) {
      console.log(`- #${issue.number} ${issue.title} (${issue.state})`);
    }
  }

  console.log(`\nIssues to create: ${toCreate.length}`);
  for (const issue of toCreate) {
    console.log(`- ${issue.title} [${issue.labels.join(", ")}]`);
  }

  if (DRY_RUN) {
    console.log("\nDry run only. Re-run with --create to create issues:");
    console.log(`node scripts/create_platform_improvement_issues.mjs --repo ${repo} --create`);
    return;
  }

  ensureLabels();

  console.log("\nCreating issues...");
  for (const issue of toCreate) {
    const url = createIssue(issue);
    console.log(`Created: ${issue.title}`);
    console.log(`  ${url}`);
  }

  console.log("\nDone.");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
