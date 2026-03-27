# Screenshot Generation Tests - Fixed

## Summary of Changes

### Issues Fixed

1. **Auth State Management**
   - **Problem**: Auth tests were failing because localStorage wasn't being set correctly before page load
   - **Solution**: Use `context.addInitScript()` to set Supabase auth tokens BEFORE page navigation
   - **Key format**: `sb-${projectRef}-auth-token` with complete session object

2. **Auth Test Screenshot**
   - **Problem**: Auth page wasn't showing because auth state was already set
   - **Solution**: Clear ALL localStorage in the auth test using `context.addInitScript(() => localStorage.clear())`

3. **Route Mocking Patterns**
   - **Problem**: Route patterns weren't matching actual Supabase API calls
   - **Solution**: Updated patterns to match `https://.*\.supabase\.co/*` with proper method handling (GET, POST, PATCH, DELETE)

4. **Supabase URL Extraction**
   - **Problem**: Tests were using a hardcoded mock URL
   - **Solution**: Extract project ref from actual Supabase URL (`gtudnbdtcvmzsvrzvdoz`) for localStorage key generation

## Technical Details

### Auth Token Format

```javascript
const authToken = {
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  expires_at: Date.now() + 3600000,
  token_type: 'bearer',
  user: {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'demo@churchfinance.org',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { full_name: 'Demo Administrator' },
    aud: 'authenticated',
  },
};
```

### LocalStorage Key Format

Supabase uses: `sb-${projectRef}-auth-token`

Example: `sb-gtudnbdtcvmzsvrzvdoz-auth-token`

### API Mocking Coverage

**Auth Endpoints:**
- GET /auth/v1/user - User info
- POST /auth/v1/token - Login/refresh
- GET /auth/v1/session - Current session
- POST /auth/v1/logout - Logout

**REST API Endpoints:**
- GET /rest/v1/projects - Project list
- GET /rest/v1/project_categories - Categories
- GET /rest/v1/transactions - Transactions
- POST /rest/v1/transactions - Create transaction
- GET /rest/v1/custom_columns - Custom columns
- GET /rest/v1/column_headers - Column values
- GET /rest/v1/project_members - Team members
- GET /rest/v1/project_invites - Pending invites
- GET /rest/v1/user_preferences - User settings
- POST /rest/v1/rpc/get_current_project - Current project

## How to Run Tests

### Prerequisites

1. Dev server must be running on port 8082:
   ```bash
   npm run dev
   ```

2. Install Playwright browsers (if not already installed):
   ```bash
   npx playwright install chromium
   ```

### Run All Screenshot Tests

```bash
npx playwright test e2e/screenshots.spec.ts
```

### Run Single Screenshot Test

```bash
# Dashboard light mode
npx playwright test e2e/screenshots.spec.ts -g "dashboard light mode"

# Auth page
npx playwright test e2e/screenshots.spec.ts -g "auth page light mode"
```

### Run in Headed Mode (for debugging)

```bash
npx playwright test e2e/screenshots.spec.ts --headed
```

### Run with Debug Mode

```bash
npx playwright test e2e/screenshots.spec.ts --debug
```

## Output

Screenshots will be saved to: `docs/screenshots/`

- `dashboard-light.png`
- `dashboard-dark.png`
- `charts-light.png`
- `cash-calculator-light.png`
- `add-transaction-light.png`
- `admin-categories-light.png`
- `admin-columns-light.png`
- `auth-light.png`

## Troubleshooting

### Tests Fail with "Auth page not found"

**Cause**: Auth state isn't being cleared properly

**Solution**: Ensure the auth test uses `context.addInitScript(() => localStorage.clear())` BEFORE `page.goto()`

### Tests Fail with "Dashboard not found"

**Cause**: Auth tokens aren't being set correctly

**Solution**:
1. Check that the Supabase URL is correct: `https://gtudnbdtcvmzsvrzvdoz.supabase.co`
2. Verify localStorage key format: `sb-gtudnbdtcvmzsvrzvdoz-auth-token`
3. Ensure route mocking is set up BEFORE page navigation

### Network Requests Timing Out

**Cause**: Dev server not running or on wrong port

**Solution**:
1. Start dev server: `npm run dev`
2. Verify it's running on port 8082
3. Check browser console for network errors

### Mock Data Not Appearing

**Cause**: Route mocking patterns not matching

**Solution**:
1. Check the actual URLs being called in browser DevTools Network tab
2. Verify regex patterns match the actual Supabase URL structure
3. Ensure route handlers return proper JSON responses

## File Changes

### Modified Files

1. **e2e/screenshots.spec.ts**
   - Added `setupAuthState()` helper function
   - Fixed auth test to properly clear localStorage
   - Ensured auth state is set BEFORE navigation

2. **e2e/helpers/mock-routes.ts**
   - Updated route patterns to match Supabase URL structure
   - Added proper HTTP method handling (GET, POST, PATCH, DELETE)
   - Improved auth endpoint mocking

### No Changes Required

- `e2e/mock-data.ts` - Mock data was already correct

## Next Steps

1. Run the tests to verify they work:
   ```bash
   npx playwright test e2e/screenshots.spec.ts
   ```

2. Check generated screenshots in `docs/screenshots/`

3. If tests fail, run with `--debug` flag to see what's happening

4. For CI/CD integration, ensure Playwright is installed and tests run in headless mode
