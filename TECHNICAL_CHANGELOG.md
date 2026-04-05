# Technical Changelog

Detailed technical changes made during codebase review and improvement session.

## Session Date: 2026-04-04

## Project Ordering and Default Selection (SPEC-PROJ-001)

### 30. Custom Project Reordering (Drag-and-Drop)
**Files Changed:**
- `src/components/ProjectSwitcher.tsx`
- `src/hooks/useProjects.tsx`
- `src/types/projectPreferences.ts`

**Changes:**
- Integrated `@dnd-kit` into the `ProjectSwitcher` component to support custom drag-and-drop reordering of the project list.
- Implemented `SortableProjectItem` with full accessibility support, including `aria-label`, focus management, and keyboard navigation (Enter/Space to select).
- Created a shared `sortProjectsByPreferences` helper in `useProjects.tsx` to ensure consistent ordering across standalone and Supabase modes.
- Added a `proj.dragToReorder` localization key for the new drag handle button.

### 31. Default Project Selection (Star Feature)
**Files Changed:**
- `src/components/ProjectSwitcher.tsx`
- `src/hooks/useProjects.tsx`
- `src/lib/i18n.ts`

**Changes:**
- Implemented a "Star" button in the project list allowing users to mark a project as their default.
- Default projects are automatically selected upon a fresh sign-in (when the active project cache is empty).
- Added `proj.default`, `proj.setDefault`, `proj.removeDefault`, and `proj.defaultSet` localization keys with parameter interpolation for project names.

### 32. Purely Local Preference Management
**Files Changed:**
- `src/hooks/useProjects.tsx`
- `src/types/projectPreferences.ts`

**Changes:**
- Migrated all project preference storage (ordering and default status) to a unified `localStorage` key (`project_preferences`).
- Designed a `LocalProjectPreference` interface with optional `display_order` to handle "no order" states without forcing incorrect defaults.
- Eliminated all Supabase/server-side dependencies for project preferences to ensure high performance, full offline support, and zero race conditions during the initial load/auth cycle.

### 33. Robust Project Restoration Guard
**Files Changed:**
- `src/hooks/useProjects.tsx`

**Changes:**
- Implemented a `hasRestored` state guard and a comprehensive `isStillAuthenticating` check (waiting for `authLoading` and `user` to settle).
- Refined the `activeProject` restoration logic to prioritize:
    1.  **Cache (Last Active):** Persists the current project across page refreshes.
    2.  **Default (Starred):** Falls back to the starred project on a new sign-in or when the cache is empty.
    3.  **Fallback (First Project):** Ensures a project is always selected if others fail.
- Fixed a critical race condition where the active project would be cleared during the initial render before the user's project list was fetched.
- Integrated `isFetched` and `status` from TanStack Query into the cleanup guard to prevent accidental clearing during background refreshes or query key changes.


## Administrative UX & Pagination Refinement

### 24. Transaction List Pagination Guard & Auto-Advance
**Files Changed:**
- `src/components/TransactionList.tsx`

**Changes:**
- Implemented `isWaitingForNextPage` state and `totalPagesBeforeFetchRef` to track pagination state across async fetches.
- Added `useEffect` hook to automatically advance to the next page index once `isFetchingNextPage` becomes false and the total page count has increased, resolving a long-standing race condition where users had to manually click "Next" twice.
- Integrated `fetchNextPage` trigger directly into the `handleNextPage` logic, allowing the "Next" button to act as a "Load More" trigger when at the end of the current local dataset.
- Added a strict `isFetchingNextPage` guard to both the `handleNextPage` callback and the `Button`'s `disabled` prop to prevent duplicate network requests and UI flickering.
- Simplified list animations by removing staggered item-level `framer-motion` variants in favor of a single `animate-fade-in` class on the container, significantly reducing layout shift and flickering during rapid navigation.

### 25. Admin Page Structural Reorganization
**Files Changed:**
- `src/pages/AdminPage.tsx`

**Changes:**
- Reordered the `main` content area to place "Project Setup" (Export/Import) at the very top, followed by "Project Info" (Currency/Deletion).
- This shift prioritizes high-impact project-level administrative tasks that were previously buried at the bottom of the page.
- Maintained existing `isOwner` and `isStandalone` guards while flattening the section hierarchy for better visual flow.

### 26. Unified Administrative Confirmation Flow
**Files Changed:**
- `src/pages/AdminPage.tsx`

**Changes:**
- Replaced custom `AlertDialog` components for specific deletions (members, categories, custom columns) with standardized `window.confirm()` calls.
- Leveraged existing `i18n` translation strings to provide localized confirmation messages (English and Korean).
- This change ensures a more reliable and consistent administrative experience across different browsers and reduced component-level state complexity.

### 27. Standalone Mode Role Simulation Guard
**Files Changed:**
- `src/pages/AdminPage.tsx`

**Changes:**
- Gated the membership role simulation buttons behind a `!isStandalone` check.
- Prevents confusing UX where users could attempt to "simulate" roles in a local-only environment where multi-user collaboration is not supported.

## Session Date: 2026-04-01

## Workflow & Branding Automation

### 20. Parameterized Build Environment
**Files Changed:**
- `index.html`
- `vite.config.ts`
- `.github/workflows/deploy.yml`

**Changes:**
- Replaced hardcoded title and icon links in `index.html` with custom placeholders (`__VITE_APP_TITLE__`, `__VITE_APP_ICON_SUFFIX__`).
- Implemented `html-transform` plugin in `vite.config.ts` to perform safe string replacement during build.
- Added `existsSync` validation in Vite config to automatically fallback to default assets if environment-specific icons (e.g., `-preview`) are missing.
- Updated GitHub Workflow to inject environment-specific branding:
  - **PRs**: "재정부 (Preview)" + `-preview` icon suffix.
  - **Main**: "우리교회 재정부" + default icons.

### 21. Standalone Security Hardening
**Files Changed:**
- `src/pages/AdminPage.tsx`
- `src/components/UserMenu.tsx`

**Changes:**
- Gated administrative sections (`Members`, `Invites`, `Archive`, `DB Stats`, `Storage Stats`) behind `!isStandalone` check.
- Restricted `Change Password` menu item to cloud-authenticated users only.
- Refactored `handleCurrencyChange` to use `updateProject` hook, enabling local currency persistence in standalone mode which previously failed due to direct Supabase calls.

### 22. Enhanced Localization & UI Integrity
**Files Changed:**
- `src/lib/i18n.ts`
- `src/components/PWAInstructions.tsx`
- `src/components/ProjectSwitcher.tsx`

**Changes:**
- Added missing translation keys for PWA instructions (`pwa.iosInstructions`, etc.) and standalone-specific dashboard descriptions.
- Removed all `|| "Fallback"` patterns from `t()` calls in PWA and Admin components to rely exclusively on the i18n registry.
- Refactored `ProjectSwitcher` project list items from `<button>` to `<div>` with `role="button"` to resolve a critical React nesting warning ("<button> cannot appear as a descendant of <button>").

### 23. Project Management Refinement
**Files Changed:**
- `src/hooks/useProjects.tsx`
- `src/components/ProjectSwitcher.tsx`

**Changes:**
- Implemented `updateProject` mutation support for local storage projects.
- Added inline renaming functionality to the Project Switcher.
- Optimized pencil icon visibility for mobile (always visible for owners) and added logic to hide it when simulating non-owner roles.

## Standalone & Offline Refinements

### 16. Aggressive State Clearing on Logout
**Files Changed:**
- `src/hooks/useAuth.tsx`

**Changes:**
- Updated `signOut` to clear all Supabase-related keys from `localStorage` (looping through `sb-` prefixes).
- Explicitly set `user` and `session` state to `null` *before* the async Supabase call.
- Ensures immediate UI redirection to `/auth` and prevents session restoration if the network request fails or times out.

### 17. Deterministic Local Pagination
**Files Changed:**
- `src/hooks/useTransactions.tsx`

**Changes:**
- Implemented `safeReadLocalTransactions` helper with JSON validation.
- Refactored local pagination to use a stable `lastId` cursor instead of array indices.
- Added explicit sorting (`transaction_date DESC`, `created_at DESC`, `id DESC`) to local data before slicing to match Supabase behavior and prevent skips/duplicates during infinite scroll.

### 18. Network Isolation & Guarding
**Files Changed:**
- `src/hooks/useProjects.tsx`
- `src/hooks/useCategories.tsx`
- `src/hooks/useTransactions.tsx`
- `src/hooks/useColumnHeaders.tsx`
- `src/hooks/useCustomColumns.tsx`
- `src/hooks/useUserRole.tsx`
- `src/hooks/useProjectMembers.tsx`
- `src/pages/AdminPage.tsx`

**Changes:**
- Applied `networkMode: "always"` to critical queries to ensure they resolve immediately from cache or defaults in standalone/offline modes.
- Added `isStandalone` and `"standalone-user"` guards to prevent `400 Bad Request` errors when the mock user ID is used in Supabase REST calls.
- Gated statistics fetching and member management effects in `AdminPage`.

### 19. Header & UserMenu Consolidation
**Files Changed:**
- `src/pages/Dashboard.tsx`
- `src/components/UserMenu.tsx`
- `src/components/ShortcutSettings.tsx`

**Changes:**
- Migrated Theme, Locale, PIN, and Keyboard Shortcut controls into the `UserMenu` dropdown.
- Converted `ShortcutSettings` from a `Popover` to a `Dialog` for better compatibility within dropdown menus.
- Centered the main `Offline` indicator in the header status bar.
- Implemented conditional visibility for the admin gear based on `isOnline` and `isStandalone` status.

## Session Date: 2026-03-31

## Security & Privacy Improvements

### 13. iOS App Switcher Privacy Fix (Issue #14)
**Files Changed:**
- `src/App.tsx` - Updated `AppLockGate` eager locking logic

**Changes:**
- Modified `AppLockGate` to trigger the lock screen immediately when the app is backgrounded (`visibilitychange: hidden` or `pagehide`).
- This forces a re-render to the opaque `LockScreen` component *before* the OS captures the application screenshot for the app switcher.
- Replaces the previous "foreground-only" locking which allowed cached data to be visible in the multitasking view.

**Impact:**
- **Privacy**: Protects sensitive financial data from being visible in the iOS/Android app switcher.
- **Security**: Ensures the app is already in a locked state the moment it is no longer the active foreground application.

### 14. Robust Offline Synchronization Refinements (Part 1)
**Files Changed:**
- `src/App.tsx` - Added global mutation defaults
- `src/hooks/useTransactions.tsx` - Broadened network error detection
- `src/hooks/useCategories.tsx` - Broadened network error detection
- `src/hooks/useFiles.tsx` - Enabled offline mode for file uploads

**Changes:**
- Configured global `networkMode: "offlineFirst"` for all mutations in `App.tsx` to ensure TanStack Query correctly queues actions during offline periods.
- Enhanced `onError` handlers across all core hooks (`useTransactions`, `useCategories`, `useFiles`) to recognize a wider range of network-related errors.
- Prevented automatic rollback of optimistic UI updates when network errors occur.
- Suppressed confusing "Failed" toast notifications for network-deferred actions.

### 15. Advanced Offline Resumption & Consistency (Part 2)
**Files Changed:**
- `src/App.tsx` - Registered mutation defaults and explicit resume
- `src/lib/mutations.ts` - New shared mutation function registry
- `src/hooks/useTransactions.tsx` - Cursor pagination and atomic deletes
- `src/hooks/useProjects.tsx` - Atomic invites and project revalidation
- `src/hooks/useCategories.tsx` - Scoped updates and cycle detection
- `src/hooks/useCustomColumns.tsx` - Validation guards and RPC error handling

**Changes:**
- **Mutation Resume**: Registered `mutationDefaults` for all core data operations, allowing the app to replay queued writes after a page reload or service worker restart.
- **Cursor Pagination**: Migrated transactions to cursor-based pagination (`transaction_date`, `created_at`) to ensure stable sync and list integrity during optimistic updates.
- **Atomic Invites**: Implemented a guarded single-update flow for project invites to prevent race conditions.
- **Project Revalidation**: Added proactive validation of the `activeProject` against the server-authoritative list on every load.
- **Local Date Handling**: Standardized local date generation for transactions to avoid UTC midnight shifts.
- **Input Validation**: Moved validation logic outside of asynchronous mutation loops to prevent cache pollution with invalid optimistic data.

## Session Date: 2026-03-30
