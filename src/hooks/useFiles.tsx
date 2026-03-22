// useFiles hook for file management operations
// SPEC: SPEC-STORAGE-001
// SPEC: SPEC-TRANSACTION-001
// Created: 2026-03-21
// Updated: 2026-03-21 - Added file type validation, UUID paths, real-time sync, sonner
// Updated: 2026-03-21 - Added transaction file association support

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  ProjectFile,
  MAX_FILE_SIZE,
  IMAGE_COMPRESSION_THRESHOLD,
  SIGNED_URL_EXPIRY,
  isFileTypeAllowed,
  getFileExtension,
  EXTENSION_TO_MIME,
} from '@/types/files';
import { toast } from 'sonner';
import { useI18n } from '@/hooks/useI18n';

// Image MIME types that can be compressed
const COMPRESSIBLE_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];

// Compression quality (0.1 to 1.0, where 1.0 is maximum quality)
const COMPRESSION_QUALITY = 0.8;

// Maximum size before attempting compression (1MB)
const COMPRESSION_THRESHOLD = IMAGE_COMPRESSION_THRESHOLD;


/**
 * Compress an image file using Canvas API
 * @param file - Original image file
 * @param quality - Compression quality (0-1)
 * @returns Promise<File> - Compressed file
 */
async function compressImage(file: File, quality: number = COMPRESSION_QUALITY): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Create canvas with original dimensions
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      // Draw image to canvas
      ctx.drawImage(img, 0, 0);

      // Compress and get blob
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to compress image'));
            return;
          }

          // Create new File object with compressed data
          const compressedFile = new File(
            [blob],
            file.name,
            {
              type: file.type,
              lastModified: Date.now(),
            }
          );

          resolve(compressedFile);
        },
        file.type,
        quality
      );
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    // Load image from file
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Auto-compress image if it exceeds size threshold
 * @param file - File to potentially compress
 * @returns Promise<File> - Original or compressed file
 */
async function autoCompressImageIfNeeded(file: File): Promise<File> {
  // Only compress images over threshold
  if (!COMPRESSIBLE_IMAGE_TYPES.includes(file.type) || file.size <= COMPRESSION_THRESHOLD) {
    return file;
  }

  const originalSizeMB = (file.size / (1024 * 1024)).toFixed(2);

  try {
    const compressed = await compressImage(file, COMPRESSION_QUALITY);
    const compressedSizeMB = (compressed.size / (1024 * 1024)).toFixed(2);
    const savings = ((1 - compressed.size / file.size) * 100).toFixed(0);

    console.log(
      `Image compressed: ${originalSizeMB}MB → ${compressedSizeMB}MB (${savings}% reduction)`
    );

    // Show notification to user
    toast.info(
      `Image compressed: ${originalSizeMB}MB → ${compressedSizeMB}MB (${savings}% smaller)`
    );

    // If compression didn't help much, still use compressed version
    return compressed;
  } catch (error) {
    console.error('Image compression failed:', error);
    // Fall back to original file if compression fails
    return file;
  }
}

// @MX:ANCHOR: Core file management hook with CRUD operations for project files
// @MX:REASON: High fan-in function used by FileManager and all file-related components
// @MX:SPEC: SPEC-STORAGE-001
export const useFiles = (projectId: string) => {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  // Query: List files sorted by newest first with uploader email
  const {
    data: files = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['project-files', projectId],
    queryFn: async () => {
      // Try RPC function first (includes uploader email)
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_project_files_with_email', {
        p_project_id: projectId,
      });

      // If RPC function exists, use it
      if (!rpcError && rpcData) {
        return rpcData as (ProjectFile & { uploader_email?: string })[];
      }

      // Fallback: Use direct query (uploader email won't be available)
      console.warn('RPC function not available, using fallback query');
      const { data, error } = await supabase
        .from('project_files')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ProjectFile[];
    },
    enabled: !!projectId,
  });

  // Download progress state
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadedBytes, setDownloadedBytes] = useState(0);

  // Real-time subscription for collaborative updates
  useEffect(() => {
    if (!projectId) return;

    const channel: RealtimeChannel = supabase
      .channel(`project-files-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'project_files',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          // Invalidate query on any change to refresh file list
          queryClient.invalidateQueries({ queryKey: ['project-files', projectId] });
        }
      )
      .subscribe();

    // Cleanup: unsubscribe on unmount
    return () => {
      channel.unsubscribe();
    };
  }, [projectId, queryClient]);

  // Mutation: Upload file
  const uploadFileMutation = useMutation({
    mutationFn: async (params: { file: File; remark?: string; transactionId?: string }) => {
      const { file, remark = '', transactionId } = params;

      // Resolve MIME type: use file.type, fallback to extension-based detection
      let resolvedMime = file.type;
      if (!resolvedMime || resolvedMime === '') {
        const ext = getFileExtension(file.name);
        resolvedMime = EXTENSION_TO_MIME[ext] || '';
      }

      // SPEC-STORAGE-001: Auto-compress images over 1MB
      const fileToUpload = await autoCompressImageIfNeeded(file);

      // Create a File-like object with resolved MIME for validation
      const fileForValidation = {
        ...fileToUpload,
        type: resolvedMime,
      } as File;

      // Validate file type first (before any upload/storage logic)
      if (!isFileTypeAllowed(fileForValidation)) {
        throw new Error(t('files.invalidFileType') || 'File type not allowed');
      }

      // Validate file size (after compression)
      if (fileToUpload.size > MAX_FILE_SIZE) {
        const maxSizeMB = MAX_FILE_SIZE / (1024 * 1024);
        throw new Error(
          t('files.sizeExceeds').replace('{size}', `${maxSizeMB} MB`) ||
          `File size exceeds ${maxSizeMB} MB limit`
        );
      }

      // Get current user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error(t('files.notAuthenticated') || 'User not authenticated');
      }

      // Generate UUID for this file (used for both DB row and storage path)
      const fileId = crypto.randomUUID();

      // Get file extension for content-type detection
      const ext = getFileExtension(file.name);

      // Use UUID as storage filename (Supabase Storage doesn't support Unicode in keys)
      // Original filename is preserved in database for display
      const storagePath = `projects/${projectId}/files/${fileId}${ext}`;

      // Upload to Supabase Storage with resolved MIME type
      const { error: uploadError } = await supabase.storage
        .from('project-files')
        .upload(storagePath, fileToUpload, {
          cacheControl: '3600',
          upsert: false,
          contentType: resolvedMime,
        });

      if (uploadError) {
        throw new Error(`${t('files.uploadFailed') || 'Failed to upload file'}: ${uploadError.message}`);
      }

      // Insert metadata into project_files table with explicit id and resolved MIME
      const { data: fileData, error: insertError } = await supabase
        .from('project_files')
        .insert({
          id: fileId, // Use the same UUID
          project_id: projectId,
          uploaded_by: user.id,
          file_name: file.name, // Keep original filename
          file_type: resolvedMime, // Use resolved MIME type
          file_size: fileToUpload.size, // Use compressed file size
          storage_path: storagePath,
          remark: remark.trim() || null, // Add remark field
          transaction_id: transactionId || null, // Add transaction association
        })
        .select()
        .single();

      if (insertError) {
        // Cleanup: delete uploaded file if metadata insert fails
        await supabase.storage.from('project-files').remove([storagePath]);
        throw new Error(`${t('files.saveMetadataFailed') || 'Failed to save file metadata'}: ${insertError.message}`);
      }

      return fileData as ProjectFile;
    },
    onSuccess: () => {
      toast.success(t('files.uploaded') || 'File uploaded successfully');
      // Invalidate query to refresh file list
      queryClient.invalidateQueries({ queryKey: ['project-files', projectId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Mutation: Download file (returns Blob with progress tracking)
  const downloadFileMutation = useMutation({
    mutationFn: async (file: ProjectFile): Promise<Blob> => {
      // Generate signed URL
      const { data, error } = await supabase.storage
        .from('project-files')
        .createSignedUrl(file.storage_path, SIGNED_URL_EXPIRY);

      if (error) {
        throw new Error(`${t('files.downloadFailed') || 'Failed to generate download URL'}: ${error.message}`);
      }

      // Reset progress state
      setDownloadProgress(0);
      setDownloadedBytes(0);

      // Perform actual download using fetch with progress tracking
      const response = await fetch(data.signedUrl);
      if (!response.ok) {
        throw new Error(t('files.downloadError') || 'Download failed');
      }

      const contentLength = response.headers.get('Content-Length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;

      // Read response body as stream for progress tracking
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error(t('files.downloadError') || 'Download failed');
      }

      const chunks: BlobPart[] = [];
      let received = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        received += value.length;
        setDownloadedBytes(received);

        if (total > 0) {
          setDownloadProgress(Math.round((received / total) * 100));
        }
      }

      // Combine chunks into single Blob
      return new Blob(chunks);
    },
    onSuccess: () => {
      setDownloadProgress(100);
      // Reset progress after a short delay
      setTimeout(() => {
        setDownloadProgress(0);
        setDownloadedBytes(0);
      }, 1000);
    },
    onError: (error: Error) => {
      toast.error(error.message);
      setDownloadProgress(0);
      setDownloadedBytes(0);
    },
  });

  // Mutation: Delete file
  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: string) => {
      // Get file metadata first (scoped to project_id)
      const { data: fileData, error: fetchError } = await supabase
        .from('project_files')
        .select('storage_path')
        .eq('id', fileId)
        .eq('project_id', projectId) // Scope to current project
        .single();

      if (fetchError) {
        throw new Error(`${t('files.fetchFailed') || 'Failed to fetch file metadata'}: ${fetchError.message}`);
      }

      // Delete metadata from database FIRST (safer - can rollback storage delete)
      const { error: deleteError } = await supabase
        .from('project_files')
        .delete()
        .eq('id', fileId)
        .eq('project_id', projectId); // Scope to current project

      if (deleteError) {
        throw new Error(`${t('files.deleteFailed') || 'Failed to delete file metadata'}: ${deleteError.message}`);
      }

      // Delete from Supabase Storage (after DB delete succeeds)
      const { error: storageError } = await supabase.storage
        .from('project-files')
        .remove([fileData.storage_path]);

      if (storageError) {
        throw new Error(`${t('files.storageDeleteFailed') || 'Failed to delete file from storage'}: ${storageError.message}`);
      }
    },
    onSuccess: () => {
      toast.success(t('files.deleted') || 'File deleted');
      // Invalidate query to refresh file list
      queryClient.invalidateQueries({ queryKey: ['project-files', projectId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Mutation: Update file metadata
  const updateFileMutation = useMutation({
    mutationFn: async (params: { fileId: string; remark: string | null }) => {
      const { fileId, remark } = params;
      const { data, error } = await supabase
        .from('project_files')
        .update({ remark: remark?.trim() || null })
        .eq('id', fileId)
        .eq('project_id', projectId)
        .select()
        .single();

      if (error) {
        throw new Error(`${t('files.updateFailed') || 'Failed to update file metadata'}: ${error.message}`);
      }

      return data as ProjectFile;
    },
    onSuccess: () => {
      toast.success(t('files.updated') || 'File updated');
      queryClient.invalidateQueries({ queryKey: ['project-files', projectId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // NEW: Get files for a specific transaction
  const getTransactionFiles = (transactionId: string) => {
    return files.filter(f => f.transaction_id === transactionId);
  };

  return {
    files,
    isLoading,
    error,
    uploadFile: uploadFileMutation.mutateAsync,
    isUploading: uploadFileMutation.isPending,
    downloadFile: downloadFileMutation.mutateAsync,
    isDownloading: downloadFileMutation.isPending,
    downloadProgress,
    downloadedBytes,
    deleteFile: deleteFileMutation.mutateAsync,
    isDeleting: deleteFileMutation.isPending,
    updateFile: updateFileMutation.mutateAsync,
    isUpdating: updateFileMutation.isPending,
    getTransactionFiles,
  };
};
