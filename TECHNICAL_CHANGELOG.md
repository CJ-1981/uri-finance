# Technical Changelog

Detailed technical changes made during codebase review and improvement session.

## Session Date: 2026-04-01

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
