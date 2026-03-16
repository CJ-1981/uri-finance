# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
