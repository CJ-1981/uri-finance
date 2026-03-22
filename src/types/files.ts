// File management types
// SPEC: SPEC-STORAGE-001
// Created: 2026-03-21

import { Database } from '@/integrations/supabase/types';

export type ProjectFile = Database['public']['Tables']['project_files']['Row'];

export type FileUploadResult = {
  file: ProjectFile;
  path: string;
};

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB in bytes (Supabase limit)
export const IMAGE_COMPRESSION_THRESHOLD = 1 * 1024 * 1024; // 1 MB (Threshold to trigger image compression)
export const SIGNED_URL_EXPIRY = 60 * 60; // 60 minutes in seconds

// Allowed file types for upload (MIME types)
// Archive types removed for security: only documents and images allowed
export const ALLOWED_FILE_TYPES = [
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
] as const;

// Map file extensions to MIME types (for fallback validation)
// Archive extensions removed for security: only documents and images allowed
export const EXTENSION_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.csv': 'text/csv',
  '.txt': 'text/plain',
};

/**
 * Get file extension from filename
 * @param filename - File name
 * @returns Lowercase file extension with dot (e.g., ".pdf")
 */
export const getFileExtension = (filename: string): string => {
  const ext = filename.toLowerCase().split('.').pop();
  return ext ? `.${ext}` : '';
};

/**
 * Check if file type is allowed
 * @param file - File to validate
 * @returns true if file type is allowed
 */
export const isFileTypeAllowed = (file: File): boolean => {
  // Check MIME type first
  if (file.type && (ALLOWED_FILE_TYPES as readonly string[]).includes(file.type)) {
    return true;
  }

  // Fallback: check file extension
  const ext = getFileExtension(file.name);
  const expectedMime = EXTENSION_TO_MIME[ext];
  if (expectedMime) {
    return (ALLOWED_FILE_TYPES as readonly string[]).includes(expectedMime);
  }

  return false;
};
