# UptimeRobot Documentation Update

This update adds a dedicated UptimeRobot onboarding guide for NutsNews.

## Files Updated

```text
README.md
docs/README.md
docs/OBSERVABILITY.md
docs/UPTIMEROBOT_ONBOARDING.md
docs/updates/README_UPTIMEROBOT_ONBOARDING_UPDATE.md
```

## What Changed

* Added a step-by-step UptimeRobot onboarding runbook.
* Documented the recommended first monitors:
  * `https://www.nutsnews.com`
  * homepage keyword check for `NutsNews`
  * `https://www.nutsnews.com/api/articles?limit=1`
  * `https://www.nutsnews.com/privacy`
  * `https://www.nutsnews.com/contact`
* Added a safety warning not to monitor Worker/controller refresh URLs that can trigger ingestion or writes.
* Linked the new guide from the root README, docs index, and observability guide.

## Copy Target

Project path used for this patch:

```text
/Users/ramideltoro/WebstormProjects/nutsnews3
```
