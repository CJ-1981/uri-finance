// useFiles hook for file management operations
// SPEC: SPEC-STORAGE-001
// SPEC: SPEC-TRANSACTION-001
// Created: 2026-03-21
// Updated: 2026-03-21 - Added file type validation, UUID paths, real-time sync, sonner
// Updated: 2026-03-21 - Added transaction file association support

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, useMemo } from 'react';
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

const isNetError = (err: any) => {
  return !navigator.onLine || 
         err?.message?.includes("Failed to fetch") || 
         err?.message?.includes("Load failed") ||
         err?.message?.includes("TypeError") ||
         err?.status === 0;
};

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
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const {
    data: files = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['project-files', projectId],
    queryFn: async () => {
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
    if (!projectId) return;
    const channel: RealtimeChannel = supabase.channel(`project-files-${projectId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'project_files', filter: `project_id=eq.${projectId}` },
        () => queryClient.invalidateQueries({ queryKey: ['project-files', projectId] })
      ).subscribe();
    return () => { channel.unsubscribe(); };
  }, [projectId, queryClient]);

  const uploadFileMutation = useMutation({
    mutationFn: async (params: { file: File; remark?: string; transactionId?: string }) => {
      const { file, remark = '', transactionId } = params;
      let resolvedMime = file.type;
      if (!resolvedMime || resolvedMime === '') {
        const ext = getFileExtension(file.name);
        resolvedMime = EXTENSION_TO_MIME[ext] || '';
      }
      const fileToUpload = await autoCompressImageIfNeeded(file);
      const fileForValidation = { ...fileToUpload, type: resolvedMime } as File;
      if (!isFileTypeAllowed(fileForValidation)) throw new Error(t('files.invalidFileType') || 'File type not allowed');
      if (fileToUpload.size > MAX_FILE_SIZE) throw new Error(t('files.sizeExceeds').replace('{size}', `${MAX_FILE_SIZE / (1024 * 1024)} MB`));
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error(t('files.notAuthenticated') || 'User not authenticated');
      const fileId = crypto.randomUUID();
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
      if (isNetError(error)) return;
      toast.error(error.message);
    },
    onSettled: () => {
      if (navigator.onLine) {
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['project-files', projectId] });
        }, 2000);
      }
    },
  });

  const downloadFileMutation = useMutation({
    mutationFn: async (file: ProjectFile): Promise<Blob> => {
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
      if (isNetError(error)) return;
      toast.error(error.message);
      setDownloadProgress(0);
      setDownloadedBytes(0);
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const { data: fileData, error: fetchError } = await supabase.from('project_files').select('storage_path').eq('id', fileId).eq('project_id', projectId).single();
      if (fetchError) throw new Error(`${t('files.fetchFailed') || 'Failed to fetch file metadata'}: ${fetchError.message}`);
      const { error: deleteError } = await supabase.from('project_files').delete().eq('id', fileId).eq('project_id', projectId);
      if (deleteError) throw deleteError;
      const { error: storageError } = await supabase.storage.from('project-files').remove([fileData.storage_path]);
      if (storageError) throw new Error(`${t('files.storageDeleteFailed') || 'Failed to delete file from storage'}: ${storageError.message}`);
    },
    onMutate: async (id) => {
      const previous = queryClient.getQueryData(['project-files', projectId]);
      queryClient.setQueryData(['project-files', projectId], (old: any) => (old as ProjectFile[])?.filter(f => f.id !== id));
      return { previous };
    },
    onSuccess: () => {
      toast.success(t('files.deleted') || 'File deleted');
    },
    onError: (error: Error, variables, context) => {
      if (isNetError(error)) return;
      queryClient.setQueryData(['project-files', projectId], context?.previous);
      toast.error(error.message);
    },
    onSettled: () => {
      if (navigator.onLine) {
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['project-files', projectId] });
        }, 2000);
      }
    },
  });

  const updateFileMutation = useMutation({
    mutationFn: async (params: { fileId: string; remark: string | null }) => {
      const { fileId, remark } = params;
      const { data, error } = await supabase.from('project_files').update({ remark: remark?.trim() || null }).eq('id', fileId).eq('project_id', projectId).select().single();
      if (error) throw error;
      return data as ProjectFile;
    },
    onMutate: async ({ fileId, remark }) => {
      const previous = queryClient.getQueryData(['project-files', projectId]);
      queryClient.setQueryData(['project-files', projectId], (old: any) => (old as ProjectFile[])?.map(f => f.id === fileId ? { ...f, remark } : f));
      return { previous };
    },
    onSuccess: () => {
      toast.success(t('files.updated') || 'File updated');
    },
    onError: (error: Error, variables, context) => {
      if (isNetError(error)) return;
      queryClient.setQueryData(['project-files', projectId], context?.previous);
      toast.error(error.message);
    },
    onSettled: () => {
      if (navigator.onLine) {
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['project-files', projectId] });
        }, 2000);
      }
    },
  });

  return {
    files,
    isLoading,
    error,
    uploadFile: (file: File, remark?: string, transactionId?: string) => uploadFileMutation.mutateAsync({ file, remark, transactionId }),
    isUploading: uploadFileMutation.isPending,
    downloadFile: downloadFileMutation.mutateAsync,
    isDownloading: downloadFileMutation.isPending,
    downloadProgress,
    downloadedBytes,
    deleteFile: deleteFileMutation.mutateAsync,
    isDeleting: deleteFileMutation.isPending,
    updateFile: updateFileMutation.mutateAsync,
    isUpdating: updateFileMutation.isPending,
    getTransactionFiles: (transactionId: string) => files.filter(f => f.transaction_id === transactionId),
  };
};
