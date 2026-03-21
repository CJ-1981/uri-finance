// FileListItem component for displaying individual file with actions
// SPEC: SPEC-STORAGE-001
// Created: 2026-03-21
// Updated: 2026-03-21 - Added multi-select checkbox support, uploader email display

import { File, FileText, ImageIcon, Download, Trash2, Eye, CheckSquare, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import type { ProjectFile } from '@/types/files';
import { useI18n } from '@/hooks/useI18n';

/**
 * Props for FileListItem component
 */
interface FileListItemProps {
  /** File metadata and content */
  file: ProjectFile & { uploader_email?: string };
  /** Whether current user can delete this file */
  canDelete: boolean;
  /** Whether selection mode is active */
  isSelectionMode?: boolean;
  /** Whether this file is selected */
  isSelected?: boolean;
  /** Callback when checkbox is toggled */
  onToggleSelect?: () => void;
  /** Callback when download button is clicked */
  onDownload: () => void;
  /** Callback when delete button is clicked */
  onDelete: () => void;
  /** Callback when preview button is clicked */
  onPreview: (file: ProjectFile) => void;
}

/**
 * Format file size in human-readable format
 * @param bytes - File size in bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * Check if file type can be previewed
 * @param mimeType - MIME type of the file
 * @returns true if file can be previewed
 */
const canPreview = (mimeType: string): boolean => {
  return mimeType.startsWith('image/') || mimeType === 'application/pdf';
};

/**
 * Get appropriate file icon based on MIME type
 * @param mimeType - MIME type of the file
 * @returns Icon component
 */
const getFileIcon = (mimeType: string) => {
  if (mimeType === 'application/pdf') {
    return <FileText className="h-5 w-5 text-destructive" />;
  }
  if (mimeType.startsWith('image/')) {
    return <ImageIcon className="h-5 w-5 text-primary" />;
  }
  return <File className="h-5 w-5 text-muted-foreground" />;
};

/**
 * FileListItem component
 * Displays individual file with metadata and action buttons
 * Supports multi-select mode with checkbox
 */
export const FileListItem = ({
  file,
  canDelete,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelect,
  onDownload,
  onDelete,
  onPreview,
}: FileListItemProps) => {
  const { t } = useI18n();
  const showPreview = canPreview(file.file_type);

  return (
    <div className={`glass-card p-4 transition-colors ${isSelected ? 'bg-primary/10 border-primary/30' : 'hover:bg-card/90'}`}>
      <div className="flex items-start gap-3">
        {/* Selection Checkbox */}
        {isSelectionMode && (
          <button
            onClick={onToggleSelect}
            className="shrink-0 mt-0.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            {isSelected ? (
              <CheckSquare className="h-5 w-5 text-primary" />
            ) : (
              <Square className="h-5 w-5" />
            )}
          </button>
        )}

        {/* File Icon */}
        <div className="shrink-0 mt-0.5">{getFileIcon(file.file_type)}</div>

        {/* File Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate" title={file.file_name}>
            {file.file_name}
          </p>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <span>{formatFileSize(file.file_size)}</span>
            <span>•</span>
            <span>{formatDistanceToNow(new Date(file.created_at), { addSuffix: true })}</span>
          </div>
          {file.uploader_email && (
            <p className="text-xs text-muted-foreground mt-0.5" title={file.uploader_email}>
              {t('files.uploadedBy').replace('{email}', file.uploader_email)}
            </p>
          )}
          {file.remark && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2" title={file.remark}>
              {file.remark}
            </p>
          )}
        </div>

        {/* Action Buttons (hidden in selection mode) */}
        {!isSelectionMode && (
          <div className="flex items-center gap-1 shrink-0">
            {/* Preview Button (for images and PDFs) */}
            {showPreview && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-foreground"
                onClick={() => onPreview(file)}
                title="Preview"
              >
                <Eye className="h-4 w-4" />
              </Button>
            )}

            {/* Download Button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-foreground"
              onClick={onDownload}
              title="Download"
            >
              <Download className="h-4 w-4" />
            </Button>

            {/* Delete Button (only if canDelete) */}
            {canDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-destructive"
                onClick={onDelete}
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
