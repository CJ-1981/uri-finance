// FilePreviewDialog component for previewing files before download
// SPEC: SPEC-STORAGE-001
// Created: 2026-03-21

import { File, Download, X, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import type { ProjectFile } from '@/types/files';

/**
 * Props for FilePreviewDialog component
 */
interface FilePreviewDialogProps {
  /** File to preview (null = dialog closed) */
  file: ProjectFile | null;
  /** Whether dialog is open */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
}

/**
 * Check if file type can be previewed
 * @param mimeType - MIME type of the file
 * @returns true if file can be previewed
 */
const canPreview = (mimeType: string): boolean => {
  return mimeType.startsWith('image/') || mimeType === 'application/pdf';
};

/**
 * FilePreviewDialog component
 * Modal dialog to preview files before download using signed URLs
 */
export const FilePreviewDialog = ({ file, open, onOpenChange }: FilePreviewDialogProps) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch signed URL when file or open state changes
  useEffect(() => {
    if (open && file && canPreview(file.file_type)) {
      setIsLoading(true);
      supabase.storage
        .from('project-files')
        .createSignedUrl(file.storage_path, 3600) // 60 minutes
        .then(({ data }) => {
          setPreviewUrl(data.signedUrl);
        })
        .catch(() => {
          setPreviewUrl(null);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setPreviewUrl(null);
    }
  }, [open, file]);

  const handleDownload = () => {
    // Trigger download by opening signed URL in new tab
    if (previewUrl) {
      window.open(previewUrl, '_blank');
    }
  };

  if (!file) return null;

  const isImage = file.file_type.startsWith('image/');
  const isPdf = file.file_type === 'application/pdf';
  const canPreviewFile = canPreview(file.file_type);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="truncate flex-1 mr-4" title={file.file_name}>
              {file.file_name}
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto flex items-center justify-center bg-muted/30 rounded-lg min-h-[400px]">
          {isLoading ? (
            <div className="text-center">
              <Loader2 className="h-8 w-8 text-muted-foreground mx-auto mb-4 animate-spin" />
              <p className="text-muted-foreground">Loading preview...</p>
            </div>
          ) : !canPreviewFile ? (
            <div className="text-center p-8">
              <File className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Preview not available for this file type</p>
              <p className="text-sm text-muted-foreground mt-2">Please download to view the file</p>
            </div>
          ) : isImage ? (
            <img
              src={previewUrl ?? ''}
              alt={file.file_name}
              className="max-w-full max-h-full object-contain"
            />
          ) : isPdf ? (
            <iframe
              src={previewUrl ?? ''}
              title={file.file_name}
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin"
            />
          ) : null}
        </div>

        <div className="flex-shrink-0 flex justify-end pt-4">
          <Button onClick={handleDownload} disabled={!previewUrl} className="gap-2">
            <Download className="h-4 w-4" />
            Download
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
