// FileManager component for main file management UI
// SPEC: SPEC-STORAGE-001
// Created: 2026-03-21
// Updated: 2026-03-21 - Added multi-select, confirmation dialogs, batch actions

import { useState } from 'react';
import { FileUp, CheckSquare, Square, Download, Trash2, X } from 'lucide-react';
import { useFiles } from '@/hooks/useFiles';
import { useI18n } from '@/hooks/useI18n';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { FileListItem } from './FileListItem';
import { FileUploadSheet } from './FileUploadSheet';
import { FilePreviewDialog } from './FilePreviewDialog';
import type { ProjectFile } from '@/types/files';

/**
 * FileManager component
 * Main container orchestrating file management with multi-select support
 */
export const FileManager = ({ projectId, canDelete }: { projectId: string; canDelete: boolean }) => {
  const { t } = useI18n();
  const { files, isLoading, uploadFile, isUploading, downloadFile, deleteFile, isDeleting } = useFiles(projectId);
  const [previewFile, setPreviewFile] = useState<ProjectFile | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const [batchDeleteConfirmOpen, setBatchDeleteConfirmOpen] = useState(false);
  const [uploadRemark, setUploadRemark] = useState('');

  // Toggle selection mode
  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedIds(new Set());
  };

  // Toggle file selection
  const toggleSelection = (fileId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(fileId)) {
      newSelected.delete(fileId);
    } else {
      newSelected.add(fileId);
    }
    setSelectedIds(newSelected);
  };

  // Select all files
  const selectAll = () => {
    if (selectedIds.size === files.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(files.map(f => f.id)));
    }
  };

  // Handle single file delete with confirmation
  const handleDeleteClick = (fileId: string) => {
    setFileToDelete(fileId);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (fileToDelete) {
      try {
        await deleteFile(fileToDelete);
      } catch (error) {
        console.error('Delete failed:', error);
      }
    }
    setDeleteConfirmOpen(false);
    setFileToDelete(null);
  };

  // Handle batch delete
  const handleBatchDeleteClick = () => {
    if (selectedIds.size > 0) {
      setBatchDeleteConfirmOpen(true);
    }
  };

  const handleBatchDeleteConfirm = async () => {
    for (const fileId of selectedIds) {
      try {
        await deleteFile(fileId);
      } catch (error) {
        console.error('Delete failed for file:', fileId, error);
      }
    }
    setSelectedIds(new Set());
    setIsSelectionMode(false);
    setBatchDeleteConfirmOpen(false);
  };

  // Handle batch download
  const handleBatchDownload = async () => {
    const selectedFiles = files.filter(f => selectedIds.has(f.id));
    for (const file of selectedFiles) {
      try {
        const blob = await downloadFile(file);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.file_name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 100);
      } catch (error) {
        console.error('Download failed:', error);
      }
    }
  };

  const handlePreview = (file: ProjectFile) => {
    setPreviewFile(file);
  };

  const handleUpload = async (file: File, remark: string) => {
    try {
      await uploadFile({ file, remark });
    } catch (error) {
      console.error('Upload failed:', error);
      throw error;
    }
  };

  // Selected files count
  const selectedCount = selectedIds.size;
  const allSelected = selectedCount > 0 && selectedCount === files.length;

  return (
    <div className="space-y-4">
      {/* Header with Multi-Select Actions */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold">{t('files.title')}</h2>
          {files.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSelectionMode}
              className="gap-2"
            >
              {isSelectionMode ? (
                <>
                  <X className="h-4 w-4" />
                  Cancel
                </>
              ) : (
                <>
                  <CheckSquare className="h-4 w-4" />
                  Select
                </>
              )}
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isSelectionMode && selectedCount > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={selectAll}
                className="gap-2"
              >
                {allSelected ? (
                  <>
                    <Square className="h-4 w-4" />
                    Deselect All
                  </>
                ) : (
                  <>
                    <CheckSquare className="h-4 w-4" />
                    Select All ({selectedCount}/{files.length})
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBatchDownload}
                className="gap-2"
                disabled={selectedCount === 0}
              >
                <Download className="h-4 w-4" />
                Download ({selectedCount})
              </Button>
              {canDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBatchDeleteClick}
                  className="gap-2 text-destructive hover:text-destructive"
                  disabled={selectedCount === 0 || isDeleting}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete ({selectedCount})
                </Button>
              )}
            </>
          )}
          <FileUploadSheet onUpload={handleUpload} isUploading={isUploading} remark={uploadRemark} onRemarkChange={setUploadRemark} />
        </div>
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
              isSelectionMode={isSelectionMode}
              isSelected={selectedIds.has(file.id)}
              onToggleSelect={() => toggleSelection(file.id)}
              onDownload={async () => {
                // Download is handled in the preview dialog
                handlePreview(file);
              }}
              onDelete={() => handleDeleteClick(file.id)}
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

      {/* Single Delete Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('files.deleteConfirm')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('files.deleteDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('tx.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('files.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Batch Delete Confirmation */}
      <AlertDialog open={batchDeleteConfirmOpen} onOpenChange={setBatchDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedCount} Files?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All {selectedCount} selected files will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('tx.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBatchDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : `Delete ${selectedCount} Files`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
