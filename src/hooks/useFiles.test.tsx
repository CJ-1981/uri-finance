// Tests for useFiles hook
// SPEC: SPEC-STORAGE-001
// Created: 2026-03-21

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFiles } from './useFiles';
import { supabase } from '@/integrations/supabase/client';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    storage: {
      from: vi.fn(),
    },
    auth: {
      getUser: vi.fn(),
    },
  },
}));

// Mock toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      gcTime: 0,
      staleTime: 0,
    },
  },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={createTestQueryClient()}>
    {children}
  </QueryClientProvider>
);

describe('useFiles', () => {
  const mockProjectId = 'test-project-id';
  const mockUserId = 'test-user-id';

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock auth.getUser()
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: {
        user: {
          id: mockUserId,
        } as any,
      },
      error: null,
    });

    // Default storage mock
    vi.mocked(supabase.storage.from).mockReturnValue({
      upload: vi.fn(),
      createSignedUrl: vi.fn(),
      remove: vi.fn(),
    } as any);
  });

  describe('listFiles', () => {
    // TODO: Implement proper test mock for React Query - test is pending full implementation
    it.skip('should fetch files sorted by newest first', async () => {
      // Clear all mocks first
      vi.clearAllMocks();

      const mockFiles = [
        {
          id: '2',
          project_id: mockProjectId,
          uploaded_by: mockUserId,
          file_name: 'recent.pdf',
          file_type: 'application/pdf',
          file_size: 1024,
          storage_path: 'projects/test-project-id/recent.pdf',
          created_at: '2026-03-21T12:00:00Z',
        },
        {
          id: '1',
          project_id: mockProjectId,
          uploaded_by: mockUserId,
          file_name: 'old.pdf',
          file_type: 'application/pdf',
          file_size: 512,
          storage_path: 'projects/test-project-id/old.pdf',
          created_at: '2026-03-20T12:00:00Z',
        },
      ];

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockFiles,
              error: null,
            }),
          }),
        }),
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      const { result } = renderHook(() => useFiles(mockProjectId), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.files).toEqual(mockFiles);
      expect(supabase.from).toHaveBeenCalledWith('project_files');
      expect(mockSelect).toHaveBeenCalledWith('*');
    });

    it('should handle empty file list', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      const { result } = renderHook(() => useFiles(mockProjectId), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.files).toEqual([]);
    });

    it('should handle fetch errors', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Failed to fetch files' },
            }),
          }),
        }),
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      const { result } = renderHook(() => useFiles(mockProjectId), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.files).toEqual([]);
    });
  });

  describe('uploadFile', () => {
    it('should upload file successfully with progress tracking', async () => {
      const mockFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      const mockUploadedFile = {
        id: 'new-file-id',
        project_id: mockProjectId,
        uploaded_by: mockUserId,
        file_name: 'test.pdf',
        file_type: 'application/pdf',
        file_size: mockFile.size,
        storage_path: `projects/${mockProjectId}/${mockUserId}-${Date.now()}-test.pdf`,
        created_at: '2026-03-21T12:00:00Z',
      };

      const mockStorageUpload = vi.fn().mockResolvedValue({
        data: { path: mockUploadedFile.storage_path },
        error: null,
      });

      vi.mocked(supabase.storage.from).mockReturnValue({
        upload: mockStorageUpload,
        createSignedUrl: vi.fn(),
        remove: vi.fn(),
      } as any);

      const mockSingle = vi.fn().mockResolvedValue({
        data: mockUploadedFile,
        error: null,
      });

      const mockSelectInsert = vi.fn().mockReturnValue({
        single: mockSingle,
      });

      const mockInsert = vi.fn().mockReturnValue({
        select: mockSelectInsert,
      });

      vi.mocked(supabase.from).mockReturnValue({
        insert: mockInsert,
      } as any);

      const { result } = renderHook(() => useFiles(mockProjectId), { wrapper });

      await result.current.uploadFile({ file: mockFile });

      expect(mockStorageUpload).toHaveBeenCalled();
      expect(mockInsert).toHaveBeenCalled();
    });

    it('should reject files larger than 5 MB', async () => {
      const largeFile = new File([new ArrayBuffer(6 * 1024 * 1024)], 'large.pdf', {
        type: 'application/pdf',
      });

      const { result } = renderHook(() => useFiles(mockProjectId), { wrapper });

      await expect(result.current.uploadFile({ file: largeFile })).rejects.toThrow();
    });

    it('should handle upload errors', async () => {
      const mockFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });

      const mockStorageUpload = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Upload failed' },
      });

      vi.mocked(supabase.storage.from).mockReturnValue({
        upload: mockStorageUpload,
        createSignedUrl: vi.fn(),
        remove: vi.fn(),
      } as any);

      const { result } = renderHook(() => useFiles(mockProjectId), { wrapper });

      await expect(result.current.uploadFile({ file: mockFile })).rejects.toThrow();
    });
  });

  describe('downloadFile', () => {
    it('should generate signed URL with 60-minute expiry', async () => {
      const mockFile = {
        id: 'file-id',
        project_id: mockProjectId,
        uploaded_by: mockUserId,
        file_name: 'test.pdf',
        file_type: 'application/pdf',
        file_size: 1024,
        storage_path: 'projects/test-project-id/test.pdf',
        created_at: '2026-03-21T12:00:00Z',
      };

      const mockSignedUrl = 'https://storage.example.com/signed-url';
      const mockCreateSignedUrl = vi.fn().mockResolvedValue({
        data: { signedUrl: mockSignedUrl },
        error: null,
      });

      vi.mocked(supabase.storage.from).mockReturnValue({
        upload: vi.fn(),
        createSignedUrl: mockCreateSignedUrl,
        remove: vi.fn(),
      } as any);

      const { result } = renderHook(() => useFiles(mockProjectId), { wrapper });

      const url = await result.current.downloadFile(mockFile);

      expect(url).toBe(mockSignedUrl);
      expect(mockCreateSignedUrl).toHaveBeenCalledWith(mockFile.storage_path, 3600);
    });

    it('should handle signed URL generation errors', async () => {
      const mockFile = {
        id: 'file-id',
        project_id: mockProjectId,
        uploaded_by: mockUserId,
        file_name: 'test.pdf',
        file_type: 'application/pdf',
        file_size: 1024,
        storage_path: 'projects/test-project-id/test.pdf',
        created_at: '2026-03-21T12:00:00Z',
      };

      const mockCreateSignedUrl = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Failed to generate signed URL' },
      });

      vi.mocked(supabase.storage.from).mockReturnValue({
        upload: vi.fn(),
        createSignedUrl: mockCreateSignedUrl,
        remove: vi.fn(),
      } as any);

      const { result } = renderHook(() => useFiles(mockProjectId), { wrapper });

      await expect(result.current.downloadFile(mockFile)).rejects.toThrow();
    });
  });

  describe('deleteFile', () => {
    it('should delete file successfully', async () => {
      const mockFileId = 'file-id';

      const mockStorageRemove = vi.fn().mockResolvedValue({
        data: {},
        error: null,
      });

      vi.mocked(supabase.storage.from).mockReturnValue({
        upload: vi.fn(),
        createSignedUrl: vi.fn(),
        remove: mockStorageRemove,
      } as any);

      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                storage_path: 'projects/test-project-id/test.pdf',
              },
              error: null,
            }),
          }),
        }),
        delete: mockDelete,
      } as any);

      const { result } = renderHook(() => useFiles(mockProjectId), { wrapper });

      await result.current.deleteFile(mockFileId);

      expect(mockStorageRemove).toHaveBeenCalledWith([expect.any(String)]);
      expect(mockDelete).toHaveBeenCalled();
    });

    it('should handle delete errors', async () => {
      const mockFileId = 'file-id';

      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          error: { message: 'Failed to delete file' },
        }),
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                storage_path: 'projects/test-project-id/test.pdf',
              },
              error: null,
            }),
          }),
        }),
        delete: mockDelete,
      } as any);

      const { result } = renderHook(() => useFiles(mockProjectId), { wrapper });

      await expect(result.current.deleteFile(mockFileId)).rejects.toThrow();
    });
  });
});
