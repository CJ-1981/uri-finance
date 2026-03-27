/**
 * Mock data for screenshot generation tests
 * Provides realistic data matching Supabase schema
 */

export const MOCK_AUTH = {
  user: {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'demo@churchfinance.org',
    user_metadata: {
      full_name: 'Demo Administrator',
    },
    app_metadata: {
      provider: 'email',
      providers: ['email'],
    },
    aud: 'authenticated',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  session: {
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'demo@churchfinance.org',
    },
  },
};

export const MOCK_PROJECTS = [
  {
    id: '10000000-0000-0000-0000-000000000001',
    name: 'Demo Church Finance',
    description: 'Sample church finance project for demonstration',
    currency: 'USD',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    user_id: MOCK_AUTH.user.id,
  },
];

export const MOCK_CATEGORIES = [
  {
    id: '20000000-0000-0000-0000-000000000001',
    project_id: MOCK_PROJECTS[0].id,
    name: 'Tithes',
    type: 'income',
    created_at: new Date().toISOString(),
  },
  {
    id: '20000000-0000-0000-0000-000000000002',
    project_id: MOCK_PROJECTS[0].id,
    name: 'Offerings',
    type: 'income',
    created_at: new Date().toISOString(),
  },
  {
    id: '20000000-0000-0000-0000-000000000003',
    project_id: MOCK_PROJECTS[0].id,
    name: 'Missions',
    type: 'expense',
    created_at: new Date().toISOString(),
  },
  {
    id: '20000000-0000-0000-0000-000000000004',
    project_id: MOCK_PROJECTS[0].id,
    name: 'Building Fund',
    type: 'expense',
    created_at: new Date().toISOString(),
  },
  {
    id: '20000000-0000-0000-0000-000000000005',
    project_id: MOCK_PROJECTS[0].id,
    name: 'Utilities',
    type: 'expense',
    created_at: new Date().toISOString(),
  },
  {
    id: '20000000-0000-0000-0000-000000000006',
    project_id: MOCK_PROJECTS[0].id,
    name: 'Staff Salaries',
    type: 'expense',
    created_at: new Date().toISOString(),
  },
];

export const MOCK_TRANSACTIONS = [
  // Income transactions
  {
    id: '30000000-0000-0000-0000-000000000001',
    project_id: MOCK_PROJECTS[0].id,
    date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days ago
    amount: 5000,
    category_id: MOCK_CATEGORIES[0].id, // Tithes
    description: 'Sunday Service Tithes',
    type: 'income',
    created_at: new Date().toISOString(),
  },
  {
    id: '30000000-0000-0000-0000-000000000002',
    project_id: MOCK_PROJECTS[0].id,
    date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 6 days ago
    amount: 2500,
    category_id: MOCK_CATEGORIES[1].id, // Offerings
    description: 'Special Offering',
    type: 'income',
    created_at: new Date().toISOString(),
  },
  {
    id: '30000000-0000-0000-0000-000000000003',
    project_id: MOCK_PROJECTS[0].id,
    date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 5 days ago
    amount: 1200,
    category_id: MOCK_CATEGORIES[0].id, // Tithes
    description: 'Wednesday Service Tithes',
    type: 'income',
    created_at: new Date().toISOString(),
  },
  // Expense transactions
  {
    id: '30000000-0000-0000-0000-000000000004',
    project_id: MOCK_PROJECTS[0].id,
    date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 4 days ago
    amount: 350,
    category_id: MOCK_CATEGORIES[4].id, // Utilities
    description: 'Electric Bill',
    type: 'expense',
    created_at: new Date().toISOString(),
  },
  {
    id: '30000000-0000-0000-0000-000000000005',
    project_id: MOCK_PROJECTS[0].id,
    date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 3 days ago
    amount: 4500,
    category_id: MOCK_CATEGORIES[5].id, // Staff Salaries
    description: 'Pastor Salary',
    type: 'expense',
    created_at: new Date().toISOString(),
  },
  {
    id: '30000000-0000-0000-0000-000000000006',
    project_id: MOCK_PROJECTS[0].id,
    date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2 days ago
    amount: 800,
    category_id: MOCK_CATEGORIES[2].id, // Missions
    description: 'Monthly Mission Support',
    type: 'expense',
    created_at: new Date().toISOString(),
  },
];

export const MOCK_CUSTOM_COLUMNS = [
  {
    id: '40000000-0000-0000-0000-000000000001',
    project_id: MOCK_PROJECTS[0].id,
    name: 'Check Number',
    data_type: 'text',
    options: null,
    display_order: 0,
    created_at: new Date().toISOString(),
  },
  {
    id: '40000000-0000-0000-0000-000000000002',
    project_id: MOCK_PROJECTS[0].id,
    name: 'Fiscal Year',
    data_type: 'select',
    options: ['2024', '2025', '2026'],
    display_order: 1,
    created_at: new Date().toISOString(),
  },
];

export const MOCK_COLUMN_HEADERS = [
  {
    transaction_id: MOCK_TRANSACTIONS[0].id,
    custom_column_id: MOCK_CUSTOM_COLUMNS[0].id,
    value: '1001',
    display_order: 0,
  },
  {
    transaction_id: MOCK_TRANSACTIONS[1].id,
    custom_column_id: MOCK_CUSTOM_COLUMNS[1].id,
    value: '2025',
    display_order: 0,
  },
];

export const MOCK_MEMBERS = [
  {
    id: '50000000-0000-0000-0000-000000000001',
    project_id: MOCK_PROJECTS[0].id,
    email: 'member1@church.org',
    full_name: 'John Smith',
    role: 'admin',
    created_at: new Date().toISOString(),
  },
  {
    id: '50000000-0000-0000-0000-000000000002',
    project_id: MOCK_PROJECTS[0].id,
    email: 'member2@church.org',
    full_name: 'Jane Doe',
    role: 'member',
    created_at: new Date().toISOString(),
  },
];

export const MOCK_INVITES = [
  {
    id: '60000000-0000-0000-0000-000000000001',
    project_id: MOCK_PROJECTS[0].id,
    email: 'invited@church.org',
    role: 'member',
    status: 'pending',
    created_at: new Date().toISOString(),
  },
];
