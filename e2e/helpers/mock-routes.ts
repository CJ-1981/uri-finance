/**
 * Helper functions to mock Supabase API routes for screenshot generation
 */

import { Page } from '@playwright/test';
import {
  MOCK_AUTH,
  MOCK_PROJECTS,
  MOCK_CATEGORIES,
  MOCK_TRANSACTIONS,
  MOCK_CUSTOM_COLUMNS,
  MOCK_COLUMN_HEADERS,
  MOCK_MEMBERS,
  MOCK_INVITES,
} from '../mock-data';

export async function mockSupabaseRoutes(page: Page) {
  // Mock all auth-related routes with wildcard
  // Pattern: https://gtudnbdtcvmzsvrzvdoz.supabase.co/auth/v1/*
  await page.route(/https:\/\/.*\.supabase\.co\/auth\/v1\/.*/, async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    // GET /user - Return user info
    if (url.includes('/user') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { user: MOCK_AUTH.user } }),
      });
      return;
    }

    // POST /token - Login/refresh
    if (url.includes('/token') && method === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { session: MOCK_AUTH.session, user: MOCK_AUTH.user },
        }),
      });
      return;
    }

    // GET /session - Get current session
    if (url.includes('/session') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [MOCK_AUTH.session] }),
      });
      return;
    }

    // POST /logout - Logout
    if (url.includes('/logout') && method === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{}',
      });
      return;
    }

    // Default auth response
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{}',
    });
  });

  // Mock all REST API routes with wildcard
  // Pattern: https://gtudnbdtcvmzsvrzvdoz.supabase.co/rest/v1/*
  await page.route(/https:\/\/.*\.supabase\.co\/rest\/v1\/.*/, async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    // Projects endpoint
    if (url.includes('/projects')) {
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_PROJECTS),
          headers: {
            'Content-Range': '0-0/*',
            'Content-Type': 'application/json',
          },
        });
        return;
      }
    }

    // Categories endpoint (project_categories)
    if (url.includes('/project_categories') || url.includes('categories')) {
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_CATEGORIES),
          headers: {
            'Content-Range': '0-5/*',
            'Content-Type': 'application/json',
          },
        });
        return;
      }
    }

    // Transactions endpoint
    if (url.includes('/transactions')) {
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_TRANSACTIONS),
          headers: {
            'Content-Range': '0-5/*',
            'Content-Type': 'application/json',
          },
        });
        return;
      }

      // POST for creating transactions
      if (method === 'POST') {
        const newTransaction = {
          ...MOCK_TRANSACTIONS[0],
          id: '30000000-0000-0000-0000-000000000999',
          description: 'New Transaction',
        };
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify([newTransaction]),
        });
        return;
      }
    }

    // Custom columns endpoint
    if (url.includes('/custom_columns')) {
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_CUSTOM_COLUMNS),
          headers: {
            'Content-Range': '0-1/*',
            'Content-Type': 'application/json',
          },
        });
        return;
      }
    }

    // Column headers endpoint
    if (url.includes('/column_headers')) {
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_COLUMN_HEADERS),
          headers: {
            'Content-Range': '0-1/*',
            'Content-Type': 'application/json',
          },
        });
        return;
      }
    }

    // Project members endpoint
    if (url.includes('/project_members')) {
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_MEMBERS),
          headers: {
            'Content-Range': '0-1/*',
            'Content-Type': 'application/json',
          },
        });
        return;
      }
    }

    // Project invites endpoint
    if (url.includes('/project_invites')) {
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_INVITES),
          headers: {
            'Content-Range': '0-0/*',
            'Content-Type': 'application/json',
          },
        });
        return;
      }
    }

    // User preferences endpoint
    if (url.includes('/user_preferences')) {
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              user_id: MOCK_AUTH.user.id,
              default_project_id: MOCK_PROJECTS[0].id,
            },
          ]),
          headers: {
            'Content-Range': '0-0/*',
            'Content-Type': 'application/json',
          },
        });
        return;
      }
    }

    // RPC calls
    if (url.includes('/rpc/')) {
      if (url.includes('get_current_project')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_PROJECTS[0]),
        });
        return;
      }

      // Default empty response for other RPC calls
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '[]',
      });
      return;
    }

    // Handle PATCH/DELETE requests
    if (method === 'PATCH' || method === 'DELETE') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{}',
      });
      return;
    }

    // Default response for unmatched routes
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '[]',
    });
  });
}
