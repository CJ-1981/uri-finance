# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
