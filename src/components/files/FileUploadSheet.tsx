// FileUploadSheet component for uploading files with drag-and-drop
// SPEC: SPEC-STORAGE-001
// SPEC: SPEC-TRANSACTION-FILES
// Created: 2026-03-21
// Updated: 2026-03-21 - Fixed upload button response, added proper async handling, remark field
// Updated: 2026-03-21 - Added transactionId prop for transaction file association

import { useState, useRef } from 'react';
import { Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useI18n } from '@/hooks/useI18n';
import { MAX_FILE_SIZE } from '@/types/files';

// Generate unique ID for file input to avoid conflicts
const generateFileInputId = () => `file-input-${Math.random().toString(36).substring(2, 9)}`;

/**
 * Props for FileUploadSheet component
 */
interface FileUploadSheetProps {
  /** Callback when file is selected for upload with remark */
  onUpload: (file: File, remark: string) => Promise<void>;
  /** Whether upload is in progress */
  isUploading: boolean;
  /** Current remark value */
  remark?: string;
  /** Callback when remark changes */
  onRemarkChange?: (remark: string) => void;
  /** Optional transaction ID to associate the uploaded file with */
  transactionId?: string;
}

/**
 * Format file size validation message
 * @param bytes - File size in bytes
 * @returns Formatted string (e.g., "5 MB")
 */
const formatFileSizeLimit = (bytes: number): string => {
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
};

/**
 * FileUploadSheet component
 * Upload dialog with drag-and-drop zone and optional remark field
 * Accepts optional transactionId for associating uploads with transactions
 */
export const FileUploadSheet = ({ onUpload, isUploading, remark = '', onRemarkChange, transactionId }: FileUploadSheetProps) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localRemark, setLocalRemark] = useState(remark);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const fileInputIdRef = useRef<string>(generateFileInputId());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync with external remark prop
  const handleRemarkChange = (newRemark: string) => {
    setLocalRemark(newRemark);
    onRemarkChange?.(newRemark);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        setError(t('files.sizeExceeds').replace('{size}', formatFileSizeLimit(MAX_FILE_SIZE)));
        return;
      }

      setError(null);
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (selectedFile && !isUploadingFile) {
      setIsUploadingFile(true);
      setError(null);

      try {
        await onUpload(selectedFile, localRemark);
        // Success: close sheet and reset state
        setSelectedFile(null);
        setLocalRemark('');
        setOpen(false);
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } catch (err) {
        // Error: keep sheet open to show error
        setError(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setIsUploadingFile(false);
      }
    }
  };

  const handleClose = () => {
    if (!isUploading && !isUploadingFile) {
      setOpen(false);
      setSelectedFile(null);
      setLocalRemark('');
      setError(null);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.size > MAX_FILE_SIZE) {
        setError(t('files.sizeExceeds').replace('{size}', formatFileSizeLimit(MAX_FILE_SIZE)));
        return;
      }
      setError(null);
      setSelectedFile(file);
    }
  };

  const handleZoneClick = () => {
    if (!isUploading && !isUploadingFile) {
      fileInputRef.current?.click();
    }
  };

  return (
    <Sheet open={open} onOpenChange={(newOpen) => {
      if (!newOpen) {
        // Blur the currently focused element before closing to prevent aria-hidden violation
        (document.activeElement as HTMLElement)?.blur();
        handleClose();
      } else {
        setOpen(newOpen);
      }
    }}>
      <SheetTrigger asChild>
        <Button size="sm" type="button" className="gap-2" data-tab-stop onClick={() => setOpen(true)} onPointerDown={(e) => e.stopPropagation()}>
          <Upload className="h-4 w-4" />
          {t('files.uploadFile')}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl bg-card border-border/50 px-6 pb-8">
        <SheetHeader>
          <SheetTitle>{t('files.uploadFile')}</SheetTitle>
          <SheetDescription className="sr-only">
            Drag and drop a file or click to select a file to upload to the project.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Drag-and-drop Zone */}
          <div className="space-y-3">
            {/* Mobile: Camera and file buttons */}
            <div className="grid grid-cols-2 gap-2 sm:hidden">
              <Button
                type="button"
                variant="outline"
                className="h-auto py-4 flex flex-col gap-2"
                onClick={() => {
                  const cameraInput = document.createElement('input');
                  cameraInput.type = 'file';
                  cameraInput.accept = 'image/*';
                  cameraInput.capture = 'environment';
                  cameraInput.onchange = (e) => {
                    const target = e.target as HTMLInputElement;
                    if (target.files && target.files.length > 0) {
                      handleFileInput({ target } as React.ChangeEvent<HTMLInputElement>);
                    }
                  };
                  cameraInput.click();
                }}
                onPointerDown={(e) => e.stopPropagation()}
                disabled={isUploading || isUploadingFile}
              >
                <Upload className="h-5 w-5" />
                <span className="text-xs">{t('files.camera')}</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-auto py-4 flex flex-col gap-2"
                onClick={() => fileInputRef.current?.click()}
                onPointerDown={(e) => e.stopPropagation()}
                disabled={isUploading || isUploadingFile}
              >
                <Upload className="h-5 w-5" />
                <span className="text-xs">{t('files.files')}</span>
              </Button>
            </div>

            {/* Desktop: Drag and drop zone */}
            <div
              className={`hidden sm:block border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragging
                  ? 'border-primary bg-primary/10'
                  : 'border-border/50 hover:border-primary/50 hover:bg-muted/30'
              } ${(isUploading || isUploadingFile) ? 'opacity-50 cursor-not-allowed' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={handleZoneClick}
            >
              <input
                ref={fileInputRef}
                id={fileInputIdRef.current}
                type="file"
                className="hidden"
                onChange={handleFileInput}
                disabled={isUploading || isUploadingFile}
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
              />
              <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm text-foreground">{t('files.dragDrop')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('files.maxSize').replace('{size}', formatFileSizeLimit(MAX_FILE_SIZE))}
                </p>
              </div>
            </div>
          </div>

          {/* Remark Input */}
          <div className="space-y-2">
            <Label htmlFor="file-remark">{t('files.remarkLabel')}</Label>
            <Input
              id="file-remark"
              placeholder={t('files.remarkPlaceholder')}
              value={localRemark}
              onChange={(e) => handleRemarkChange(e.target.value)}
              disabled={isUploading || isUploadingFile}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Selected File Info */}
          {selectedFile && (
            <div className="p-3 bg-muted/50 border border-border/50 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate" title={selectedFile.name}>
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => setSelectedFile(null)}
                  disabled={isUploading || isUploadingFile}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Upload Progress */}
          {(isUploading || isUploadingFile) && (
            <div className="space-y-2">
              <Progress value={undefined} className="h-2" />
              <p className="text-xs text-center text-muted-foreground">{t('files.uploading')}</p>
            </div>
          )}

          {/* Upload Button */}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              onPointerDown={(e) => e.stopPropagation()}
              disabled={isUploading || isUploadingFile}
            >
              {t('tx.cancel')}
            </Button>
            <Button
              type="button"
              onClick={handleUpload}
              onPointerDown={(e) => e.stopPropagation()}
              disabled={!selectedFile || isUploading || isUploadingFile}
            >
              {t('files.uploadFile')}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
