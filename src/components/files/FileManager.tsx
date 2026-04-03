// FileManager component for main file management UI
// SPEC: SPEC-STORAGE-001
// SPEC: SPEC-TRANSACTION-FILES
// Created: 2026-03-21
// Updated: 2026-03-21 - Added multi-select, confirmation dialogs, batch actions
// Updated: 2026-03-21 - Added transaction link support
// Updated: 2026-03-22 - Added text search functionality

import { useState, useMemo } from 'react';
import { FileUp, CheckSquare, Square, Download, Trash2, X, Search } from 'lucide-react';
import { useFiles } from '@/hooks/useFiles';
import { useI18n } from '@/hooks/useI18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
 * Includes transaction link support for files associated with transactions
 */
export const FileManager = ({
  projectId,
  canDelete,
  onTransactionClick
}: {
  projectId: string;
  canDelete: boolean;
  onTransactionClick?: (transactionId: string) => void;
}) => {
  const { t } = useI18n();
  const { files, isLoading, uploadFile, isUploading, downloadFile, deleteFile, isDeleting, updateFile } = useFiles(projectId);
  const [previewFile, setPreviewFile] = useState<ProjectFile | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const [batchDeleteConfirmOpen, setBatchDeleteConfirmOpen] = useState(false);
  const [uploadRemark, setUploadRemark] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter files based on search query
  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return files;
    const q = searchQuery.toLowerCase();
    return files.filter((file) => {
      // Search in file name
      if (file.file_name.toLowerCase().includes(q)) return true;
      // Search in remark
      if (file.remark?.toLowerCase().includes(q)) return true;
      // Search in uploader email
      if ((file as any).uploader_email?.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [files, searchQuery]);

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
    const selectableFiles = filteredFiles;
    if (selectedIds.size === selectableFiles.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableFiles.map(f => f.id)));
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
  const allSelected = selectedCount > 0 && selectedCount === filteredFiles.length;

  return (
    <div className="space-y-4">
      {/* Header with Multi-Select Actions */}
      <div className="space-y-3">
        {/* Title Row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h2 className="text-2xl font-bold shrink-0">{t('files.title')}</h2>
            {filteredFiles.length > 0 && !isSelectionMode && (
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSelectionMode}
                className="gap-2 shrink-0"
              >
                <CheckSquare className="h-4 w-4" />
                <span className="hidden sm:inline">Select</span>
              </Button>
            )}
          </div>
          {!isSelectionMode && (
            <FileUploadSheet onUpload={handleUpload} isUploading={isUploading} remark={uploadRemark} onRemarkChange={setUploadRemark} />
          )}
        </div>

        {/* Multi-Select Toolbar */}
        {isSelectionMode && (
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-foreground px-2">
                {selectedCount} {selectedCount === 1 ? 'file' : 'files'} selected
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={selectAll}
                className="gap-1.5 h-8 px-2 text-xs"
              >
                {allSelected ? (
                  <>
                    <Square className="h-3.5 w-3.5" />
                    <span className="hidden xs:inline">Deselect</span>
                  </>
                ) : (
                  <>
                    <CheckSquare className="h-3.5 w-3.5" />
                    <span className="hidden xs:inline">All ({selectedCount})</span>
                  </>
                )}
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBatchDownload}
                className="gap-1.5 h-8 px-2 text-xs"
                disabled={selectedCount === 0}
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden xs:inline">Download</span>
                {selectedCount > 0 && <span className="xs:hidden">({selectedCount})</span>}
              </Button>
              {canDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBatchDeleteClick}
                  className="gap-1.5 h-8 px-2 text-xs text-destructive hover:text-destructive"
                  disabled={selectedCount === 0 || isDeleting}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="hidden xs:inline">Delete</span>
                  {selectedCount > 0 && <span className="xs:hidden">({selectedCount})</span>}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSelectionMode}
                className="gap-1.5 h-8 px-2 text-xs text-muted-foreground"
              >
                <X className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Cancel</span>
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Search Bar */}
      {files.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('files.search') || 'Search files by name, remark, or uploader email...'}
            className="pl-9 h-9"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground transition-colors"
              title={t('common.clear') || 'Clear'}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      {/* File List */}
      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">{t('files.loading')}</p>
        </div>
      ) : filteredFiles.length === 0 ? (
        <div className="text-center py-12">
          <FileUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">{searchQuery ? 'No files match your search' : t('files.noFiles')}</p>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-sm text-primary hover:underline mt-2"
            >
              Clear search
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
          {filteredFiles.map((file) => (
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
              onUpdate={async (remark) => { await updateFile({ fileId: file.id, remark }); }}
              onTransactionClick={onTransactionClick}
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
