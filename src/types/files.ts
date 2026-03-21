// File management types
// SPEC: SPEC-STORAGE-001
// Created: 2026-03-21

import { Database } from '@/integrations/supabase/types';

export type ProjectFile = Database['public']['Tables']['project_files']['Row'];

export type FileUploadProgress = {
  loaded: number;
  total: number;
  percentage: number;
};

export type FileUploadResult = {
  file: ProjectFile;
  path: string;
};

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB in bytes
export const SIGNED_URL_EXPIRY = 60 * 60; // 60 minutes in seconds
