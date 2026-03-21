// FileManager component for main file management UI
// SPEC: SPEC-STORAGE-001
// Created: 2026-03-21

import { useState } from 'react';
import { FileUp } from 'lucide-react';
import { useFiles } from '@/hooks/useFiles';
import { useI18n } from '@/hooks/useI18n';
import { FileListItem } from './FileListItem';
import { FileUploadSheet } from './FileUploadSheet';
import { FilePreviewDialog } from './FilePreviewDialog';
import type { ProjectFile } from '@/types/files';

/**
 * FileManager component
 * Main container orchestrating file management
 *
 * Features:
 * - File list with FileListItem components
 * - Upload button opening FileUploadSheet
 * - Empty state message when no files
 * - Preview dialog for images/PDFs
 * - Integration with useFiles hook
 */
export const FileManager = ({ projectId, canDelete }: { projectId: string; canDelete: boolean }) => {
  const { t } = useI18n();
  const { files, isLoading, uploadFile, isUploading, downloadFile, deleteFile } = useFiles(projectId);
  const [previewFile, setPreviewFile] = useState<ProjectFile | null>(null);

  const handlePreview = (file: ProjectFile) => {
    setPreviewFile(file);
  };

  const handleDownload = async (file: ProjectFile) => {
    try {
      const blob = await downloadFile(file);
      // Create object URL from Blob and trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Clean up object URL after a short delay
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (error) {
      // Error toast is already shown by useFiles hook
      console.error('Download failed:', error);
    }
  };

  const handleDelete = async (fileId: string) => {
    try {
      await deleteFile(fileId);
      // Success toast is already shown by useFiles hook
    } catch (error) {
      // Error toast is already shown by useFiles hook
      console.error('Delete failed:', error);
    }
  };

  const handleUpload = async (file: File) => {
    try {
      await uploadFile({ file });
      // Success toast is already shown by useFiles hook
    } catch (error) {
      // Error toast is already shown by useFiles hook
      console.error('Upload failed:', error);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t('files.title')}</h2>
        <FileUploadSheet onUpload={handleUpload} isUploading={isUploading} />
      </div>

      {/* File List */}
      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">{t('files.loading')}</p>
        </div>
      ) : files.length === 0 ? (
        <div className="text-center py-12">
          <FileUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">{t('files.noFiles')}</p>
          <p className="text-sm text-muted-foreground mt-2">
            {t('files.uploadFileHint')}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {files.map((file) => (
            <FileListItem
              key={file.id}
              file={file}
              canDelete={canDelete}
              onDownload={handleDownload}
              onDelete={handleDelete}
              onPreview={handlePreview}
            />
          ))}
        </div>
      )}

      {/* Preview Dialog */}
      <FilePreviewDialog
        file={previewFile}
        open={!!previewFile}
        onOpenChange={(open) => !open && setPreviewFile(null)}
      />
    </div>
  );
};
