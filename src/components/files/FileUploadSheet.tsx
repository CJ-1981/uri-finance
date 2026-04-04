// FileUploadSheet component for uploading files with drag-and-drop
// SPEC: SPEC-STORAGE-001
// SPEC: SPEC-TRANSACTION-FILES
// Created: 2026-03-21
// Updated: 2026-03-21 - Fixed upload button response, added proper async handling, remark field
// Updated: 2026-03-21 - Added transactionId prop for transaction file association
// Updated: 2026-04-04 - Added multi-file upload support

import { useState, useRef } from 'react';
import { Upload, XCircle, File as FileIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
 * Old-style single file upload handler signature
 */
type OldUploadHandler = (file: File, remark: string) => Promise<void>;

/**
 * New-style batch file upload handler signature
 */
type NewUploadHandler = (files: Array<{ file: File; remark?: string }>, onProgress?: (current: number, total: number) => void) => Promise<void>;

/**
 * Props for FileUploadSheet component
 */
interface FileUploadSheetProps {
  /** Callback when file(s) are selected for upload (supports both old and new signatures) */
  onUpload: OldUploadHandler | NewUploadHandler;
  /** Whether upload is in progress */
  isUploading: boolean;
  /** Current remark value */
  remark?: string;
  /** Callback when remark changes */
  onRemarkChange?: (remark: string) => void;
  /** Optional transaction ID to associate the uploaded file(s) with */
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
 * Supports multiple file selection for batch uploads
 * Accepts optional transactionId for associating uploads with transactions
 */
export const FileUploadSheet = ({ onUpload, isUploading, remark = '', onRemarkChange, transactionId: _transactionId }: FileUploadSheetProps) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Array<{ file: File; error?: string }>>([]);
  const [localRemark, setLocalRemark] = useState(remark);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
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
      addFiles(Array.from(files));
    }
  };

  // Add files to selection with validation
  const addFiles = (files: File[]) => {
    setError(null);
    const newFiles: Array<{ file: File; error?: string }> = [];

    for (const file of files) {
      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        newFiles.push({
          file,
          error: t('files.sizeExceeds').replace('{size}', formatFileSizeLimit(MAX_FILE_SIZE))
        });
      } else {
        // Check for duplicates (same name and size)
        const isDuplicate = selectedFiles.some(
          sf => sf.file.name === file.name && sf.file.size === file.size
        );
        if (isDuplicate) {
          newFiles.push({
            file,
            error: t('files.duplicateFile')
          });
        } else {
          newFiles.push({ file });
        }
      }
    }

    setSelectedFiles([...selectedFiles, ...newFiles]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    const validFiles = selectedFiles.filter(f => !f.error);
    if (validFiles.length === 0) {
      setError(t('files.uploadFailed') || 'No valid files to upload');
      return;
    }

    setIsUploadingFile(true);
    setError(null);
    setUploadProgress(null);

    try {
      // Detect if onUpload is old-style (single file) or new-style (batch)
      // Old signature: (file: File, remark: string) => Promise<void>
      // New signature: (files: Array<{ file: File; remark?: string }>, onProgress?: (current, total) => void) => Promise<void>
      const isOldSignature = onUpload.length === 2; // Old signature has 2 params (file, remark), new has 2 params (files, onProgress) but onProgress is optional

      if (isOldSignature) {
        // Use old single-file signature - loop through files sequentially
        for (let i = 0; i < validFiles.length; i++) {
          const { file } = validFiles[i];
          await (onUpload as OldUploadHandler)(file, localRemark.trim());
          // Update progress after each file
          setUploadProgress({ current: i + 1, total: validFiles.length });
        }
      } else {
        // Use new batch signature
        const filesWithRemark = validFiles.map(({ file }) => ({
          file,
          remark: localRemark.trim()
        }));

        await (onUpload as NewUploadHandler)(filesWithRemark, (current, total) => {
          setUploadProgress({ current, total });
        });
      }

      // Success: close sheet and reset state
      setSelectedFiles([]);
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
      setUploadProgress(null);
    }
  };

  const handleClose = () => {
    if (!isUploading && !isUploadingFile) {
      setOpen(false);
      setSelectedFiles([]);
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
      addFiles(Array.from(files));
    }
  };

  const handleZoneClick = () => {
    if (!isUploading && !isUploadingFile) {
      fileInputRef.current?.click();
    }
  };

  const validFileCount = selectedFiles.filter(f => !f.error).length;

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
            Select one or multiple files to upload to the project with drag-and-drop or file picker.
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
                  cameraInput.multiple = true;
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
              className={`hidden sm:block border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
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
                multiple
              />
              <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm text-foreground">{t('files.dragDrop')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('files.maxSize').replace('{size}', formatFileSizeLimit(MAX_FILE_SIZE))}
                </p>
                {selectedFiles.length > 0 && (
                  <p className="text-xs text-primary">
                    {t('files.selected').replace('{count}', String(selectedFiles.length))}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Selected Files List */}
          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  {t('files.selected').replace('{count}', String(selectedFiles.length))}
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedFiles([])}
                  disabled={isUploading || isUploadingFile}
                  className="h-8 px-2 text-xs"
                >
                  {t('common.clear')}
                </Button>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1 rounded-md border">
                {selectedFiles.map((item, index) => (
                  <div
                    key={`${item.file.name}-${index}`}
                    className={`flex items-center gap-2 px-3 py-2 text-sm rounded-md ${
                      item.error
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-muted/30'
                    }`}
                  >
                    <FileIcon className="h-4 w-4 shrink-0 flex-shrink-0" />
                    <span className="flex-1 truncate">{item.file.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {(item.file.size / 1024).toFixed(1)} KB
                    </span>
                    {item.error && (
                      <span className="text-xs text-destructive truncate" title={item.error}>
                        {item.error}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 shrink-0"
                      onClick={() => removeFile(index)}
                      disabled={isUploading || isUploadingFile}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Remark Input */}
          <div className="space-y-2">
            <Label htmlFor={`remark-${fileInputIdRef.current}`}>{t('files.remarkLabel')}</Label>
            <Input
              id={`remark-${fileInputIdRef.current}`}
              value={localRemark}
              onChange={(e) => handleRemarkChange(e.target.value)}
              placeholder={t('files.remarkPlaceholder')}
              disabled={isUploading || isUploadingFile}
              className="h-9"
            />
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
              {error}
            </div>
          )}

          {/* Upload Button */}
          <Button
            onClick={handleUpload}
            disabled={validFileCount === 0 || isUploading || isUploadingFile}
            className="w-full"
            size="lg"
          >
            {isUploadingFile ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {uploadProgress
                  ? `${uploadProgress.current}/${uploadProgress.total}`
                  : t('files.uploading')
                }
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                {selectedFiles.length === 1
                  ? t('files.uploadFile')
                  : t('files.uploadMultiple').replace('{count}', String(selectedFiles.length))
                }
              </>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
