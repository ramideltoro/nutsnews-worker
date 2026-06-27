# GitHub Wiki Automation

NutsNews can publish its repository documentation into a GitHub rich wiki automatically.

The repository remains the source of truth. The wiki is generated from Markdown files in the repo and then pushed to the separate GitHub wiki Git repository.

---

## What Gets Published

The wiki generator collects Markdown documentation from:

- `README.md`
- `docs/**/*.md`
- `reports/**/*.md`
- `web/**/*.md`
- `worker/**/*.md`
- `controller/**/*.md`
- `local-ai-service/**/*.md`

It ignores build folders, dependency folders, hidden Git folders, and generated wiki output.

---

## Generated Wiki Files

The script creates:

- `Home.md` — rich wiki landing page
- `_Sidebar.md` — GitHub Wiki sidebar navigation
- `_Footer.md` — generated footer note
- one wiki page per Markdown documentation source
- `wiki-manifest.json` — generated page/source mapping for debugging

Each generated page includes a source note so you know which repository file controls it.

---

## Local Preview

From the repository root:

```bash
node scripts/build_github_wiki.mjs
ls -la .wiki-build
```

The generated wiki pages will appear in:

```text
.wiki-build/
```

Open the generated Markdown files locally to preview the output before pushing.

---

## First-Time GitHub Setup

Before the automation can publish, enable the GitHub Wiki feature:

1. Open the NutsNews GitHub repository.
2. Go to **Settings**.
3. Go to **General**.
4. Scroll to **Features**.
5. Enable **Wikis**.
6. Save if GitHub asks you to save.

After Wikis are enabled, run the workflow manually once.

---

## Manual Workflow Run

In GitHub:

1. Go to **Actions**.
2. Select **Sync GitHub Wiki**.
3. Click **Run workflow**.
4. Select the `main` branch.
5. Click **Run workflow**.

The workflow builds `.wiki-build/`, clones the repo wiki, replaces the generated files, commits, and pushes to the wiki.

---

## Automatic Sync

The workflow runs when Markdown documentation changes on `main`, including:

- root `README.md`
- `docs/**`
- `web/**/*.md`
- `worker/**/*.md`
- `controller/**/*.md`
- `local-ai-service/**/*.md`
- `reports/**/*.md`

It also runs if the wiki builder script or workflow itself changes.

---

## Editing Rule

Do not edit wiki pages directly in GitHub.

Edit the Markdown source file in the repository instead, then push to `main` or run the workflow manually.

Direct wiki edits will be overwritten by the next automation run.

---

## If Publishing Fails

Check these first:

1. **Wikis are enabled** in repository settings.
2. GitHub Actions has permission to write:
   - Repository **Settings**
   - **Actions**
   - **General**
   - **Workflow permissions**
   - choose **Read and write permissions**
3. Re-run the workflow manually.

If your repository settings block the default `GITHUB_TOKEN` from writing to the wiki, create a fine-scoped personal access token and save it as a repository secret such as `WIKI_PUSH_TOKEN`, then update the workflow remote to use that token.

For the normal NutsNews setup, the default workflow token should be tried first.
