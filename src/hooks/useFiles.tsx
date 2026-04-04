// useFiles hook for file management operations
// SPEC: SPEC-STORAGE-001
// SPEC: SPEC-TRANSACTION-001
// Created: 2026-03-21
// Updated: 2026-03-21 - Added file type validation, UUID paths, real-time sync, sonner
// Updated: 2026-03-21 - Added transaction file association support

import { useMutation, useQuery, useQueryClient, useMutationState } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { get, set, update, del } from 'idb-keyval';
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
import { isNetworkError } from '@/lib/networkUtils';

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
 */
async function compressImage(file: File, quality: number = COMPRESSION_QUALITY): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to compress image'));
            return;
          }
          const compressedFile = new File([blob], file.name, { type: file.type, lastModified: Date.now() });
          resolve(compressedFile);
        },
        file.type,
        quality
      );
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    const reader = new FileReader();
    reader.onload = (e) => { img.src = e.target?.result as string; };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Auto-compress image if it exceeds size threshold
 */
async function autoCompressImageIfNeeded(file: File): Promise<File> {
  if (!COMPRESSIBLE_IMAGE_TYPES.includes(file.type) || file.size <= COMPRESSION_THRESHOLD) {
    return file;
  }
  const originalSizeMB = (file.size / (1024 * 1024)).toFixed(2);
  try {
    const compressed = await compressImage(file, COMPRESSION_QUALITY);
    const compressedSizeMB = (compressed.size / (1024 * 1024)).toFixed(2);
    const savings = ((1 - compressed.size / file.size) * 100).toFixed(0);
    console.log(`Image compressed: ${originalSizeMB}MB → ${compressedSizeMB}MB (${savings}% reduction)`);
    toast.info(`Image compressed: ${originalSizeMB}MB → ${compressedSizeMB}MB (${savings}% smaller)`);
    return compressed;
  } catch (error) {
    console.error('Image compression failed:', error);
    return file;
  }
}

export const useFiles = (projectId: string) => {
  const { isStandalone } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();

  // Track pending and recently successful "delete" IDs
  const pendingDeletes = useMutationState({
    filters: { mutationKey: ["deleteFile", projectId] },
    select: (mutation) => {
      const isRecent = mutation.state.status === "success" && (Date.now() - mutation.state.submittedAt < 60000);
      if (mutation.state.status === "pending" || isRecent) {
        return mutation.state.variables as string;
      }
      return null;
    },
  }).filter(Boolean);

  const {
    data: files = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['project-files', projectId],
    queryFn: async () => {
      if (isStandalone) {
        const localFiles = await get(`files-metadata-${projectId}`);
        return (localFiles || []) as ProjectFile[];
      }
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_project_files_with_email', {
        p_project_id: projectId,
      });
      if (!rpcError && rpcData) return rpcData as (ProjectFile & { uploader_email?: string })[];
      const { data, error } = await supabase.from('project_files').select('*').eq('project_id', projectId).order('created_at', { ascending: false });
      if (error) throw error;
      return data as ProjectFile[];
    },
    enabled: !!projectId,
  });

  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadedBytes, setDownloadedBytes] = useState(0);

  useEffect(() => {
    if (!projectId || isStandalone) return;
    const channel: RealtimeChannel = supabase.channel(`project-files-${projectId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'project_files', filter: `project_id=eq.${projectId}` },
        () => queryClient.invalidateQueries({ queryKey: ['project-files', projectId] })
      ).subscribe();
    return () => { channel.unsubscribe(); };
  }, [projectId, queryClient, isStandalone]);

  const uploadFileMutation = useMutation({
    mutationKey: ["uploadFile", projectId],
    mutationFn: async (params: { file: File; remark?: string; transactionId?: string }) => {
      const { file, remark = '', transactionId } = params;
      let resolvedMime = file.type;
      if (!resolvedMime || resolvedMime === '') {
        const ext = getFileExtension(file.name);
        resolvedMime = EXTENSION_TO_MIME[ext] || '';
      }
      const fileToUpload = await autoCompressImageIfNeeded(file);
      
      // Construct an actual File instance using constructor
      const fileForValidation = new File([fileToUpload], fileToUpload.name, {
        type: resolvedMime,
        lastModified: fileToUpload.lastModified
      });

      if (!isFileTypeAllowed(fileForValidation)) throw new Error(t('files.invalidFileType') || 'File type not allowed');
      if (fileToUpload.size > MAX_FILE_SIZE) throw new Error(t('files.sizeExceeds').replace('{size}', `${MAX_FILE_SIZE / (1024 * 1024)} MB`));

      const fileId = crypto.randomUUID();

      if (isStandalone) {
        // Create local metadata
        const newFileMetadata: ProjectFile = {
          id: fileId,
          project_id: projectId,
          uploaded_by: 'standalone-user',
          file_name: file.name,
          file_type: resolvedMime,
          file_size: fileToUpload.size,
          storage_path: `standalone/${projectId}/${fileId}`,
          remark: remark.trim() || null,
          transaction_id: transactionId || null,
          created_at: new Date().toISOString(),
        };

        // Store file content
        await set(`file-content-${fileId}`, fileToUpload);

        // Store metadata
        await update(`files-metadata-${projectId}`, (old: any) => [newFileMetadata, ...(old || [])]);

        return newFileMetadata;
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error(t('files.notAuthenticated') || 'User not authenticated');
      const ext = getFileExtension(file.name);
      const storagePath = `projects/${projectId}/files/${fileId}${ext}`;
      const { error: uploadError } = await supabase.storage.from('project-files').upload(storagePath, fileToUpload, { cacheControl: '3600', upsert: false, contentType: resolvedMime });
      if (uploadError) throw new Error(`${t('files.uploadFailed') || 'Failed to upload file'}: ${uploadError.message}`);
      const { data: fileData, error: insertError } = await supabase.from('project_files').insert({ id: fileId, project_id: projectId, uploaded_by: user.id, file_name: file.name, file_type: resolvedMime, file_size: fileToUpload.size, storage_path: storagePath, remark: remark.trim() || null, transaction_id: transactionId || null }).select().single();
      if (insertError) {
        await supabase.storage.from('project-files').remove([storagePath]);
        throw new Error(`${t('files.saveMetadataFailed') || 'Failed to save file metadata'}: ${insertError.message}`);
      }
      return fileData as ProjectFile;
    },
    onSuccess: () => {
      toast.success(t('files.uploaded') || 'File uploaded successfully');
    },
    onError: (error: Error) => {
      if (isNetworkError(error)) return;
      toast.error(error.message);
    },
    onSettled: () => {
      // Always invalidate queries to support offline/standalone mode
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['project-files', projectId] });
      }, 2000);
    },
  });

  const uploadFilesBatchMutation = useMutation({
    mutationKey: ["uploadFilesBatch", projectId],
    mutationFn: async ({ files, transactionId, onProgress }: { files: Array<{ file: File; remark?: string }>; transactionId?: string; onProgress?: (current: number, total: number) => void }) => {

      // Process files sequentially using the exact same logic as single file upload
      const results: ProjectFile[] = [];
      // Track successful uploads for rollback in case of error
      const successfulUploads: Array<{ fileId: string; storagePath?: string; isStandalone: boolean }> = [];

      try {
        // Get authenticated user once before the loop (for non-standalone mode)
        let user: any | null = null;
        if (!isStandalone) {
          const { data: { user: authUser }, error: userError } = await supabase.auth.getUser();
          if (userError || !authUser) {
            throw new Error(t('files.notAuthenticated') || 'User not authenticated');
          }
          user = authUser;
        }

        for (let i = 0; i < files.length; i++) {
          const { file, remark } = files[i];

          // Report progress
          onProgress?.(i + 1, files.length);

          let resolvedMime = file.type;
          if (!resolvedMime || resolvedMime === '') {
            const ext = getFileExtension(file.name);
            resolvedMime = EXTENSION_TO_MIME[ext] || '';
          }

          const fileToUpload = await autoCompressImageIfNeeded(file);

          // Construct an actual File instance using constructor
          const fileForValidation = new File([fileToUpload], fileToUpload.name, {
            type: resolvedMime,
            lastModified: fileToUpload.lastModified
          });

          if (!isFileTypeAllowed(fileForValidation)) {
            throw new Error(`${file.name}: ${t('files.invalidFileType') || 'File type not allowed'}`);
          }
          if (fileToUpload.size > MAX_FILE_SIZE) {
            throw new Error(`${file.name}: ${t('files.sizeExceeds').replace('{size}', `${MAX_FILE_SIZE / (1024 * 1024)} MB`)}`);
          }

          const fileId = crypto.randomUUID();

          if (isStandalone) {
            // Create local metadata
            const newFileMetadata: ProjectFile = {
              id: fileId,
              project_id: projectId,
              uploaded_by: 'standalone-user',
              file_name: file.name,
              file_type: resolvedMime,
              file_size: fileToUpload.size,
              storage_path: `standalone/${projectId}/${fileId}`,
              remark: remark?.trim() || null,
              transaction_id: transactionId || null,
              created_at: new Date().toISOString(),
            };

            // Store file content
            await set(`file-content-${fileId}`, fileToUpload);

            // Store metadata
            await update(`files-metadata-${projectId}`, (old: any) => {
              return [newFileMetadata, ...(old || [])];
            });

            results.push(newFileMetadata);
            successfulUploads.push({ fileId, isStandalone: true });
            continue;
          }

          const ext = getFileExtension(file.name);
          const storagePath = `projects/${projectId}/files/${fileId}${ext}`;
          const { error: uploadError } = await supabase.storage
            .from('project-files')
            .upload(storagePath, fileToUpload, {
              cacheControl: '3600',
              upsert: false,
              contentType: resolvedMime,
            });

          if (uploadError) {
            throw new Error(`${file.name}: ${t('files.uploadFailed') || 'Failed to upload file'}: ${uploadError.message}`);
          }

          const { data: fileData, error: insertError } = await supabase
            .from('project_files')
            .insert({
              id: fileId,
              project_id: projectId,
              uploaded_by: user.id,
              file_name: file.name,
              file_type: resolvedMime,
              file_size: fileToUpload.size,
              storage_path: storagePath,
              remark: remark?.trim() || null,
              transaction_id: transactionId || null,
            })
            .select()
            .single();

          if (insertError) {
            // Add to successfulUploads BEFORE cleanup so rollback includes this file
            successfulUploads.push({ fileId, storagePath, isStandalone: false });

            // Cleanup storage if metadata insert fails
            const { error: cleanupError } = await supabase.storage.from('project-files').remove([storagePath]);
            if (cleanupError) {
              throw new Error(`${file.name}: ${t('files.storageDeleteFailed') || 'Failed to cleanup file from storage'}: ${cleanupError.message}`);
            }
            throw new Error(`${file.name}: ${t('files.saveMetadataFailed') || 'Failed to save file metadata'}: ${insertError.message}`);
          }

          results.push(fileData as ProjectFile);
        }

        return results;
      } catch (error) {
        // Rollback: Delete all successfully uploaded files
        console.error('[uploadFilesBatch] Error during batch upload, rolling back successful uploads:', error);

        // Process rollbacks in parallel (standalone and server separately)
        const standaloneRollbacks = successfulUploads
          .filter(upload => upload.isStandalone)
          .map(async ({ fileId }) => {
            try {
              await del(`file-content-${fileId}`);
              await update(`files-metadata-${projectId}`, (old: any) => (old || []).filter((f: any) => f.id !== fileId));
            } catch (rollbackError) {
              console.error(`[uploadFilesBatch] Failed to rollback standalone file ${fileId}:`, rollbackError);
            }
          });

        const serverRollbacks = successfulUploads
          .filter(upload => !upload.isStandalone && upload.storagePath)
          .map(async ({ fileId, storagePath }) => {
            try {
              // Delete from storage
              const { error: storageError } = await supabase.storage.from('project-files').remove([storagePath]);
              if (storageError) {
                throw new Error(`Failed to delete file from storage: ${storageError.message}`);
              }
              // Delete metadata
              const { error: deleteError } = await supabase.from('project_files').delete().eq('id', fileId);
              if (deleteError) {
                throw new Error(`Failed to delete file metadata: ${deleteError.message}`);
              }
            } catch (rollbackError) {
              console.error(`[uploadFilesBatch] Failed to rollback server file ${fileId}:`, rollbackError);
            }
          });

        await Promise.all([...standaloneRollbacks, ...serverRollbacks]);

        // Re-throw the original error
        throw error;
      }
    },
    onSuccess: (results) => {
      const count = results.length;
      const message = count === 1
        ? t('files.uploaded') || 'File uploaded successfully'
        : t('files.uploadedMultiple').replace('{count}', String(count)) || `${count} files uploaded successfully`;
      toast.success(message);
    },
    onError: (error: Error) => {
      if (isNetworkError(error)) return;
      toast.error(error.message);
    },
    onSettled: () => {
      // Always invalidate queries to support offline/standalone mode
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['project-files', projectId] });
      }, 2000);
    },
  });

  const downloadFileMutation = useMutation({
    mutationKey: ["downloadFile"],
    mutationFn: async (file: ProjectFile) => {
      if (isStandalone) {
        const localBlob = await get(`file-content-${file.id}`);
        if (!localBlob) throw new Error(t('files.downloadFailed') || 'File not found in local storage');
        return localBlob as Blob;
      }
      const { data, error } = await supabase.storage.from('project-files').createSignedUrl(file.storage_path, SIGNED_URL_EXPIRY);
      if (error) throw new Error(`${t('files.downloadFailed') || 'Failed to generate download URL'}: ${error.message}`);
      setDownloadProgress(0);
      setDownloadedBytes(0);
      const response = await fetch(data.signedUrl);
      if (!response.ok) throw new Error(t('files.downloadError') || 'Download failed');
      const total = parseInt(response.headers.get('Content-Length') || '0', 10);
      const reader = response.body?.getReader();
      if (!reader) throw new Error(t('files.downloadError') || 'Download failed');
      const chunks: BlobPart[] = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        setDownloadedBytes(received);
        if (total > 0) setDownloadProgress(Math.round((received / total) * 100));
      }
      return new Blob(chunks);
    },
    onSuccess: () => {
      setDownloadProgress(100);
      setTimeout(() => { setDownloadProgress(0); setDownloadedBytes(0); }, 1000);
    },
    onError: (error: Error) => {
      if (isNetworkError(error)) return;
      toast.error(error.message);
      setDownloadProgress(0);
      setDownloadedBytes(0);
    },
  });

  const deleteFileMutation = useMutation({
    mutationKey: ["deleteFile", projectId],
    mutationFn: async (fileId: string) => {
      if (isStandalone) {
        // Remove content
        await del(`file-content-${fileId}`);
        // Remove metadata
        await update(`files-metadata-${projectId}`, (old: any) => (old || []).filter((f: any) => f.id !== fileId));
        return;
      }
      const { data: fileData, error: fetchError } = await supabase.from('project_files').select('storage_path').eq('id', fileId).eq('project_id', projectId).single();
      if (fetchError) throw new Error(`${t('files.fetchFailed') || 'Failed to fetch file metadata'}: ${fetchError.message}`);
      
      const { error: storageError } = await supabase.storage.from('project-files').remove([fileData.storage_path]);
      if (storageError) throw new Error(`${t('files.storageDeleteFailed') || 'Failed to delete file from storage'}: ${storageError.message}`);

      const { error: deleteError } = await supabase.from('project_files').delete().eq('id', fileId).eq('project_id', projectId);
      if (deleteError) throw new Error(`${t('files.deleteFailed') || 'Failed to delete file metadata'}: ${deleteError.message}`);
    },
    onMutate: async (id) => {
      const queryKey = ['project-files', projectId];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: any) => (old as ProjectFile[])?.filter(f => f.id !== id));
      return { previous };
    },
    onSuccess: () => {
      toast.success(t('files.deleted') || 'File deleted');
    },
    onError: (error: Error, _variables, context) => {
      // Always restore optimistic state before returning
      queryClient.setQueryData(['project-files', projectId], context?.previous);
      if (isNetworkError(error)) return;
      toast.error(error.message);
    },
    onSettled: () => {
      // Always invalidate queries to support offline/standalone mode
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['project-files', projectId] });
      }, 2000);
    },
  });

  const updateFileMutation = useMutation({
    mutationKey: ["updateFile", projectId],
    mutationFn: async (params: { fileId: string; remark: string | null }) => {
      const { fileId, remark } = params;
      if (isStandalone) {
        let updatedFile: ProjectFile | null = null;
        await update(`files-metadata-${projectId}`, (old: any) => {
          const files = (old || []) as ProjectFile[];
          const idx = files.findIndex(f => f.id === fileId);
          if (idx !== -1) {
            updatedFile = { ...files[idx], remark: remark?.trim() || null };
            const newList = [...files];
            newList[idx] = updatedFile;
            return newList;
          }
          return files;
        });
        if (!updatedFile) throw new Error(t('files.fetchFailed') || 'File not found');
        return updatedFile;
      }
      const { data, error } = await supabase.from('project_files').update({ remark: remark?.trim() || null }).eq('id', fileId).eq('project_id', projectId).select().single();
      if (error) throw error;
      return data as ProjectFile;
    },
    onMutate: async ({ fileId, remark }) => {
      const queryKey = ['project-files', projectId];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: any) => (old as ProjectFile[])?.map(f => f.id === fileId ? { ...f, remark } : f));
      return { previous };
    },
    onSuccess: () => {
      toast.success(t('files.updated') || 'File updated');
    },
    onError: (error: Error, _variables, context) => {
      // Always restore optimistic state before returning
      queryClient.setQueryData(['project-files', projectId], context?.previous);
      if (isNetworkError(error)) return;
      toast.error(error.message);
    },
    onSettled: () => {
      // Always invalidate queries to support offline/standalone mode
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['project-files', projectId] });
      }, 2000);
    },
  });

  const deleteFilesBatchMutation = useMutation({
    mutationKey: ["deleteFilesBatch", projectId],
    mutationFn: async ({ fileIds, onProgress }: { fileIds: string[]; onProgress?: (current: number, total: number) => void }) => {
      // Track successfully deleted IDs in closure for error recovery
      const successfullyDeleted: string[] = [];

      try {
        if (isStandalone) {
          // Remove content for all files
          try {
            for (let i = 0; i < fileIds.length; i++) {
              const fileId = fileIds[i];
              await del(`file-content-${fileId}`);
              successfullyDeleted.push(fileId);
              onProgress?.(i + 1, fileIds.length);
            }
            // Remove metadata only after all content deletes succeed
            await update(`files-metadata-${projectId}`, (old: any) => (old || []).filter((f: any) => !fileIds.includes(f.id)));
          } catch (error) {
            // Clean up metadata for successfully deleted files to prevent broken references
            if (successfullyDeleted.length > 0) {
              try {
                await update(`files-metadata-${projectId}`, (old: any) => (old || []).filter((f: any) => !successfullyDeleted.includes(f.id)));
              } catch (metadataCleanupError) {
                console.error('[deleteFilesBatch] Failed to clean up metadata after error:', metadataCleanupError);
              }
            }
            throw error;
          }
          return;
        }

        // Fetch all storage paths and ids first
        const { data: fileData, error: fetchError } = await supabase
          .from('project_files')
          .select('id, storage_path')
          .eq('project_id', projectId)
          .in('id', fileIds);

        if (fetchError) throw new Error(`${t('files.fetchFailed') || 'Failed to fetch file metadata'}: ${fetchError.message}`);

        // Delete from storage and metadata sequentially to report progress
        for (let i = 0; i < fileIds.length; i++) {
          const fileId = fileIds[i];
          const fileRecord = fileData?.find((f: any) => f.id === fileId);
          const storagePath = fileRecord?.storage_path;

          if (storagePath) {
            const { error: storageError } = await supabase.storage.from('project-files').remove([storagePath]);
            if (storageError) throw new Error(`${t('files.storageDeleteFailed') || 'Failed to delete file from storage'}: ${storageError.message}`);
          }

          const { error: deleteError } = await supabase
            .from('project_files')
            .delete()
            .eq('id', fileId)
            .eq('project_id', projectId);

          if (deleteError) throw new Error(`${t('files.deleteFailed') || 'Failed to delete file metadata'}: ${deleteError.message}`);

          // Track successfully deleted file
          successfullyDeleted.push(fileId);
          onProgress?.(i + 1, fileIds.length);

          // Use async delay instead of busy-wait to allow UI to repaint
          await new Promise(resolve => setTimeout(resolve, 800));
        }
      } catch (error) {
        // Attach successfully deleted IDs to error for onError handler
        (error as any).successfullyDeleted = successfullyDeleted;
        throw error;
      }
    },
    onMutate: async ({ fileIds }) => {
      const queryKey = ['project-files', projectId];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: any) => (old as ProjectFile[])?.filter(f => !fileIds.includes(f.id)));
      // Track which files are being deleted for error recovery
      return { previous, fileIds };
    },
    onSuccess: (_, variables) => {
      const count = variables.fileIds.length;
      const message = count === 1
        ? t('files.deleted') || 'File deleted'
        : t('files.deletedMultiple').replace('{count}', String(count)) || `${count} files deleted`;
      toast.success(message);
    },
    onError: (error: Error, _variables, context) => {
      // Restore only files that were NOT successfully deleted
      // to avoid reappearing items that were already removed from server
      const successfullyDeleted = (error as any).successfullyDeleted || [];
      queryClient.setQueryData(['project-files', projectId], () => {
        const previousFiles = (context?.previous as ProjectFile[]) || [];
        // Keep all previous files EXCEPT successfullyDeleted ones
        return previousFiles.filter(f => !successfullyDeleted.includes(f.id));
      });
      if (isNetworkError(error)) return;
      toast.error(error.message);
    },
    onSettled: () => {
      // Always invalidate queries to support offline/standalone mode
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['project-files', projectId] });
      }, 2000);
    },
  });

  return {
    files,
    isLoading,
    error,
    uploadFile: (params: { file: File; remark?: string; transactionId?: string }) => uploadFileMutation.mutateAsync(params),
    uploadFilesBatch: (params: { files: Array<{ file: File; remark?: string }>; transactionId?: string }, onProgress?: (current: number, total: number) => void) => uploadFilesBatchMutation.mutateAsync({ ...params, onProgress }),
    isUploading: uploadFileMutation.isPending || uploadFilesBatchMutation.isPending,
    downloadFile: downloadFileMutation.mutateAsync,
    isDownloading: downloadFileMutation.isPending,
    downloadProgress,
    downloadedBytes,
    deleteFile: deleteFileMutation.mutateAsync,
    deleteFilesBatch: (fileIds: string[], onProgress?: (current: number, total: number) => void) => deleteFilesBatchMutation.mutateAsync({ fileIds, onProgress }),
    isDeleting: deleteFileMutation.isPending || deleteFilesBatchMutation.isPending,
    updateFile: updateFileMutation.mutateAsync,
    isUpdating: updateFileMutation.isPending,
    getTransactionFiles: (transactionId: string) => files.filter(f => f.transaction_id === transactionId),
  };
};
