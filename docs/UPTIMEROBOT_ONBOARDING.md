# UptimeRobot Onboarding

This guide explains how to onboard NutsNews to UptimeRobot without accidentally triggering article refresh work.

Use UptimeRobot as an external availability layer alongside Better Stack, Sentry, Grafana Cloud, Vercel, Cloudflare, Supabase, and the protected NutsNews admin dashboards.

---

## Goal

UptimeRobot should answer these questions quickly:

```text
Is the public website reachable?
Did the homepage render real NutsNews content?
Is the public article API responding?
Are important public compliance pages online?
```

It should **not** run the Cloudflare Worker refresh pipeline.

---

## Recommended First Monitors

Create these monitors first.

| Monitor name | Type | URL | What it proves |
| --- | --- | --- | --- |
| `NutsNews Website` | HTTP(s) | `https://www.nutsnews.com` | The public website is reachable |
| `NutsNews Homepage Content` | Keyword | `https://www.nutsnews.com` | The homepage returned expected NutsNews HTML |
| `NutsNews Articles API` | HTTP(s) or API monitor | `https://www.nutsnews.com/api/articles?limit=1` | The public article feed endpoint responds |
| `NutsNews Privacy Page` | HTTP(s) | `https://www.nutsnews.com/privacy` | The privacy page required for app review is reachable |
| `NutsNews Contact Page` | HTTP(s) | `https://www.nutsnews.com/contact` | The public contact page is reachable |

Optional later monitors:

| Monitor name | Type | URL | Notes |
| --- | --- | --- | --- |
| `NutsNews Health Route` | HTTP(s) | `https://www.nutsnews.com/api/health` | Add this only if a lightweight health route exists |
| `NutsNews Worker Health` | HTTP(s) | `https://nutsnews-worker-0.nutsnews.workers.dev/health` | Add this only after adding a safe Worker `/health` route |
| `NutsNews Controller Health` | HTTP(s) | `https://nutsnews-controller.nutsnews.workers.dev/health` | Add this only after adding a safe controller `/health` route |

---

## Important Safety Rule

Do **not** monitor refresh-triggering Worker URLs as normal uptime checks.

Avoid adding monitors like this:

```text
https://nutsnews-worker-0.nutsnews.workers.dev/?limit=1
https://nutsnews-controller.nutsnews.workers.dev/?shard=0
```

Those URLs can run ingestion, AI review, translations, image hydration, Supabase writes, or controller orchestration. UptimeRobot checks would turn into repeated production jobs.

Only monitor Worker or controller endpoints after adding safe, read-only `/health` routes that return a small static response and do not mutate data.

---

## Step 1: Create the Account

1. Go to UptimeRobot.
2. Create or log in to the account.
3. Open the dashboard.
4. Go to the monitors section.
5. Choose **New Monitor** or **Add New Monitor**.

Official setup reference:

```text
https://help.uptimerobot.com/en/articles/11358364-how-to-create-your-first-monitor-on-uptimerobot-quick-setup-guide
```

---

## Step 2: Add the Public Website Monitor

Create the first monitor:

| Field | Value |
| --- | --- |
| Type | HTTP(s) |
| Friendly name | `NutsNews Website` |
| URL | `https://www.nutsnews.com` |
| Method | Default is fine |
| Alert contacts | Email and mobile push recommended |

Save the monitor and confirm it becomes `Up`.

This monitor tells you whether the public website is reachable from outside the platform.

---

## Step 3: Add the Homepage Keyword Monitor

Create a keyword monitor:

| Field | Value |
| --- | --- |
| Type | Keyword |
| Friendly name | `NutsNews Homepage Content` |
| URL | `https://www.nutsnews.com` |
| Keyword | `NutsNews` |
| Alert behavior | Alert when keyword is missing / does not exist |
| Method | GET, if UptimeRobot shows the option |

Good fallback keywords:

```text
NutsNews
Positive News, Simplified
```

Prefer a stable phrase that should always appear when the homepage renders correctly.

This catches cases where the page returns `200 OK` but the rendered content is broken, blank, or replaced by an unexpected error shell.

Official keyword reference:

```text
https://uptimerobot.com/keyword-monitoring/
```

---

## Step 4: Add the Public Articles API Monitor

Create a monitor for the public feed endpoint:

| Field | Value |
| --- | --- |
| Type | HTTP(s), or API Monitoring if available on the current plan |
| Friendly name | `NutsNews Articles API` |
| URL | `https://www.nutsnews.com/api/articles?limit=1` |
| Method | GET preferred |
| Alert contacts | Email and mobile push recommended |

Why GET is preferred here:

* The public articles endpoint is meant to be read with GET.
* A GET check verifies the real public API response path.
* A HEAD-only check may not fully exercise the same path depending on framework/runtime behavior.

Official UptimeRobot notes:

```text
https://uptimerobot.com/blog/introducing-http-method-selection-headgetpostputpatchdelete/
https://help.uptimerobot.com/en/articles/13628553-uptimerobot-api-monitoring
```

---

## Step 5: Add Public Compliance Page Monitors

Create simple HTTP(s) monitors:

| Friendly name | URL |
| --- | --- |
| `NutsNews Privacy Page` | `https://www.nutsnews.com/privacy` |
| `NutsNews Contact Page` | `https://www.nutsnews.com/contact` |

These are useful because App Store review, users, and future support workflows may depend on those pages being reachable.

---

## Step 6: Add Alert Contacts

Recommended starting alerts:

| Channel | Recommendation |
| --- | --- |
| Email | Enable |
| Mobile push | Enable through the UptimeRobot mobile app |
| Slack / Discord | Optional |
| Webhook | Optional later |

Keep the first setup simple: email plus mobile push is enough.

Official notification channel reference:

```text
https://help.uptimerobot.com/en/articles/11360953-uptimerobot-personal-notification-channels-setup-guide
```

---

## Step 7: Optional Status Page

After the monitors are stable, create a public or private status page named:

```text
NutsNews Status
```

Recommended monitors to show:

```text
NutsNews Website
NutsNews Articles API
NutsNews Privacy Page
NutsNews Contact Page
```

Do not expose internal Worker/controller refresh URLs on a public status page.

Official status page reference:

```text
https://uptimerobot.com/knowledge-hub/monitoring/building-a-status-page-ultimate-guide/
```

---

## Validation Commands

Run these from a terminal before or after creating monitors.

### Website

```bash
curl -I "https://www.nutsnews.com/"
```

Expected: a successful HTTP status such as `200` or a valid redirect chain that ends successfully.

### Homepage content

```bash
curl -s "https://www.nutsnews.com/" | grep -i "NutsNews"
```

Expected: at least one match.

### Articles API

```bash
curl -s "https://www.nutsnews.com/api/articles?limit=1"
```

Expected: a JSON response from the public article API.

### Privacy page

```bash
curl -I "https://www.nutsnews.com/privacy"
```

Expected: successful HTTP status.

### Contact page

```bash
curl -I "https://www.nutsnews.com/contact"
```

Expected: successful HTTP status.

---

## Incident Triage

When UptimeRobot alerts, use this order:

1. Open `https://www.nutsnews.com` in a browser.
2. Check Vercel deployment status.
3. Check Cloudflare status, DNS, redirects, and cache behavior.
4. Check Better Stack logs for `nutsnews-web` errors.
5. Check Sentry for frontend/runtime errors.
6. Check Supabase if `/api/articles?limit=1` is down but the static site is up.
7. Check Worker/controller dashboards only if the feed is stale or new articles are not arriving.

Use these docs next:

```text
docs/OBSERVABILITY.md
docs/TROUBLESHOOTING.md
docs/CONTROLLER_AND_SHARDS.md
docs/PUBLIC_FEED_SNAPSHOT.md
```

---

## Current Recommendation

For the first UptimeRobot setup, use exactly this list:

```text
1. HTTP(s): https://www.nutsnews.com
2. Keyword: https://www.nutsnews.com, keyword: NutsNews, alert when missing
3. HTTP(s) or API GET: https://www.nutsnews.com/api/articles?limit=1
4. HTTP(s): https://www.nutsnews.com/privacy
5. HTTP(s): https://www.nutsnews.com/contact
```

Add Worker/controller health monitors later only after safe `/health` endpoints exist.
