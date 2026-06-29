# Greek Language Hydration Lint Fix

This update keeps the ThemeSwitcher hydration-safe without violating the React hooks lint rule.

## What changed

- Replaced direct language `setState` in `useEffect` with `useSyncExternalStore`.
- The server and first client render still use the default language snapshot, preventing hydration mismatches.
- After hydration, the client reads the persisted language from localStorage and updates the UI.
- Language changes still sync through the existing `nutsnews:language-change` event and cross-tab `storage` events.

## Files changed

- `web/app/components/ThemeSwitcher.tsx`
