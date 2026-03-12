# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a team finance tracking application built with React, TypeScript, Vite, and Supabase. The app allows users to create projects, invite team members, and track income/expenses with customizable categories and custom columns.

## Development Commands

- `npm run dev` - Start development server (runs on port 8080)
- `npm run build` - Build for production
- `npm run build:dev` - Build in development mode
- `npm run lint` - Run ESLint
- `npm test` - Run all tests once
- `npm run test:watch` - Run tests in watch mode

## Architecture

### Tech Stack
- **Frontend**: React 18 with TypeScript, Vite for bundling
- **UI Library**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **State Management**: React hooks with custom data fetching hooks
- **Backend**: Supabase (PostgreSQL) with generated TypeScript types
- **Routing**: React Router DOM
- **Forms**: React Hook Form with Zod validation
- **Notifications**: Sonner toast library
- **Charts**: Recharts
- **Theme**: next-themes for dark/light mode

### Key Directories
- `src/components/` - Feature-specific components (TransactionList, AddTransactionSheet, etc.)
- `src/components/ui/` - shadcn/ui base components
- `src/hooks/` - Custom React hooks for data fetching and state management
- `src/integrations/supabase/` - Supabase client and auto-generated types
- `src/lib/` - Utility functions and i18n translations
- `src/pages/` - Route pages (Dashboard, Auth, Admin, etc.)

### Data Architecture

**Core Database Tables:**
- `projects` - Finance tracking projects with currency settings
- `project_members` - User-project associations with roles (owner/admin/member/viewer)
- `project_bans` - Users banned from projects
- `project_categories` - Custom transaction categories per project
- `custom_columns` - User-defined custom fields for transactions
- `transactions` - Income/expense records with soft delete support
- `project_invites` - One-time invite codes with optional email locking

**Important Data Patterns:**
- All data access uses custom hooks (useProjects, useTransactions, useCategories, etc.)
- Each hook follows pattern: `fetchData()` function called via useEffect + CRUD operations
- Transactions use soft delete (`deleted_at` field) - never hard delete
- All user-specific data is filtered by user_id and project_id
- Row-level security is enforced via Supabase RLS policies

### Authentication & Authorization

- Uses Supabase Auth for user authentication
- App locking with PIN (stored in localStorage as `app_lock_pin`)
- Role-based access control via `useUserRole` hook
- Roles: `owner` (full access), `admin` (can manage members/categories), `member` (can add/edit transactions), `viewer` (read-only)
- Owner can simulate other roles for testing via UI buttons
- **Invite Code System**:
  - Users can optionally enter an invite code during signup
  - Invite code is stored in localStorage as `pending_invite_code` for processing after authentication
  - After successful signup, the Dashboard automatically attempts to join the project with the pending invite code
  - Users can also join projects via the ProjectSwitcher's "Join" tab after logging in
  - Two invite systems supported:
    - New: `project_invites` table with individual codes, optional email locking, role assignment
    - Legacy: `invite_code` field on `projects` table for simple project joining

### Internationalization

- Uses custom i18n system in `src/lib/i18n.ts`
- Supports `en` and `ko` locales
- Access via `useI18n` hook: `{ t, locale, setLocale }`
- All user-facing text must use `t("key")` pattern
- Translation keys follow dot notation: `"dash.balance"`, `"tx.addTransaction"`

### Component Patterns

**Custom Hooks Pattern:**
```typescript
export const useTransactions = (projectId: string | undefined) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTransactions = async () => {
    if (!projectId) return;
    // Supabase query
  };

  useEffect(() => { fetchTransactions(); }, [projectId]);

  return { transactions, loading, addTransaction, updateTransaction, deleteTransaction };
};
```

**UI Components:**
- Use shadcn/ui components from `src/components/ui/` (Button, Dialog, Input, etc.)
- Merge classnames with `cn()` utility from `src/lib/utils.ts`
- Follow existing patterns for custom components

### Important Files

- `src/App.tsx` - Main app with providers (Auth, Theme, I18n, QueryClient, Router)
- `src/hooks/usePreventZoom.tsx` - Zoom prevention hook for mobile devices
- `src/components/CashCalculator.tsx` - Cash counting utility with denomination tracking
- `src/integrations/supabase/types.ts` - Auto-generated database types - DO NOT EDIT
- `src/integrations/supabase/client.ts` - Supabase client instance
- `src/lib/i18n.ts` - All translation strings
- `src/hooks/` - Each domain has its own hook file

### Key Features & Patterns

**Custom Columns:**
- Projects can have custom transaction columns (defined in `custom_columns` table)
- Custom values stored in `transactions.custom_values` as JSON
- Use `useCustomColumns` hook to fetch/manage custom columns
- Column data stored with safe keys (sanitized names with timestamp suffix)

**Currency Support:**
- Each project has a default currency
- Transactions can have different currencies
- Balance calculations separated by currency
- Cash calculator supports multiple currency denominations (USD, KRW, EUR, GBP, JPY, CNY, CAD, AUD)

**Import/Export:**
- CSV export with custom columns support
- CSV import for bulk transaction addition
- Uses `ExportTransactions` component
- Cash calculator exports to Markdown format

**Keyboard Shortcuts:**
- Configurable via `useKeyboardShortcut` hook
- Shortcuts defined in `src/lib/i18n.ts`
- User can customize via `ShortcutSettings` component

**Transaction Management:**
- Soft delete only (never hard delete transactions)
- Bulk operations supported (delete, edit)
- Transaction detail sheet supports prev/next navigation
- Selection mode for bulk operations

**Mobile Experience & Zoom Prevention:**
- Comprehensive zoom prevention across all pages and modals
- Meta tags: `maximum-scale=1.0`, `user-scalable=no`, `viewport-fit=cover`
- CSS: `touch-action: manipulation`, `overscroll-behavior: none`
- JavaScript hook `usePreventZoom` blocks pinch gestures and double-tap zoom
- All modals and dialogs have zoom prevention applied
- iOS-specific: tap highlight removal, text size adjustment prevention
- Input fields set to `16px` font to prevent iOS auto-zoom on focus

**Cash Calculator:**
- Located in `src/components/CashCalculator.tsx`
- Tracks named and anonymous cash counts by denomination
- Supports multiple currency configurations
- LocalStorage caching with date-based automatic reset
- Real-time calculation of totals (named, anonymous, grand total)
- Export functionality: Markdown format and clipboard copy
- Target amount comparison with gap analysis (deficit/excess/matching)
- Section headers for "bills" and "coins" are center-aligned

### Environment Variables

Required in `.env`:
```
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-key
VITE_SUPABASE_PROJECT_ID=your-project-id
```

### Testing

- Uses Vitest with jsdom environment
- Test setup in `src/test/setup.ts`
- Place tests in `src/**/*.{test,spec}.{ts,tsx}`

### Supabase Integration

- Database types auto-generated from Supabase
- Run migration scripts in `supabase/migrations/` for schema changes
- Custom SQL functions: `is_project_member`, `rename_custom_column_key`, `get_db_stats`
- When adding database changes, regenerate types: `npx supabase gen types typescript`

### Code Conventions

- Use TypeScript strict mode
- Follow existing component patterns
- Use functional components with hooks
- Prefer custom hooks for data fetching over inline queries
- All user-facing text must be i18n-compliant
- Use `toast` from sonner for notifications (success/error/info)
- Use `cn()` utility for className merging
- Follow existing styling patterns with Tailwind CSS
- Mobile-first approach: ensure touch targets are properly sized (min 44px)
- Input fields should be `16px` font size minimum to prevent iOS zoom
- Use `usePreventZoom` hook in app root to prevent accidental zoom
- Center-align section headers and labels for better mobile readability
- Consider touch actions for interactive elements (`touch-action: manipulation`)
