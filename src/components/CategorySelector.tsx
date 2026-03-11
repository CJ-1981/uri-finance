import { useState } from "react";
import { ChevronDown, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useI18n } from "@/hooks/useI18n";
import { Category } from "@/hooks/useCategories";

interface Props {
  categories: Category[];
  selectedCategoryId: string | null;
  onCategoryChange: (id: string | null) => void;
}

const CategorySelector = ({ categories, selectedCategoryId, onCategoryChange }: Props) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);
  const activeLabel = selectedCategory ? selectedCategory.name : t("tx.selectAll");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1.5 rounded-lg bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors whitespace-nowrap overflow-hidden max-w-[150px]">
          <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="truncate">{activeLabel}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-48 p-1 pointer-events-auto">
        <button
          onClick={() => {
            onCategoryChange(null);
            setOpen(false);
          }}
          className={cn(
            "w-full text-left rounded-md px-3 py-2 text-xs font-medium transition-colors",
            selectedCategoryId === null
              ? "bg-primary/10 text-primary"
              : "text-foreground hover:bg-muted"
          )}
        >
          {t("tx.selectAll")}
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => {
              onCategoryChange(cat.id);
              setOpen(false);
            }}
            className={cn(
              "w-full text-left rounded-md px-3 py-2 text-xs font-medium transition-colors flex items-center gap-2",
              selectedCategoryId === cat.id
                ? "bg-primary/10 text-primary"
                : "text-foreground hover:bg-muted"
            )}
          >
            {cat.icon && <span className="shrink-0">{cat.icon}</span>}
            <span className="truncate">{cat.name}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
};

export default CategorySelector;
