# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.5] - 2026-04-06

### Added
- **Layout & Accessibility**:
  - Constrained main dashboard and header content to a maximum width of 1536px (screen-2xl) for better readability on ultra-wide displays.
  - Centered all major UI elements including the transaction list, charts, and administrative pages.
  - Relocated the language toggle on the Auth page to be adjacent to the login container, ensuring it remains accessible on wide screens.
  - Added an accessible `aria-label` to the PWA installation prompt dismiss button for improved screen reader support.
  - Constrained the floating action button (FAB) and PWA instructions banner within the centered content width.

## [1.3.4] - 2026-04-06

### Fixed
- **Password Recovery**:
  - Improved robust detection of recovery flow using both URL markers and user metadata.
  - Added support for `PASSWORD_RECOVERY` event in authentication callback.
  - Implemented `sessionStorage` flag to persist recovery state and ensure password reset dialog remains open.
  - Bypassed current password requirement when in recovery mode for a smoother user experience.
- **PWA Integration**:
  - Restricted PWA install suggestions to mobile browsers only (Android/iOS) to prevent noise on desktop.
- **Navigation & Auth**:
  - Prevented premature consumption of the `auth_recovery` flag by waiting for user session load in `Index` page.
  - Preserved recovery flag during redirects from Auth page to Dashboard.
  - Ensured recovery flag is cleared upon successful password change, logout, or sign-out.

## [1.3.3] - 2026-04-04

### Added
- **Multi-File Upload**:
  - Upload multiple files simultaneously with drag-and-drop or file picker
  - Real-time progress indicator showing current/total files during upload (e.g., "1/3", "2/3")
  - Camera button on mobile for quick photo capture
  - File list showing selected files with size and error states
  - Validation for file size limits and duplicate detection
  - Optional remark field applied to all files in batch
- **Multi-File Delete**:
  - Delete multiple files with confirmation dialog
  - Progress indicator showing deletion progress (e.g., "Deleting 2/3")
  - Select all/deselect all functionality
  - Batch download support for selected files
- **Accessibility**:
  - Keyboard navigation for dropzone (tabIndex, Enter/Space keys)
  - Screen reader support with aria-labels for remove buttons
  - Proper ARIA attributes for disabled states
- **Offline/Standalone Mode**:
  - Optimistic UI updates for immediate feedback in standalone mode
  - Files appear instantly after upload without waiting for query invalidation
  - Metadata cleanup on partial failures to prevent broken references

### Changed
- **Error Handling**:
  - Improved state restoration before early return on network errors
  - Per-file delete tracking to prevent reappearing items on partial failure
  - Storage cleanup error checking in upload flow and rollback
  - Metadata sync for standalone mode deletions
- **User Interface**:
  - Dynamic dialog title/description updates during multi-file operations
  - Loading spinners with progress counters
  - Disabled state for buttons during operations
  - Mobile-optimized with camera/file picker buttons

### Fixed
- **RLS Policy Compliance**: Sequential uploads with getUser() called per file to satisfy Supabase Row Level Security
- **Orphaned Files**: Added files to rollback list before cleanup attempt to prevent orphaned storage blobs
- **Metadata Sync**: Fixed standalone mode deletion to clean up metadata for successfully deleted files
- **Query Cache**: Fixed onError restore logic to keep unrelated files when partial failures occur
- **File Input Reset**: Reset file input value after selection to allow re-selecting the same file

## [1.3.2] - 2026-04-03

### Added
- **Bulk Operations**:
  - Implemented multi-select and batch deletion for transactions with efficient server-side processing.
  - Added batch restore and permanent delete capabilities for the trash manager.
  - Enhanced file management with a multi-select toolbar and "Select All/Deselect All" functionality.
- **Workflow & AI Documentation**:
  - Integrated MoAI/Agency development workflows and rules into project documentation.
  - Standardized agent role profiles and quality routing logic for AI-driven production pipelines.

### Changed
- **Performance Optimization**: Increased transaction list pagination `PAGE_SIZE` from 50 to 100 for smoother browsing.
- **Project Reliability**: Simplified active project restoration logic and implemented automatic project data synchronization with server.
- **User Interface**: Added robust confirmation dialogs for all destructive actions (restore/delete) across the application.

### Fixed
- **UI Integrity**: Refined file list scrolling and multi-select UI layout for better accessibility and visual consistency.
- **Localization**: Added missing Korean and English translations for bulk operations, trash management, and common status messages.

## [1.3.1] - 2026-04-03

### Changed
- **Administrative Interface**:
  - Reordered the Admin page sections to prioritize project-wide configuration ("Project Setup") and basic settings ("Project Info").
  - Simplified transaction list animations by replacing staggered item fades with a single container-level fade-in to reduce flickering during page transitions.
- **Transaction List Refinements**:
  - Integrated "Load More" functionality directly into the pagination's "Next" button for a more unified navigation experience.
  - Hidden membership simulation buttons in standalone mode as they are only relevant for cloud-synced projects.

### Fixed
- **Pagination Race Condition**: Implemented a robust `useEffect`-based auto-advance logic in `TransactionList` that ensures the page only increments after background data fetching successfully completes and total page count increases.
- **Duplicate Fetch Guard**: Added a state-based guard to prevent duplicate `fetchNextPage` calls when the "Next" button is clicked multiple times during an active request.
- **Administrative Deletions**: Migrated member removal, banning, category deletion, and column deletion to use standard system confirmation popups for a consistent and reliable user experience.

## [1.3.0] - 2026-04-01

### Added
- **Workflow-Specific Branding**:
  - Dynamically customized application name and icons based on the deployment environment (e.g., Pull Request vs. Main branch).
  - Integrated Vite environment variables (`VITE_APP_TITLE`, `VITE_APP_ICON_SUFFIX`) into build pipeline.
  - Automated fallback to default icons if variant assets are missing.
- **Project Renaming**:
  - Added ability for project owners to rename projects and update descriptions directly from the project switcher.
  - Context-aware UI respects role simulation mode (pencil icon hidden when simulating non-owner roles).

### Security
- **Hardened Standalone Mode**:
  - Restricted access to Supabase-dependent features in Admin page (Members, Invites, Archive, and Backend Stats).
  - Hidden "Change Password" option in User Menu when in standalone mode.
  - Restricted system administration access to authenticated global admins only.

### Changed
- **Localization (i18n)**:
  - Comprehensive Korean and English translations for PWA installation guides and iOS-specific instructions.
  - Standardized "Get Started" messaging for standalone mode to remove confusing cloud-sync references.
  - Removed hardcoded English fallbacks from the UI to ensure 100% localized experience.

### Fixed
- **Currency Management**: Resolved issue where changing project currency failed in standalone mode.
- **UI Integrity**: Fixed "validateDOMNesting" warning by refactoring project list items from nested buttons to accessible div elements.
- **Build Reliability**: Ensured `vite.config.ts` handles missing assets gracefully during environment-specific builds.

## [1.2.0] - 2026-04-01

### Added
- **Full Standalone Mode**: Introduced a complete local-only storage mode.
  - Automatic fallback to `localStorage` for Transactions, Categories, and Custom Columns.
  - Data integrity logic ensures category and column updates propagate to local transactions.
  - Deterministic sorting and cursor-based pagination for local data.
  - "Continue in Standalone Mode" option on the authentication page.
- **PWA Enhancements**:
  - Added a custom iOS-specific installation instruction modal.
  - Refined install prompts and session persistence.

### Changed
- **UI/UX Optimization**:
  - Consolidated header utility icons (Theme, Locale, PIN, Shortcuts) into the **User Menu** to prevent header overflow.
  - Moved the main **Offline Indicator** to the absolute center of the header for maximum visibility.
  - **Context-Aware Admin Gear**: The admin gear icon is now hidden when offline in Supabase mode to prevent access to non-functional pages.
- **Robustness**:
  - Aggressive session clearing during logout to prevent stale sessions from re-logging users in while offline.
  - Configured core queries with `networkMode: "always"` to ensure instant access to local data regardless of network status.

### Fixed
- **E2E Test Stability**: Improved test reliability by awaiting IndexedDB cleanup and using stable SVG-based locators.
- **Data Consistency**: Fixed ID mismatch in optimistic updates for custom columns.

## [1.1.9] - 2026-03-31

### Added
- **Offline Mode**: Enabled full application functionality without an internet connection.
  - Caches application assets (PWA) to allow the app to load offline.
  - Persists query data in IndexedDB for instant hydration and offline access.
  - Added optimistic UI updates for adding, editing, and deleting transactions.
  - New "Offline Mode" indicator in the dashboard header.

### Changed
- **Data Architecture**: Migrated core data hooks to TanStack Query v5 for improved state management and persistence.

## [1.1.8] - 2026-03-31

### Added
- **Toast Swipe Indicator**: Added a visual vertical bar and an animated chevron ("›") on the right side of toast notifications to proactively suggest swipability.
- **Privacy Lock (iOS/Android)**: Implemented eager locking that triggers as soon as the app is backgrounded. This prevents sensitive data from being visible in the system app switcher/multitasking view.

### Changed
- **PIN Numpad Consistency**: Standardized the numpad layout and styling across both the Lock Screen and Pin Setup dialog for a perfectly uniform user experience.
- **Toast Timing**: Shortened toast duration to 2000ms and added a close button to prevent interference with other UI elements.
- **Tab Navigation**: Refined tab buttons to be more responsive on narrow mobile devices (325px wide), including larger icons and dynamic label visibility.

## [1.1.7] - 2026-03-30

### Fixed
- **Dashboard Filters Centering**: Fixed an issue where the category list and period selector were not properly center-aligned on page load.
- **Popover Alignment**: Fixed category and period popover positioning to prevent them from rendering off-screen or at the far right.
- **Mobile Popover Stability**: Removed restrictive CSS positioning that interfered with automatic popover placement in modal contexts.

## [1.1.6] - 2026-03-29

### Changed
- **Transaction Modal Redesign**: Improved mobile stability and accessibility for add/edit transaction modals.
  - Replaced unstable **Drawer (vaul)** with **Sheet (Radix Dialog)** on mobile to eliminate accidental swipe-to-close behavior on iOS Safari.
  - Standardized mobile modal heights to `h-[85vh]` for better focus and usability.
  - Unified mobile and desktop UI logic to improve maintainability and consistency.
  - Added `overscroll-contain` to modal content areas to prevent background scrolling issues.

### Added
- **Violet Cancel Buttons**: Added high-visibility "Cancel" buttons with a new violet gradient.
  - New `.gradient-violet` CSS utility for theme-consistent violet buttons with tokenized CSS variables.
  - Dedicated "Cancel" button in Add Transaction modal.
  - "Cancel" button positioned next to Delete button in Edit Transaction modal for clear exit paths.

### Accessibility
- **ARIA Labels**: Added descriptive labels to all icon-only buttons (Delete, Previous, Next, and floating Add button).
- **Keyboard Navigation**:
  - Expanded Tab navigation scope to include header navigation controls in transaction modals.
  - Added `data-tab-stop` to Cancel buttons for consistent keyboard flow.
  - Fixed stale state issues in keyboard shortcuts by updating memoization dependencies.
  - Improved focus management with `tabIndex={-1}` on modal containers and refined `onOpenAutoFocus` logic for mobile devices.
  - Added guards to prevent Tab key interference when category dropdowns or popovers are open.

### Fixed
- **Sheet Descriptions**: Localized hard-coded English strings in transaction modal descriptions for both English and Korean.

## [1.1.5] - 2026-03-26

### Added
- **Keyboard Shortcut Labels**: Visual keyboard shortcut indicators on transaction modal buttons
  - Save & Close button now displays keyboard shortcut (⌘/Ctrl+Enter)
  - Save & Next button now displays keyboard shortcut (⌘/Ctrl+Shift+Enter)
  - Platform-specific display: Mac (⌘ symbols) vs Windows/Linux (Ctrl text)
  - Hidden on mobile devices to maintain clean UI
  - Consistent with existing Add Transaction modal keyboard shortcut design

### Fixed
- **Currency Selector Keyboard Shortcuts**: Number keys (1-9,0) now work properly in transaction modals
  - Fixed event handler placement to ensure keyboard events are captured when dropdown is open
  - NumberedSelect component now properly focuses list container when popover opens
  - Enables quick currency selection via keyboard in both Add and Edit transaction modals
  - Improves accessibility and keyboard-only workflow efficiency

## [1.1.4] - 2026-03-26

### Security
- **CRITICAL: Supabase Security Vulnerabilities Fixed (Issue #13)**
  - **auth_users_exposed vulnerability**: Removed insecure `project_files_with_email` view that exposed all user emails to any authenticated user
  - **security_definer_view vulnerability**: Eliminated improper use of SECURITY DEFINER semantics without access control
  - **OWASP A01:2021 (Broken Access Control)**: Fixed - View granted SELECT to all authenticated users without RLS policies
  - **OWASP A05:2021 (Security Misconfiguration)**: Fixed - Removed unnecessary privileged access to auth.users data
  - **Migration**: `20260326000001_fix_security_vulnerabilities_issue_13.sql`
  - **Impact**: Eliminated unauthorized access to auth.users.email data across all projects
  - **Alternative**: Application now exclusively uses secure RPC function `get_project_files_with_email(p_project_id)` with proper access control

### Changed
- **Security Documentation**: Added comprehensive security rationale to `get_project_files_with_email()` function
  - Documents why SECURITY DEFINER is safe (filtered by project_id, RLS enforced)
  - Explains access control through is_project_member() check
  - Provides usage examples and security model details

## [1.1.3] - 2026-03-22

### Fixed
- **Category Selector Icons**: Changed collapse/expand icons from +/- to chevron arrows in modal
  - Replaced Plus/Minus icons with ChevronRight/ChevronDown for consistency
  - Applied to both CategorySelector and AddTransactionSheet components
  - Improved visual consistency across mobile and desktop views

## [1.1.2] - 2026-03-22

### Added
- **Image Compression Threshold**: Added 1MB threshold for automatic image compression
  - Images over 1MB are automatically compressed before upload
  - Reduces storage costs and improves upload performance
- **Download Progress Tracking**: Real-time progress indicators for file downloads
  - Shows download progress with percentage and status
  - Enhanced user feedback during download operations
- **Inline File Remark Editing**: Edit file descriptions directly from the file list
  - Click on remark field to edit file descriptions in-place
  - Saves changes automatically with optimistic updates
  - Improved UX without opening edit dialogs
- **File Metadata Update Functionality**: Comprehensive file metadata management
  - Update file remarks inline with validation
  - Real-time sync with Supabase for metadata changes
  - English and Korean translations for inline editing

### Changed
- **File Preview Dialog Layout**: Improved responsiveness with flexbox
  - Better mobile responsiveness for image preview
  - Improved layout stability across different screen sizes
  - More consistent spacing and alignment

### Infrastructure
- **File Mock Structure**: Updated mock structure with new fields for testing
- **Test Coverage**: Enhanced test coverage for file operations

## [1.1.1] - 2026-03-22

### Fixed
- **Orphaned Transaction Links**: Fixed files remaining linked to deleted transactions
  - Added file unlinking logic to AdminPage archive function
  - Added cache invalidation to refresh UI after unlinking
  - Migration cleanup for existing orphaned links
  - Ensures transaction_id set to NULL when transaction is soft-deleted
- **Delete Transaction UX**: Improved delete operation with confirmation and list refresh
  - Added AlertDialog confirmation dialog for delete operations
  - Fixed transaction list not refreshing after delete
  - Replaced dynamic hook imports with direct Supabase calls in event handlers
  - Fixed React Hooks violations in delete functionality
  - Added onTransactionDeleted callback prop to TransactionList
- **Passive Event Listener Violations**: Removed preventDefault() calls from passive touch handlers
  - Fixed FilePreviewDialog drag-to-close functionality
  - Fixed TransactionList long-press backdrop touch handling
  - Resolved React 18+ passive event listener warnings
- **Selection Toolbar Visibility**: Fixed toolbar not showing until items selected
  - Selection toolbar now immediately visible when select mode enabled
  - Buttons are disabled until items are selected (better UX)
  - Select All button shows current count (X/Y format)

### Added
- **Files List Search**: Text search functionality for file management
  - Search across file name, remark/description, and uploader email
  - Real-time filtering with useMemo optimization
  - Clear button to reset search
  - English and Korean translations for search placeholder

### Infrastructure
- **Migration**: Added UPDATE policy on project_files table for transaction unlinking
- **Translation**: Added "files.search" key to i18n (en/ko)

## [1.1.0] - 2026-03-21

### Added
- **File Storage System (SPEC-STORAGE-001)**: Complete Supabase Storage integration for project file management
  - File upload with drag-and-drop support and mobile camera integration
  - Project-specific file storage with UUID-based paths for security
  - RLS-protected metadata in project_files table with project membership enforcement
  - Real-time file synchronization across multiple clients
  - File preview dialog supporting images and PDFs with signed URL access
  - Korean and Unicode filename support (original names preserved in database)
  - Storage statistics function showing file counts, sizes, and recent uploads
  - File type validation allowing documents and images (archives blocked for security)
  - 5 MB file size limit with progress tracking
  - Download functionality with progress indicators
  - Admin page storage monitoring integration
  - **Multi-select mode**: Select multiple files for batch operations (download/delete)
  - **Confirmation dialogs**: AlertDialog for single and batch delete operations
  - **Remark field**: Add descriptions/notes to file uploads with display in file list
  - **Uploader email display**: Show who uploaded each file in the file list
  - **Transaction File Attachments (SPEC-TRANSACTION-FILES)**: Link files to transactions
    - Upload files directly when creating transactions via AddTransactionSheet
    - Deferred upload pattern: files stored locally, uploaded after transaction creation
    - Upload progress indicator with spinner, progress bar, and percentage display
    - Display attached files in TransactionDetailSheet with download functionality
    - Link from file list to source transaction detail (Receipt + Link icon button)
    - Transaction ID foreign key in project_files table with ON DELETE SET NULL
    - Korean and English translations for file attachment features

### Database
- **project_files table**: New table for file metadata with proper foreign keys and constraints
  - Columns: id, project_id, uploaded_by, file_name, file_type, file_size, storage_path, remark, transaction_id, created_at
  - CHECK constraint ensuring storage_path is scoped to project_id
  - Indexes on project_id, transaction_id, and created_at for efficient queries
  - Foreign key to transactions table with ON DELETE SET NULL for transaction_id
  - Composite index on (project_id, transaction_id) for efficient transaction file queries
- **get_storage_stats() function**: Returns storage statistics including file counts, sizes, and breakdown by type
- **get_project_files_with_email() function**: SECURITY DEFINER function to fetch files with uploader emails
  - Joins project_files with auth.users to include uploader email
  - Type-safe casting of email field from varchar(255) to text
- **project_files_with_email view**: Readable view for files with uploader email
- **remark column**: Added optional TEXT field for file descriptions
- **Updated initial_schema.sql**: Complete storage functionality included for fresh project setup

### Security
- **Hybrid Security Model**: Four-layer protection for file storage
  - Layer 1: Authentication required for all operations
  - Layer 2: project_files table RLS enforces project membership
  - Layer 3: Signed URLs expire after 60 minutes
  - Layer 4: Random UUIDs prevent unauthorized path guessing
- **Storage Path Convention**: `projects/{projectId}/files/{fileId}{ext}` format with UUID isolation
- **File Type Validation**: Allowed types restricted to documents and images (executables and archives blocked)
- **RLS Policies**: Three policies on project_files (view, upload, delete) with role-based permissions

### Fixed
- **Storage Policy Issues**: Resolved PostgreSQL 42P17 database errors
  - Initial regex pattern error in RLS policy (changed from regex ~ to LIKE operator)
  - Storage RLS policy conflicts resolved by disabling RLS on storage.objects system table
  - Complex path parsing removed in favor of simple bucket-based policies
- **Korean Filename Handling**: Fixed character normalization issue
  - Korean filenames now preserved correctly in database
  - Storage paths use UUID + extension only (no Unicode in storage keys)
  - Original filenames displayed in UI from database metadata
- **File Preview 500 Errors**: Resolved signed URL generation failures
  - Fixed storage RLS policies causing database errors
  - CORS configuration documentation added
  - Error logging improved for debugging

### Infrastructure
- **Storage Bucket Configuration**: project-files bucket setup with public access disabled
- **Real-time Publication**: project_files table added to supabase_realtime for collaborative updates
- **Migration Idempotency**: All migrations updated with IF NOT EXISTS and DROP IF EXISTS for safe re-running
- **Test File Migration**: Moved 20260315100000_add_user_preferences.test.sql to supabase/tests/ directory

### User Experience
- **Mobile camera support**: Separate "Camera" and "Files" buttons on mobile for direct photo capture
- **Responsive file list**: Touch-friendly interface with proper spacing for mobile devices
- **Batch operations**: Select multiple files with visual feedback and bulk actions
- **Smart fallback**: Graceful degradation when uploader email function unavailable
- **Keyboard shortcuts**: Files tab accessible via keyboard shortcut
- **I18n support**: Korean and English translations for all file management features

## [1.0.1] - 2026-03-21

### Fixed
- **Development Mode SPA Routing**: Fixed 404 error when refreshing pages in development mode
  - Configured base path to use `/` for development and `/uri-finance/` for production
  - Added middleware to redirect `/uri-finance` requests to `/` in development mode
  - Made React Router basename dynamic based on environment
  - Fixes issue where page refresh resulted in "server is configured with a public base URL of /uri-finance/" error
- **Keyboard Navigation**: Multiple fixes for category selector keyboard navigation
  - Platform-appropriate keyboard shortcuts now display correctly for Windows and macOS
  - Fixed focus indicator styling using box-shadow instead of outline/ring
  - Prevented layout shift in category selector focus indicator
  - Prevented duplicate focus on expanded parent with children
  - Parent buttons now always render correctly without special case handling
  - Fixed navigation to skip hidden children and show correct shortcut numbers
- **Category Tree Structure**: Fixed tree navigation and focus issues
  - Updated CategoryNameSelector to use categoryOptions lookup
  - Fixed categoryOptions passing to child TreeItems in normal expanded case
  - Fixed globalIndex calculation using categoryOptions instead of parent offset
- **CodeRabbit Review Comments**: Addressed critical issues from CodeRabbit review

### Code Quality
- **ESLint Cleanup**: Completed comprehensive ESLint error fixes
  - Fixed 98 ESLint errors (80.3% reduction)
  - Fixed remaining 12 ESLint errors (100% completion)
  - All code now passes linting checks

## [1.0.0] - 2026-03-16

### Added
- **GitHub Pages Migration**: Complete migration from lovable.dev to GitHub Pages for better CI/CD integration
  - GitHub Actions workflow with automated build and deployment
  - Dynamic base path configuration for custom domain and default GitHub Pages URL support
  - SPA routing solution with 404.html fallback for direct route access
  - 53 characterization tests for behavior preservation
  - Comprehensive deployment documentation and setup guides

### Infrastructure
- **Build Configuration**: Updated Vite configuration with dynamic base path support
- **Environment Variables**: Added VITE_BASE_URL for flexible base path configuration
- **Deployment Script**: New `build:gh` command for GitHub Pages optimized builds
- **SPA Routing**: Implemented 404.html solution to handle direct route access on static hosting
- **Test Suite**: Added comprehensive test coverage for build configuration and routing

### Documentation
- **GitHub Pages Setup**: Complete setup documentation in `docs/GITHUB_PAGES_SETUP.md`
- **Migration Guide**: Step-by-step migration guide in `docs/MIGRATION_GUIDE.md`
- **Environment Configuration**: Updated environment variable documentation for GitHub Pages
- **README Updates**: Added deployment section with GitHub Pages instructions

### Security
- **Secret Management**: Proper GitHub Secrets configuration for Supabase credentials
- **Build Security**: No sensitive data exposure in production builds
- **Asset Optimization**: Excluded development-only plugins (lovable-tagger) from production bundle

### Performance
- **Bundle Size**: Optimized for GitHub Pages hosting constraints
- **Asset Loading**: Correct base path configuration for static assets
- **Load Times**: Maintained acceptable performance thresholds

## [Unreleased]

### Added
- **Tree Structure UI for Admin Page**: Added tree structure with expand/collapse functionality to admin page category settings
  - Visual tree display with expand/collapse buttons for parent-child relationships
  - Automatic tree view when categories have subcategories
  - Fallback to drag-and-drop sortable list for flat category structure
  - Consistent UI with dashboard CategorySelector component
- **Category Layout Improvements**: Fixed category tree item layout to prevent button wrapping and improve emoji button sizing
  - Restructured CategoryTreeItem to match SortableCategoryItem layout pattern
  - All elements (expand button, code, emoji, name, action buttons) stay on same line
  - Added proper flex distribution with shrink-0 for fixed elements and flex-1 for name field

### Changed
- **Global Admin Page**: Complete mobile-responsive redesign with card-based layout for better mobile experience
- **Project Delete Functionality**: Added ability to delete projects from global admin page with cascading delete
- **User Project Display**: Users tab now shows project names as badges instead of just count
- **Admin Page Navigation**: Moved "System Administration" button to bottom of admin page for improved organization
- **Error Boundary Component**: Added React error boundary component for better error handling and crash prevention
- **Secure Storage Adapter**: Created secure storage adapter for safer data persistence using sessionStorage
- **PIN Security Storage**: Added secure PIN storage module with enhanced security measures
- **Mobile Zoom Prevention**: Implemented comprehensive zoom prevention system for mobile devices:
  - Meta tags configuration for viewport and iOS optimization
  - CSS-based zoom prevention with selective touch-action controls
  - JavaScript hook to block pinch gestures while allowing normal scrolling
  - Applied to all pages, modals, dialogs, and interactive elements
  - Fixed to allow two-finger scrolling on macOS Safari and trackpads
- **Cash Calculator Center Alignment**: Centered "bills" and "coins" section headers for improved mobile readability
- **PIN Verification**: Added PIN verification before disabling app lock for enhanced security
- **Category Selector Labels**: Separated category selector "All" label from transaction list "All" label for clarity
  - Category selector now shows "All Categories" (전체 카테고리)
  - Transaction list select all button shows "All" (모두)
- **NumberedSelect Dropdown**: Removed width constraint to prevent text truncation in dropdown options
- **Security Enhancement**: Moved Supabase auth tokens from localStorage to secure sessionStorage
- **PIN Storage**: Enhanced PIN security by moving from localStorage to sessionStorage while maintaining SHA-256 hashing
- **Error Handling**: Integrated error boundaries at application level for graceful error recovery
- **App Lock Integration**: Updated app lock functionality to use secure storage methods
- **Mobile Experience**: Enhanced mobile browsing experience with comprehensive zoom prevention

### Fixed
- **Korean Translation**: Corrected Korean translation for selectAll option to use "모두"
- **Project Settings Access**: Restricted project settings export/import to owners only for security
- **Mobile Category Dropdown Scrolling**: Fixed category dropdown scrolling issues on mobile devices:
  - Added custom inline dropdown for mobile modal context to avoid Portal z-index conflicts
  - Added visible 6px scrollbar for category dropdown on mobile devices
  - Fixed tab navigation interference with category dropdown interaction
  - Resolved z-index conflicts between PopoverContent and Drawer components
  - Applied proper touch-action and overscroll-behavior for smooth mobile scrolling

### Security
- **XSS Vulnerability Fixed**: Critical security fix - auth tokens now stored in sessionStorage instead of localStorage, preventing XSS attacks
- **Enhanced PIN Security**: Improved PIN storage security with proper session-based storage
- **Token Storage**: Implemented proper token handling with secure storage adapter

### Performance
- **Finance Charts Optimization**:
  - Added memoization for expensive calculations
  - Pre-computed transaction dates to avoid repeated parsing
  - Optimized grouped data computation with proper callback memoization
  - Performance improvement: ~50% faster chart rendering
- **Search Debouncing**: Added 300ms debounce to TransactionList search functionality
  - Prevents unnecessary filtering on every keystroke
  - Reduces CPU usage during typing
  - Improves overall search performance

### Code Quality
- **Type Safety**: Removed dangerous `as any` type assertions from critical code paths:
  - Fixed useCategories.tsx type issues
  - Fixed useCustomColumns.tsx type issues
  - Enhanced Supabase client configuration with proper storage adapter
- **ESLint Improvements**: Re-enabled `@typescript-eslint/no-unused-vars` rule with proper configuration
  - Fixed unused variable issues across multiple components
  - Fixed empty catch blocks with proper comments
  - Fixed empty object type issues
  - Fixed require() imports to ES imports
- **Code Cleanliness**: Removed dead code and unused functions throughout codebase

### Fixed
- **Unused Variables**: Fixed multiple unused variable issues in components:
  - CashCalculator.tsx: Removed unused `isBill` function
  - CategoryManager.tsx: Fixed unused function parameters
  - ExportTransactions.tsx: Fixed unused export functions
  - TrashManager.tsx: Fixed unused currency parameter
- **Empty Blocks**: Fixed empty catch blocks in useKeyboardShortcut.tsx and CashCalculator.tsx
- **Type Issues**: Fixed interface extending without additional members in command.tsx and textarea.tsx
- **Import Issues**: Updated require() import in tailwind.config.ts to ES import

## [0.0.0] - Previous Release

### Features
- Transaction management with add, edit, delete functionality
- Category management with sorting and icons
- Custom columns support for additional transaction metadata
- PIN-based app locking with configurable attempts
- Multi-currency support
- Interactive charts (pie, area, bar) for financial analytics
- Transaction export functionality (CSV format)
- Bulk operations for transactions
- Project switching support
- Responsive design with mobile-first approach
- Toast notifications for user feedback
- Keyboard shortcuts support
- Lock screen with configurable security

### Technical
- Built with React 18 + TypeScript
- Supabase backend integration
- shadcn/ui component library
- Tailwind CSS for styling
- React Query for data fetching
- Recharts for data visualization
- Vite build system
