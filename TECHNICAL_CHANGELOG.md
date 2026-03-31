# Technical Changelog

Detailed technical changes made during codebase review and improvement session.

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

### 14. PIN Numpad UI Consistency
**Files Changed:**
- `src/components/LockScreen.tsx` - Updated numpad styling and layout
- `src/components/PinSetupDialog.tsx` - Standardized numpad styling

**Changes:**
- Perfectly aligned `LockScreen` and `PinSetupDialog` numpad layouts for identical user experience.
- Standardized button sizing using `size-20` and `aspect-square` to ensure perfect circles and uniform vertical height.
- Implemented `justify-items-center` on the grid and fixed-size spacers to maintain strict alignment of all rows, including the empty spacer in the bottom row.
- Tightened vertical spacing in `LockScreen` (reduced gaps and icon sizes) to ensure the numpad is positioned at the same height as in the setup dialog.
- Standardized font sizes (`text-lg` for digits) and the delete indicator (`←`) across both components.

## Offline & Persistence Improvements

### 15. Comprehensive Offline Mode (Issue #19)
**Files Changed:**
- `src/hooks/useTransactions.tsx` - Migrated to React Query with optimistic updates
- `src/hooks/useCategories.tsx` - Migrated to React Query
- `src/lib/offlineStorage.ts` - New IndexedDB persistence layer
- `src/App.tsx` - Configured React Query persistence
- `vite.config.ts` - Added `vite-plugin-pwa` for asset caching
- `src/main.tsx` - Registered service worker
- `src/hooks/useOnlineStatus.ts` - New hook for connectivity tracking
- `src/pages/Dashboard.tsx` - Added offline status indicator

**Changes:**
- Standardized data fetching by migrating manual `useState`/`useEffect` hooks to TanStack Query v5.
- Implemented persistent caching using IndexedDB (via `idb-keyval`), allowing the app to load previously fetched data instantly without a network connection.
- Added optimistic UI updates for adding, updating, and deleting transactions, providing an immediate response while offline.
- Integrated `vite-plugin-pwa` to cache the application shell (HTML, JS, CSS) for true offline access.
- Added a visual "Cloud Off" indicator in the Dashboard header with an amber pulse animation to inform users when they are working offline.

**Impact:**
- **Reliability**: The app remains functional in low-connectivity or no-connectivity environments.
- **Performance**: Instant data loading from the local cache (Hydration from IndexedDB).
- **User Experience**: Seamless transitions between online and offline states with background synchronization.

### 16. Robust Offline Synchronization Refinements
**Files Changed:**
- `src/App.tsx` - Added global mutation defaults
- `src/hooks/useTransactions.tsx` - Broadened network error detection
- `src/hooks/useCategories.tsx` - Broadened network error detection
- `src/hooks/useFiles.tsx` - Enabled offline mode for file uploads

**Changes:**
- Configured global `networkMode: "offlineFirst"` for all mutations in `App.tsx` to ensure TanStack Query correctly queues actions during offline periods.
- Enhanced `onError` handlers across all core hooks (`useTransactions`, `useCategories`, `useFiles`) to recognize a wider range of network-related errors (e.g., "Load failed", "TypeError", `status: 0`).
- Prevented automatic rollback of optimistic UI updates when network errors occur, ensuring that user changes remain visible and are eventually synced when connectivity is restored.
- Suppressed confusing "Failed" toast notifications for network-deferred actions, providing a cleaner and more trustworthy offline experience.

**Impact:**
- **Stability**: Resolves issues where mutations would incorrectly report failure while the app was intentionally working offline.
- **Trust**: Users can now confidently perform actions offline knowing they won't be greeted by error messages or see their changes disappear.

## Session Date: 2026-03-30
