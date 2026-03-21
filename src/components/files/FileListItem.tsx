// FileListItem component for displaying individual file with actions
// SPEC: SPEC-STORAGE-001
// Created: 2026-03-21

import { File, FileText, ImageIcon, Download, Trash2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import type { ProjectFile } from '@/types/files';

/**
 * Props for FileListItem component
 */
interface FileListItemProps {
  /** File metadata and content */
  file: ProjectFile;
  /** Whether current user can delete this file */
  canDelete: boolean;
  /** Callback when download button is clicked */
  onDownload: (file: ProjectFile) => void;
  /** Callback when delete button is clicked */
  onDelete: (fileId: string) => void;
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
 */
export const FileListItem = ({ file, canDelete, onDownload, onDelete, onPreview }: FileListItemProps) => {
  const showPreview = canPreview(file.file_type);

  return (
    <div className="glass-card p-4 hover:bg-card/90 transition-colors">
      <div className="flex items-start gap-3">
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
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Preview Button (for images and PDFs) */}
          {showPreview && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
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
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => onDownload(file)}
            title="Download"
          >
            <Download className="h-4 w-4" />
          </Button>

          {/* Delete Button (only if canDelete) */}
          {canDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(file.id)}
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
