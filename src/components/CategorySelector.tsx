import { useState, useCallback, useMemo } from "react";
import { ChevronDown, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useI18n } from "@/hooks/useI18n";
import { useIsMobile } from "@/hooks/use-mobile";
import { Category } from "@/hooks/useCategories";

interface Props {
  categories: Category[];
  selectedCategoryId: string | null;
  onCategoryChange: (id: string | null) => void;
}

const CategorySelector = ({ categories, selectedCategoryId, onCategoryChange }: Props) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);
  const activeLabel = selectedCategory ? selectedCategory.name : t("tx.selectAll");

  // Build options list with "All" as first item
  const options = useMemo(() => [
    { id: null, name: t("tx.selectAll") },
    ...categories,
  ], [categories, t]);

  const indexToKey = (i: number) => (i < 9 ? String(i + 1) : "0");
  const keyToIndex = (key: string) => (key === "0" ? 9 : Number(key) - 1);

  const handleSelect = (id: string | null) => {
    onCategoryChange(id);
    setOpen(false);
  };

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (isMobile) return;

    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      const idx = keyToIndex(e.key);
      if (idx >= 0 && idx < options.length) {
        handleSelect(options[idx].id);
      }
    }
  }, [open, options, isMobile]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button onKeyDown={handleKeyDown} className="flex items-center gap-1.5 rounded-lg bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors whitespace-nowrap overflow-hidden max-w-[150px]">
          <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="truncate">{activeLabel}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-48 p-1 pointer-events-auto" onKeyDown={handleKeyDown} onOpenAutoFocus={(e) => e.preventDefault()}>
        {options.map((opt, idx) => (
          <button
            key={opt.id ?? "all"}
            onClick={() => handleSelect(opt.id)}
            className={cn(
              "w-full text-left rounded-md px-3 py-2 text-xs font-medium transition-colors flex items-center gap-2",
              (selectedCategoryId === null && opt.id === null) || selectedCategoryId === opt.id
                ? "bg-primary/10 text-primary"
                : "text-foreground hover:bg-muted"
            )}
          >
            {!isMobile && idx < 10 && (
              <span className="text-xs text-muted-foreground font-mono w-4 shrink-0">
                {indexToKey(idx)}
              </span>
            )}
            {opt.icon && opt.id !== null && <span className="shrink-0">{opt.icon}</span>}
            <span className="truncate">{opt.name}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
};

export default CategorySelector;
