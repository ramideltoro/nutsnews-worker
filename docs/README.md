# NutsNews Documentation

Welcome to the NutsNews documentation hub.

This folder is organized by what you are trying to do: understand the product, change the platform, operate production, monitor risk, or debug problems.

---

## Fast Paths

| Goal | Start here |
| --- | --- |
| Learn what NutsNews is | [Project Overview](PROJECT.md) |
| Understand the system | [Architecture](ARCHITECTURE.md) |
| Run the platform | [Operations](OPERATIONS.md) |
| Ship a change | [Deployment Checklist](DEPLOYMENT_CHECKLIST.md) |
| Fix a production issue | [Troubleshooting](TROUBLESHOOTING.md) |
| Check cost and quota risk | [Free-Tier Guardrails](FREE_TIER_GUARDRAILS.md) |
| Work on translations | [Multi-language Summaries](MULTI_LANGUAGE_SUMMARIES.md) |
| Work on local AI | [Home Server Local AI](HOME_SERVER_LOCAL_AI.md) |
| Run regression tests | [Web Offline E2E](WEB_OFFLINE_E2E_REGRESSION_TEST.md) and [Worker Offline E2E](WORKER_OFFLINE_E2E_REGRESSION_TEST.md) |

---

## Documentation Tree

### 1. Start Here

These docs explain the product and the system at a high level.

| Doc | Use it for |
| --- | --- |
| [Project Overview](PROJECT.md) | Product story, mission, reader experience, and current status |
| [Architecture](ARCHITECTURE.md) | System components, data flow, and repository layout |
| [Operations](OPERATIONS.md) | Day-to-day operating model, admin portal, and maintenance tasks |
| [Troubleshooting](TROUBLESHOOTING.md) | Common failures, checks, and recovery steps |

### 2. Product and Reader Experience

#### Public site

| Doc | Use it for |
| --- | --- |
| [Full Archive Search](FULL_ARCHIVE_SEARCH.md) | Search behavior and archive lookup flow |
| [Multi-language Summaries](MULTI_LANGUAGE_SUMMARIES.md) | French/Japanese summaries, recovery, and validation |
| [Public Page Translations](NUTSNEWS_PUBLIC_PAGE_TRANSLATIONS.md) | About, Contact, Privacy, and settings language behavior |
| [Public Pages Theme Consistency](NUTSNEWS_PUBLIC_PAGES_THEME_CONSISTENCY.md) | Theme behavior across public pages |

#### UI and polish

| Doc | Use it for |
| --- | --- |
| [Modern Theme UI](NUTSNEWS_WEB_MODERN_THEME_UI_UPDATE.md) | Current public visual direction |
| [Cache Safety Update](NUTSNEWS_CACHE_SAFETY_UPDATE.md) | Safe public caching behavior |
| [Feed Visibility Fade Fix](NUTSNEWS_FEED_VISIBILITY_FADE_FIX.md) | Feed rendering visibility behavior |
| [Home Button Update](NUTSNEWS_HOME_BUTTON_UPDATE.md) | Public navigation home button behavior |
| [Page Fade Appear Update](NUTSNEWS_PAGE_FADE_APPEAR_UPDATE.md) | Page transition polish |

#### Admin experience

| Doc | Use it for |
| --- | --- |
| [Admin Article Reviews](ADMIN_ARTICLE_REVIEWS.md) | Accepted/rejected stories, filters, and review investigation |
| [Responsive Admin Dashboards](ADMIN_RESPONSIVE_DASHBOARDS.md) | Mobile-friendly admin dashboard patterns |
| [Home Server Dashboard](HOME_SERVER_DASHBOARD.md) | `/admin/home-server` setup and troubleshooting |

### 3. Platform and Data

#### Core platform

| Doc | Use it for |
| --- | --- |
| [Controller and Shards](CONTROLLER_AND_SHARDS.md) | Worker shard operations and manual tests |
| [Public Feed Snapshot and Edge Fallback](PUBLIC_FEED_SNAPSHOT.md) | Supabase snapshot reads, Cloudflare KV fallback, headers, admin status, and recovery checks |
| [RSS Source Quality](RSS_SOURCE_QUALITY.md) | Feed quality scoring, ranking, and source decisions |
| [Image Delivery](IMAGE_DELIVERY.md) | Thumbnails, image optimization, cache TTL, and fallbacks |
| [Performance and Resiliency](PERFORMANCE_AND_RESILIENCY.md) | Caching, pagination, indexes, sharding, and reliability |

#### Data protection and recovery

| Doc | Use it for |
| --- | --- |
| [Supabase Backup Automation](NUTSNEWS_DB_BACKUPS.md) | Home-server backups to encrypted OneDrive |
| [Supabase Restore Procedure](SUPABASE_RESTORE.md) | Restore order, SQL import, and validation queries |
| [Free-Tier Guardrails](FREE_TIER_GUARDRAILS.md) | Quota, cost, and usage warning dashboard |

### 4. AI and Automation

#### AI providers

| Doc | Use it for |
| --- | --- |
| [Home Server Local AI](HOME_SERVER_LOCAL_AI.md) | Production local AI setup with Ollama/qwen and Cloudflare Tunnel |
| [Oracle Local AI](ORACLE_LOCAL_AI.md) | Older Oracle Free Tier local AI fallback design |
| [Multi-language Summaries](MULTI_LANGUAGE_SUMMARIES.md) | Translation generation and recovery |

#### Automation and Workers

| Doc | Use it for |
| --- | --- |
| [Cloudflare KV Worker State](CLOUDFLARE_KV_WORKER_STATE.md) | KV state behavior for Workers |
| [Cloudflare Turnstile Contact Form](CLOUDFLARE_TURNSTILE_CONTACT_FORM.md) | Contact form bot protection |
| [GitHub Actions Automation](GITHUB_ACTIONS_AUTOMATION.md) | CI and automation workflow overview |
| [GitHub Wiki Automation](GITHUB_WIKI_AUTOMATION.md) | Publishing docs to the GitHub Wiki |

### 5. Operations and Release Management

#### Deploy and maintain

| Doc | Use it for |
| --- | --- |
| [Deployment Checklist](DEPLOYMENT_CHECKLIST.md) | Safe release steps for web, Worker, controller, DB, and cache |
| [Dependency Updates](DEPENDENCY_UPDATES.md) | npm audit, safe upgrades, Dependabot, and validation |
| [Platform Improvement Backlog](PLATFORM_IMPROVEMENT_ISSUE_BACKLOG.md) | Planned platform improvement issues |

#### Monitoring and incidents

| Doc | Use it for |
| --- | --- |
| [Observability](OBSERVABILITY.md) | Logs, errors, dashboards, and health checks |
| [UptimeRobot Onboarding](UPTIMEROBOT_ONBOARDING.md) | External uptime monitors |
| [Grafana Backup Monitoring](GRAFANA_BACKUP_MONITORING.md) | Backup freshness and success panels |
| [PageSpeed Insights](PAGESPEED_INSIGHTS.md) | Production performance audits |

### 6. Quality, Security, and Regression Tests

#### Quality checks

| Doc | Use it for |
| --- | --- |
| [Lighthouse CI Onboarding](LIGHTHOUSE_CI_ONBOARDING.md) | Lighthouse CI setup and thresholds |
| [PageSpeed Insights](PAGESPEED_INSIGHTS.md) | Manual production speed checks |
| [axe Playwright Accessibility CI](AXE_PLAYWRIGHT_ACCESSIBILITY_CI.md) | Accessibility regression checks |
| [SEO Structured Data Audit](SEO_STRUCTURED_DATA_AUDIT.md) | SEO and structured data review |

#### Security checks

| Doc | Use it for |
| --- | --- |
| [CodeQL Security Scan](CODEQL_SECURITY_SCAN.md) | GitHub CodeQL setup and usage |
| [Snyk Security Scan](SNYK_SECURITY_SCAN.md) | Snyk dependency and code scanning |
| [Dependency Updates](DEPENDENCY_UPDATES.md) | Safe package update routine |

#### Offline regression tests

| Doc | Use it for |
| --- | --- |
| [Web Offline E2E Regression Test](WEB_OFFLINE_E2E_REGRESSION_TEST.md) | Fully mocked public web flow test |
| [Worker Offline E2E Regression Test](WORKER_OFFLINE_E2E_REGRESSION_TEST.md) | Fully mocked Worker ingestion and translation test |

### 7. Archive and Update Notes

Older one-off implementation notes are kept out of the main reading path.

| Area | Location |
| --- | --- |
| Archived root notes | [archive/](archive/) |
| Older update notes | [updates/](updates/) |

---

## Recommended Reading Order

For a new contributor:

1. [Project Overview](PROJECT.md)
2. [Architecture](ARCHITECTURE.md)
3. [Operations](OPERATIONS.md)
4. [Deployment Checklist](DEPLOYMENT_CHECKLIST.md)
5. [Troubleshooting](TROUBLESHOOTING.md)

For production support:

1. [Operations](OPERATIONS.md)
2. [Observability](OBSERVABILITY.md)
3. [Free-Tier Guardrails](FREE_TIER_GUARDRAILS.md)
4. [Troubleshooting](TROUBLESHOOTING.md)
5. [Supabase Restore Procedure](SUPABASE_RESTORE.md)

For UI or reader-facing work:

1. [Full Archive Search](FULL_ARCHIVE_SEARCH.md)
2. [Multi-language Summaries](MULTI_LANGUAGE_SUMMARIES.md)
3. [Image Delivery](IMAGE_DELIVERY.md)
4. [Web Offline E2E Regression Test](WEB_OFFLINE_E2E_REGRESSION_TEST.md)

---

## Documentation Standards

Keep docs:

- Short at the top
- Clear before detailed
- Action-oriented
- Easy to scan
- Linked from this index when they matter
- Archived when they become one-off notes

See [Documentation Style Guide](DOCUMENTATION_STYLE_GUIDE.md) for naming, structure, and wording rules.
