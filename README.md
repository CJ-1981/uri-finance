# URI Finance - Team Finance Tracking Application

A React application for tracking team finances with custom categories, columns, and multi-user project management.

## Features

- **Multi-User Projects**: Create projects and invite team members with role-based access control
- **Custom Categories**: Define transaction categories per project with codes and icons
- **Custom Columns**: Add custom fields to transactions (numeric, text, list types)
- **Transaction Management**: Add, edit, delete transactions with soft delete support
- **Import/Export**: CSV, XLS, and Markdown export with custom column support
- **Cash Calculator**: Track cash counts by denomination with named/anonymous breakdowns
- **Charts**: Visualize income, expenses, and trends with multiple chart types
- **Archive**: Export and remove transactions within date ranges
- **Trash Bin**: Restore accidentally deleted transactions
- **Mobile Responsive**: Optimized for mobile browsers with zoom prevention
- **System Administration**: Global admin panel for managing all users and projects (owner email restricted)
- **Multi-Language**: English and Korean (ko) support
- **Theme Support**: Light and dark mode with system preference detection

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **UI Library**: shadcn/ui (built on Radix UI primitives)
- **State Management**: React hooks
- **Backend**: Supabase (PostgreSQL with Row-Level Security)
- **Routing**: React Router DOM
- **Forms**: React Hook Form with Zod validation
- **Charts**: Recharts
- **Notifications**: Sonner toast library
- **Theme**: next-themes
- **Date**: date-fns

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn
- A Supabase project (create one at https://supabase.com)

### Installation

```bash
# Clone the repository
git clone https://github.com/CJ-1981/uri-finance.git
cd uri-finance

# Install dependencies
npm install
```

### Supabase Setup

1. **Create a Supabase Project**: Go to [supabase.com](https://supabase.com) and create a new project

2. **Get Project Credentials**:
   - Project URL (e.g., `https://smaezjholbhtffflegvt.supabase.co`)
   - Anon Public Key (for development)
   - Service Role Key (for server-side operations)

3. **Create a `.env` file** in the project root:

```env
# Supabase Configuration
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-public-key
VITE_SUPABASE_PROJECT_ID=your-project-id

# System Administration (Optional)
# Comma-separated list of email addresses allowed to access global admin
# Leave empty to allow all authenticated users (not recommended for production)
VITE_SYSTEM_ADMIN_EMAILS=owner@example.com,admin@example.com
```

#### Environment Variables Explained

| Variable | Description | Required | Example |
|-----------|-------------|----------|----------|
| `VITE_SUPABASE_URL` | Your Supabase project URL | Yes | `https://smaezjholbhtffflegvt.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Anon/public key for client access | Yes | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `VITE_SUPABASE_PROJECT_ID` | Your Supabase project ID | Yes | `smaezjholbhtffflegvt` |
| `VITE_SYSTEM_ADMIN_EMAILS` | Email addresses allowed to access global admin | No | `admin@example.com,dev@example.com` |

#### Getting Your Supabase Credentials

After creating your Supabase project, you can find your credentials in:

1. **Project Settings** → API → [Copy Project URL]
2. **Project Settings** → API → [Anon/Public Key] → [New Anon Key]
3. **Project Settings** → General → [Project Reference] → [Project ID]

Copy these values into your `.env` file.

#### System Admin Email Configuration

The global admin page allows system administrators to view and manage all users and projects. To control access:

1. **Single Owner Email**: Set one email address:
   ```env
   VITE_SYSTEM_ADMIN_EMAILS=owner@yourcompany.com
   ```

2. **Multiple Emails**: Add multiple system administrators (comma-separated):
   ```env
   VITE_SYSTEM_ADMIN_EMAILS=admin1@yourcompany.com,admin2@yourcompany.com,admin3@yourcompany.com
   ```

3. **Disable Restriction**: Leave empty to allow all authenticated users:
   ```env
   VITE_SYSTEM_ADMIN_EMAILS=
   ```

**Security Note**: Only emails in this list can access the global admin page. Use this feature carefully in production environments.

### Running the Development Server

```bash
# Start the development server
npm run dev
```

The application will open at [http://localhost:8080](http://localhost:8080)

### Database Migrations

When you add or modify database functions, apply migrations to your Supabase project:

```bash
# Apply pending migrations
npx supabase db push

# Generate TypeScript types from database schema
npx supabase gen types typescript --project-id your-project-id
```

## Project Structure

```
src/
├── components/          # React components
│   ├── ui/               # shadcn/ui base components
│   ├── CashCalculator.tsx
│   ├── CategoryManager.tsx
│   ├── ExportProjectSetup.tsx
│   └── ...
├── hooks/               # Custom React hooks
│   ├── useAuth.tsx
│   ├── useProjects.tsx
│   ├── useGlobalAdmin.tsx
│   └── ...
├── integrations/
│   └── supabase/
│       ├── client.ts   # Supabase client instance
│       └── types.ts    # Auto-generated database types
├── lib/
│   ├── i18n.ts        # Internationalization (en, ko)
│   └── utils.ts        # Utility functions
├── pages/               # Route pages
│   ├── Dashboard.tsx
│   ├── AdminPage.tsx
│   ├── GlobalAdminPage.tsx
│   └── ...
└── main.tsx             # Application entry point

supabase/
└── migrations/         # Database schema migrations
    ├── initial_schema.sql
    └── 2026031500002_update_global_admin_functions.sql
```

## Testing

Run the test suite:

```bash
# Run tests once
npm test

# Run tests in watch mode
npm run test:watch
```

### Test Configuration

The project uses Vitest with jsdom environment. For features that require Web Crypto API (like PIN storage), a custom polyfill is implemented in `src/test/setup.ts`.

**See documentation**: [Crypto API Polyfill for Testing](docs/crypto-polyfill-for-testing.md)

#### PIN Storage Tests

PIN-related functionality uses `crypto.subtle.digest()` for secure hashing. In the test environment, this is polyfilled to enable:

- PIN hashing and verification
- Secure storage operations
- Authentication flow testing

```bash
# Run PIN storage tests specifically
npm test -- --run src/lib/securePinStorage.test.ts src/components/PinSetupDialog.test.tsx
```

## Building for Production

```bash
# Create optimized production build
npm run build
```

The production files will be in the `dist/` directory.

## Deployment

This application is designed to be deployed on platforms like:
- Vercel
- Netlify
- Supabase Hosting
- Any static file hosting

### Environment Variables in Production

Make sure to set production environment variables in your hosting platform:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`
- `VITE_SYSTEM_ADMIN_EMAILS` (for system admin access control)

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Make your changes
4. Commit your changes: `git commit -m "Description of changes"`
5. Push to your fork: `git push origin feature/your-feature-name`
6. Create a Pull Request

## License

This project is open source and available under the [Apache License 2.0](LICENSE).

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a history of changes to this project.
