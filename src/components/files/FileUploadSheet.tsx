// FileUploadSheet component for uploading files with drag-and-drop
// SPEC: SPEC-STORAGE-001
// Created: 2026-03-21

import { useState, useCallback } from 'react';
import { Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { MAX_FILE_SIZE } from '@/types/files';

/**
 * Props for FileUploadSheet component
 */
interface FileUploadSheetProps {
  /** Callback when file is selected for upload */
  onUpload: (file: File) => void;
  /** Whether upload is in progress */
  isUploading: boolean;
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
 * Upload dialog with drag-and-drop zone
 */
export const FileUploadSheet = ({ onUpload, isUploading }: FileUploadSheetProps) => {
  const [open, setOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 5,
      },
    })
  );

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
    setError(null);
  }, []);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        setError(`File size exceeds ${formatFileSizeLimit(MAX_FILE_SIZE)} limit`);
        return;
      }

      setError(null);
      setSelectedFile(file);
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      onUpload(selectedFile);
      setSelectedFile(null);
      setError(null);
    }
  };

  const handleClose = () => {
    if (!isUploading) {
      setOpen(false);
      setSelectedFile(null);
      setError(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetTrigger asChild>
        <Button size="sm" className="gap-2">
          <Upload className="h-4 w-4" />
          Upload File
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl bg-card border-border/50 px-6 pb-8">
        <SheetHeader>
          <SheetTitle>Upload File</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Drag-and-drop Zone */}
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragging
                  ? 'border-primary bg-primary/10'
                  : 'border-border/50 hover:border-primary/50 hover:bg-muted/30'
              } ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                  const file = files[0];
                  if (file.size > MAX_FILE_SIZE) {
                    setError(`File size exceeds ${formatFileSizeLimit(MAX_FILE_SIZE)} limit`);
                    return;
                  }
                  setError(null);
                  setSelectedFile(file);
                }
              }}
              onClick={() => {
                if (!isUploading) {
                  document.getElementById('file-input')?.click();
                }
              }}
            >
              <input
                id="file-input"
                type="file"
                className="hidden"
                onChange={handleFileInput}
                disabled={isUploading}
              />
              <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm text-foreground">Drag and drop file here, or click to select</p>
                <p className="text-xs text-muted-foreground">
                  Maximum file size: {formatFileSizeLimit(MAX_FILE_SIZE)}
                </p>
              </div>
            </div>
          </DndContext>

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
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => setSelectedFile(null)}
                  disabled={isUploading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Upload Progress */}
          {isUploading && (
            <div className="space-y-2">
              <Progress value={undefined} className="h-2" />
              <p className="text-xs text-center text-muted-foreground">Uploading...</p>
            </div>
          )}

          {/* Upload Button */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || isUploading}
            >
              Upload
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
