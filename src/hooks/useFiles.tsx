// useFiles hook for file management operations
// SPEC: SPEC-STORAGE-001
// Created: 2026-03-21

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ProjectFile, MAX_FILE_SIZE, SIGNED_URL_EXPIRY } from '@/types/files';
import { useToast } from '@/hooks/use-toast';

// @MX:ANCHOR: Core file management hook with CRUD operations for project files
// @MX:REASON: High fan-in function used by FileManager and all file-related components
// @MX:SPEC: SPEC-STORAGE-001
export const useFiles = (projectId: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query: List files sorted by newest first
  const {
    data: files = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['project-files', projectId],
    queryFn: async () => {
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

  // Mutation: Upload file
  const uploadFileMutation = useMutation({
    mutationFn: async (params: { file: File }) => {
      const { file } = params;

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(`File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)} MB limit`);
      }

      // Get current user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      // Generate unique storage path
      const timestamp = Date.now();
      const storagePath = `projects/${projectId}/${user.id}-${timestamp}-${file.name}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('project-files')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) {
        throw new Error(`Failed to upload file: ${uploadError.message}`);
      }

      // Insert metadata into project_files table
      const { data: fileData, error: insertError } = await supabase
        .from('project_files')
        .insert({
          project_id: projectId,
          uploaded_by: user.id,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          storage_path: storagePath,
        })
        .select()
        .single();

      if (insertError) {
        // Cleanup: delete uploaded file if metadata insert fails
        await supabase.storage.from('project-files').remove([storagePath]);
        throw new Error(`Failed to save file metadata: ${insertError.message}`);
      }

      return fileData as ProjectFile;
    },
    onSuccess: () => {
      toast({
        title: 'File uploaded successfully',
        description: 'Your file has been uploaded and is ready to use.',
      });
      // Invalidate queries to refresh file list
      queryClient.invalidateQueries({ queryKey: ['project-files'] });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: error.message,
      });
    },
  });

  // Mutation: Download file (generate signed URL)
  const downloadFileMutation = useMutation({
    mutationFn: async (file: ProjectFile): Promise<string> => {
      const { data, error } = await supabase.storage
        .from('project-files')
        .createSignedUrl(file.storage_path, SIGNED_URL_EXPIRY);

      if (error) {
        throw new Error(`Failed to generate download URL: ${error.message}`);
      }

      return data.signedUrl;
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Download failed',
        description: error.message,
      });
    },
  });

  // Mutation: Delete file
  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: string) => {
      // Get file metadata first
      const { data: fileData, error: fetchError } = await supabase
        .from('project_files')
        .select('storage_path')
        .eq('id', fileId)
        .single();

      if (fetchError) {
        throw new Error(`Failed to fetch file metadata: ${fetchError.message}`);
      }

      // Delete metadata from database FIRST (safer - can rollback storage delete)
      const { error: deleteError } = await supabase
        .from('project_files')
        .delete()
        .eq('id', fileId);

      if (deleteError) {
        throw new Error(`Failed to delete file metadata: ${deleteError.message}`);
      }

      // Delete from Supabase Storage (after DB delete succeeds)
      const { error: storageError } = await supabase.storage
        .from('project-files')
        .remove([fileData.storage_path]);

      if (storageError) {
        throw new Error(`Failed to delete file from storage: ${storageError.message}`);
      }
    },
    onSuccess: () => {
      toast({
        title: 'File deleted',
        description: 'The file has been permanently deleted.',
      });
      // Invalidate queries to refresh file list
      queryClient.invalidateQueries({ queryKey: ['project-files'] });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Delete failed',
        description: error.message,
      });
    },
  });

  return {
    files,
    isLoading,
    error,
    uploadFile: uploadFileMutation.mutateAsync,
    isUploading: uploadFileMutation.isPending,
    downloadFile: downloadFileMutation.mutateAsync,
    deleteFile: deleteFileMutation.mutateAsync,
    isDeleting: deleteFileMutation.isPending,
  };
};
