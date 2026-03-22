// FileListItem component for displaying individual file with actions
// SPEC: SPEC-STORAGE-001
// SPEC: SPEC-TRANSACTION-FILES
// Created: 2026-03-21
// Updated: 2026-03-21 - Added multi-select checkbox support, uploader email display
// Updated: 2026-03-21 - Added transaction link button for files associated with transactions

import { File, FileText, ImageIcon, Download, Trash2, Eye, CheckSquare, Square, Receipt, Link as LinkIcon, Edit2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatDistanceToNow } from 'date-fns';
import { useState } from 'react';
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
  /** Callback when transaction link button is clicked */
  onTransactionClick?: (transactionId: string) => void;
  /** Callback when description (remark) is updated */
  onUpdate?: (remark: string | null) => Promise<void>;
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
 * Shows transaction link button when file is associated with a transaction
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
  onTransactionClick,
  onUpdate,
}: FileListItemProps) => {
  const { t } = useI18n();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(file.remark || '');
  const showPreview = canPreview(file.file_type);

  const handleSave = async () => {
    if (onUpdate) {
      await onUpdate(editValue);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(file.remark || '');
    setIsEditing(false);
  };

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
          
          {/* Editable Remark/Description */}
          {isEditing ? (
            <div className="flex items-center gap-1 mt-1.5" onClick={(e) => e.stopPropagation()}>
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                  if (e.key === 'Escape') handleCancel();
                }}
                placeholder={t('files.addDescription') || 'Add description...'}
                className="h-7 text-xs py-1 px-2 focus-visible:ring-1"
                autoFocus
              />
              <div className="flex items-center">
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-7 w-7 text-primary hover:bg-primary/10" 
                  onClick={handleSave}
                  title={t('admin.save') || 'Save'}
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-7 w-7 text-muted-foreground hover:bg-muted" 
                  onClick={handleCancel}
                  title={t('tx.cancel') || 'Cancel'}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ) : (
            <div 
              className="group flex items-start gap-1 mt-1 cursor-pointer hover:bg-primary/5 rounded px-1 -ml-1 py-0.5 transition-colors"
              onClick={() => setIsEditing(true)}
              title={file.remark ? file.remark : (t('files.addDescription') || 'Add description')}
            >
              <p className={`text-xs ${file.remark ? 'text-muted-foreground' : 'text-muted-foreground/40 italic'} line-clamp-2 flex-1`}>
                {file.remark || t('files.addDescription') || 'Add description...'}
              </p>
              <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground mt-0.5 shrink-0" />
            </div>
          )}
        </div>

        {/* Action Buttons (hidden in selection mode) */}
        {!isSelectionMode && (
          <div className="flex items-center gap-1 shrink-0">
            {/* Transaction Link Button (when file has transaction_id) */}
            {file.transaction_id && onTransactionClick && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-primary hover:text-primary hover:bg-primary/10"
                onClick={() => onTransactionClick(file.transaction_id!)}
                title={t('files.linkToTransaction') || 'View Transaction'}
              >
                <Receipt className="h-4 w-4" />
                <LinkIcon className="h-3 w-3 absolute -bottom-0.5 -right-0.5" />
              </Button>
            )}

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
