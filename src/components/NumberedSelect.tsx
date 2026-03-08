import { useState, useRef, useEffect, useCallback } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

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

  const selectedLabel = items.find((i) => i.value === value)?.label ?? placeholder;

  const select = useCallback(
    (val: string) => {
      onValueChange(val);
      setOpen(false);
      // Return focus to trigger after selection
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
        // Open on Enter/Space/ArrowDown
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
          // Number key shortcut (1-9, 0)
          if (showNumbers && /^[0-9]$/.test(e.key)) {
            e.preventDefault();
            const idx = keyToIndex(e.key);
            if (idx >= 0 && idx < items.length) {
              select(items[idx].value);
            }
          }
          break;
      }
    },
    [open, highlightIdx, items, select, showNumbers]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          onKeyDown={handleKeyDown}
          className={cn(
            "w-full h-10 justify-between font-normal",
            className
          )}
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-1 max-h-60 overflow-y-auto"
        align="start"
        onKeyDown={handleKeyDown}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div ref={listRef} role="listbox">
          {items.map((item, idx) => (
            <button
              key={item.value}
              type="button"
              role="option"
              aria-selected={item.value === value}
              className={cn(
                "w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer outline-none transition-colors",
                idx === highlightIdx && "bg-accent text-accent-foreground",
                item.value === value && idx !== highlightIdx && "font-medium"
              )}
              onMouseEnter={() => setHighlightIdx(idx)}
              onClick={() => select(item.value)}
            >
              {showNumbers && idx < 10 && (
                <span className="text-xs text-muted-foreground font-mono w-4 shrink-0">
                  {indexToKey(idx)}
                </span>
              )}
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NumberedSelect;
