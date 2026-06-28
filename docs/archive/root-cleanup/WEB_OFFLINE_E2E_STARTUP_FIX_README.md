# NutsNews Web Offline E2E Startup Fix

This fixes `Error: spawn npm ENOENT` in `scripts/web_offline_e2e_regression.mjs`.

Cause: the test script started Next.js with `cwd: "web"`. When the script is launched from `web/package.json`, the current directory is already `web/`, so the child process attempted to start from `web/web`. The new version resolves the web app directory from the script location and uses that absolute path.

It also adds a child-process `error` handler so startup failures fail fast with a clear message instead of crashing with an unhandled event.
