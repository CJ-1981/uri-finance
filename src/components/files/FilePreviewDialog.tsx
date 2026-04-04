// FilePreviewDialog component for previewing files before download
// SPEC: SPEC-STORAGE-001
// Created: 2026-03-21
// Updated: 2026-03-22 - Added drag-to-close functionality for mobile

import { File, Download, Loader2 } from 'lucide-react';
import { useState, useEffect, useRef, TouchEvent } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { get } from 'idb-keyval';

/**
 * Info required for previewing a file
 */
export interface FilePreviewInfo {
  id?: string;
  file_name: string;
  file_type: string;
  storage_path?: string | null;
  localFile?: File | null;
}

/**
 * Props for FilePreviewDialog component
 */
interface FilePreviewDialogProps {
  /** File to preview (null = dialog closed) */
  file: FilePreviewInfo | null;
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
  return mimeType.startsWith('image/');
};

/**
 * FilePreviewDialog component
 * Modal dialog to preview files before download using signed URLs
 */
export const FilePreviewDialog = ({ file, open, onOpenChange }: FilePreviewDialogProps) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const isMobile = useIsMobile();

  // Drag-to-close state for mobile
  const [dragStartY, setDragStartY] = useState(0);
  const [currentDragY, setCurrentDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Threshold for closing dialog (in pixels)
  const CLOSE_THRESHOLD = 100;

  // Fetch signed URL or create local URL when file or open state changes
  useEffect(() => {
    let objectUrl: string | null = null;

    if (open && file && canPreview(file.file_type)) {
      if (file.localFile) {
        // Local file preview via Object URL
        objectUrl = URL.createObjectURL(file.localFile);
        setPreviewUrl(objectUrl);
        setIsLoading(false);
      } else if (file.storage_path) {
        setIsLoading(true);
        if (file.storage_path.startsWith('standalone/') && file.id) {
          // Handle standalone mode
          get(`file-content-${file.id}`)
            .then((blob) => {
              if (blob) {
                objectUrl = URL.createObjectURL(blob as Blob);
                setPreviewUrl(objectUrl);
              } else {
                console.error('[FilePreviewDialog] Local file not found:', file.id);
                setPreviewUrl(null);
              }
            })
            .catch((err) => {
              console.error('[FilePreviewDialog] IDB error:', err);
              setPreviewUrl(null);
            })
            .finally(() => {
              setIsLoading(false);
            });
        } else {
          // Remote file preview via Signed URL
          supabase.storage
            .from('project-files')
            .createSignedUrl(file.storage_path, 3600)
            .then(({ data, error }) => {
              if (error) {
                console.error('[FilePreviewDialog] Signed URL error:', error);
                setPreviewUrl(null);
              } else {
                setPreviewUrl(data.signedUrl);
              }
            })
            .catch((err) => {
              console.error('[FilePreviewDialog] Exception:', err);
              setPreviewUrl(null);
            })
            .finally(() => {
              setIsLoading(false);
            });
        }
      }
    } else {
      setPreviewUrl(null);
    }

    // Cleanup: revoke object URL if created
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [open, file]);

  const handleDownload = () => {
    // Trigger download by opening signed URL in new tab
    if (previewUrl) {
      window.open(previewUrl, '_blank');
    }
  };

  // Touch handlers for drag-to-close on mobile
  const handleTouchStart = (e: TouchEvent) => {
    if (!isMobile) return;
    const touch = e.touches[0];
    setDragStartY(touch.clientY);
    setCurrentDragY(touch.clientY);
    setIsDragging(true);
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isMobile || !isDragging) return;
    const touch = e.touches[0];
    const deltaY = touch.clientY - dragStartY;
    // Only allow dragging down
    if (deltaY > 0) {
      setCurrentDragY(touch.clientY);
    }
  };

  const handleTouchEnd = () => {
    if (!isMobile || !isDragging) return;
    const dragDistance = currentDragY - dragStartY;

    if (dragDistance > CLOSE_THRESHOLD) {
      // Close dialog if dragged down beyond threshold
      onOpenChange(false);
    }

    // Reset drag state
    setDragStartY(0);
    setCurrentDragY(0);
    setIsDragging(false);
  };

  // Calculate opacity and wrapper transform based on drag distance
  const dragDistance = currentDragY - dragStartY;
  const dragProgress = Math.min(dragDistance / CLOSE_THRESHOLD, 1);
  const opacity = isDragging ? 1 - dragProgress * 0.5 : 1;
  const translateY = isDragging ? Math.min(dragDistance, CLOSE_THRESHOLD) : 0;

  // Wrapper style for drag animation (applied to inner content wrapper)
  const dragWrapperStyle = isDragging ? {
    transform: `translateY(${translateY}px)`,
    transition: 'none',
  } : {
    transition: 'transform 0.2s ease-out',
  };

  if (!file) return null;

  const isImage = file.file_type.startsWith('image/');
  const isPdf = file.file_type === 'application/pdf';
  const canPreviewFile = canPreview(file.file_type);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[95vw] md:max-w-5xl max-h-[95vh] p-4 sm:p-6 overflow-hidden flex flex-col"
        style={{
          opacity: opacity || 1,
          transition: isDragging ? 'none' : 'opacity 0.2s',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Wrapper div for drag animation - doesn't interfere with DialogContent positioning */}
        <div ref={contentRef} style={dragWrapperStyle} className="flex flex-col flex-1 min-h-0 gap-4">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="truncate pr-8" title={file.file_name}>
              {file.file_name}
            </DialogTitle>
            <DialogDescription className="sr-only">
              File preview window for {file.file_name} showing file content or download options.
            </DialogDescription>
            {/* Visual indicator for drag-to-close on mobile */}
            {isMobile && (
              <div className="flex justify-center pb-2">
                <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full" />
              </div>
            )}
          </DialogHeader>

          <div className="flex-1 min-h-0 flex items-center justify-center bg-muted/30 rounded-lg overflow-hidden">
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

          <div className="flex justify-end flex-shrink-0">
            <Button onClick={handleDownload} disabled={!previewUrl} className="gap-2">
              <Download className="h-4 w-4" />
              Download
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
