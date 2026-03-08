import { useState, useRef, useEffect, useCallback } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface NumberedSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  items: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
  showNumbers?: boolean;
}

/** Maps index 0–9 → display key "1"–"9","0" */
const indexToKey = (i: number) => (i < 9 ? String(i + 1) : "0");
const keyToIndex = (key: string) => (key === "0" ? 9 : Number(key) - 1);

const NumberedSelect = ({
  value,
  onValueChange,
  items,
  placeholder = "Select…",
  className,
  showNumbers = false,
}: NumberedSelectProps) => {
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const selectedLabel = items.find((i) => i.value === value)?.label ?? placeholder;

  const select = useCallback(
    (val: string) => {
      onValueChange(val);
      setOpen(false);
      setTimeout(() => triggerRef.current?.focus(), 0);
    },
    [onValueChange]
  );

  // Reset highlight when opened
  useEffect(() => {
    if (open) {
      const idx = items.findIndex((i) => i.value === value);
      setHighlightIdx(idx >= 0 ? idx : 0);
    }
  }, [open, items, value]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!open || highlightIdx < 0) return;
    const list = listRef.current;
    const el = list?.children[highlightIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [highlightIdx, open]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) {
        if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
          e.preventDefault();
          setOpen(true);
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightIdx((prev) => (prev >= items.length - 1 ? 0 : prev + 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightIdx((prev) => (prev <= 0 ? items.length - 1 : prev - 1));
          break;
        case "Enter":
          e.preventDefault();
          if (highlightIdx >= 0 && highlightIdx < items.length) {
            select(items[highlightIdx].value);
          }
          break;
        case "Escape":
          e.preventDefault();
          setOpen(false);
          triggerRef.current?.focus();
          break;
        default:
          if (showNumbers && !isMobile && /^[0-9]$/.test(e.key)) {
            e.preventDefault();
            const idx = keyToIndex(e.key);
            if (idx >= 0 && idx < items.length) {
              select(items[idx].value);
            }
          }
          break;
      }
    },
    [open, highlightIdx, items, select, showNumbers, isMobile]
  );

  const displayNumbers = showNumbers && !isMobile;

  const renderItems = () =>
    items.map((item, idx) => (
      <button
        key={item.value}
        type="button"
        role="option"
        aria-selected={item.value === value}
        className={cn(
          "w-full flex items-center gap-2 rounded-sm px-3 py-2.5 text-sm cursor-pointer outline-none transition-colors",
          isMobile && "py-3 text-base",
          idx === highlightIdx && !isMobile && "bg-accent text-accent-foreground",
          item.value === value && "font-medium"
        )}
        onMouseEnter={() => !isMobile && setHighlightIdx(idx)}
        onClick={() => select(item.value)}
      >
        {displayNumbers && idx < 10 && (
          <span className="text-xs text-muted-foreground font-mono w-4 shrink-0">
            {indexToKey(idx)}
          </span>
        )}
        <span className="truncate flex-1 text-left">{item.label}</span>
        {item.value === value && (
          <Check className="h-4 w-4 shrink-0 text-primary" />
        )}
      </button>
    ));

  // Mobile: use a bottom sheet style overlay instead of Popover
  if (isMobile) {
    return (
      <>
        <Button
          ref={triggerRef}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          data-tab-stop
          onClick={() => setOpen(true)}
          className={cn("w-full h-10 justify-between font-normal", className)}
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>

        {open && (
          <div
            className="fixed inset-0 z-50 flex flex-col"
            onClick={() => setOpen(false)}
          >
            {/* Backdrop */}
            <div className="flex-1 bg-black/50" />
            {/* Bottom sheet */}
            <div
              className="bg-popover border-t border-border rounded-t-xl max-h-[60vh] flex flex-col animate-in slide-in-from-bottom-4 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-center py-2">
                <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
              </div>
              <div
                ref={listRef}
                role="listbox"
                className="overflow-y-auto flex-1 pb-safe px-1 pb-4"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                {renderItems()}
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Desktop: use Popover
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          data-tab-stop
          onKeyDown={handleKeyDown}
          className={cn("w-full h-10 justify-between font-normal", className)}
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-1"
        align="start"
        onKeyDown={handleKeyDown}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div
          ref={listRef}
          role="listbox"
          className="max-h-60 overflow-y-auto overscroll-contain"
        >
          {renderItems()}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NumberedSelect;
