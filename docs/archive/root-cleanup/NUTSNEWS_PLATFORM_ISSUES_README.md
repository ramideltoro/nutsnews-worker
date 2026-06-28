# NutsNews Platform Improvement Issues Bundle

This bundle adds a script that creates a platform-grade backlog of GitHub issues for NutsNews.

## Files added

```text
scripts/create_platform_improvement_issues.mjs
docs/PLATFORM_IMPROVEMENT_ISSUE_BACKLOG.md
```

## Copy into your project

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews3

rm -rf /tmp/nutsnews-platform-issues-bundle
unzip -o ~/Downloads/nutsnews-platform-issues-bundle.zip -d /tmp/nutsnews-platform-issues-bundle
rsync -av /tmp/nutsnews-platform-issues-bundle/ ./
```

## Preview the issues first

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews3
node scripts/create_platform_improvement_issues.mjs --repo ramideltoro/nutsnews
```

## Create the issues

```bash
node scripts/create_platform_improvement_issues.mjs --repo ramideltoro/nutsnews --create
```

## Commit the script and docs

```bash
git status
git add scripts/create_platform_improvement_issues.mjs docs/PLATFORM_IMPROVEMENT_ISSUE_BACKLOG.md NUTSNEWS_PLATFORM_ISSUES_README.md
git commit -m "Add platform improvement issue generator"
git push
```

## Notes

- The script creates labels if they are missing.
- It skips issues that already exist by exact title.
- If label creation fails because of permissions, run with `--skip-labels` and create labels later.
