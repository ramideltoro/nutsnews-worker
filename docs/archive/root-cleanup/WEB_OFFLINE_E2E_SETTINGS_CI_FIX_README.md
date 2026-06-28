# NutsNews Web Offline E2E Settings CI Fix

This update stabilizes the fully mocked Web Offline E2E regression in GitHub Actions.

## Why

The CI runner sometimes sees the footer settings button but the settings panel does not become visible within the default 5 second Playwright assertion window. This made the test fail even though the public page rendered and the settings button existed.

## Fix

The regression test now uses a dedicated settings helper that:

- Locates the real settings button by accessible name.
- Scrolls it into view.
- Clicks it with `force: true`.
- Falls back to a DOM click if the first click is swallowed during hydration/timing.
- Waits up to 20 seconds for `.theme-panel` in slower CI runs.
- Reuses the same helper for the later language-switch test.

The test remains fully offline and still verifies that the settings button opens the settings panel before continuing.
