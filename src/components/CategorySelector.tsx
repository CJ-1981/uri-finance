import { useState, useCallback, useMemo, useImperativeHandle, forwardRef, useRef } from "react";
import { ChevronDown, ChevronRight, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useI18n } from "@/hooks/useI18n";
import { useIsMobile } from "@/hooks/use-mobile";
import { Category, CategoryTreeNode } from "@/hooks/useCategories";

export interface CategorySelectorHandle {
  open: () => void;
}

interface Props {
  categories: Category[];
  selectedCategoryId: string | null;
  onCategoryChange: (id: string | null) => void;
}

interface TreeItemProps {
  node: CategoryTreeNode;
  depth: number;
  selectedCategoryId: string | null;
  onSelect: (id: string | null) => void;
  expandedNodes: Set<string>;
  onToggleExpand: (id: string) => void;
  isMobile: boolean;
  indexToKey: (i: number) => string;
  t: (key: string) => string;
  idxCounter: { value: number };
}

const TreeItem = ({ node, depth, selectedCategoryId, onSelect, expandedNodes, onToggleExpand, isMobile, indexToKey, t, idxCounter }: TreeItemProps) => {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedNodes.has(node.id);
  const currentIdx = idxCounter.value++;

  return (
    <div>
      <button
        onClick={() => onSelect(node.id)}
        className={cn(
          "w-full text-left rounded-md px-3 py-2 text-xs font-medium transition-colors flex items-center gap-2",
          selectedCategoryId === node.id
            ? "bg-primary/10 text-primary"
            : "text-foreground hover:bg-muted"
        )}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        {!isMobile && currentIdx < 10 && (
          <span className="text-xs text-muted-foreground font-mono w-4 shrink-0">
            {indexToKey(currentIdx)}
          </span>
        )}
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.id);
            }}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          >
            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        )}
        {node.icon && <span className="shrink-0">{node.icon}</span>}
        <span className="truncate">{node.name}</span>
      </button>
      {hasChildren && isExpanded && (
        <div>
          {node.children.map(child => (
            <TreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedCategoryId={selectedCategoryId}
              onSelect={onSelect}
              expandedNodes={expandedNodes}
              onToggleExpand={onToggleExpand}
              isMobile={isMobile}
              indexToKey={indexToKey}
              t={t}
              idxCounter={idxCounter}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const CategorySelector = forwardRef<CategorySelectorHandle, Props>(({ categories, selectedCategoryId, onCategoryChange }, ref) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Expose open method via ref
  useImperativeHandle(ref, () => ({
    open: () => {
      setOpen(true);
      triggerRef.current?.focus();
    },
  }), []);

  // Build tree structure
  const categoryTree = useMemo(() => {
    const categoryMap = new Map<string, CategoryTreeNode>();
    const roots: CategoryTreeNode[] = [];

    // First pass: create nodes
    categories.forEach(cat => {
      categoryMap.set(cat.id, { ...cat, children: [] });
    });

    // Second pass: build tree
    categories.forEach(cat => {
      const node = categoryMap.get(cat.id)!;
      if (cat.parent_id && categoryMap.has(cat.parent_id)) {
        categoryMap.get(cat.parent_id)!.children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }, [categories]);

  // Build flattened list for keyboard navigation (with indentation info)
  const categoryTreeOptions = useMemo(() => {
    const result: Array<{ id: string | null; name: string; icon?: string; depth: number }> = [
      { id: null, name: t("tx.selectAllCategories"), icon: undefined, depth: 0 },
    ];

    const flattenTree = (nodes: CategoryTreeNode[], depth: number = 0) => {
      nodes.forEach(node => {
        result.push({ id: node.id, name: node.name, icon: node.icon || undefined, depth });
        if (node.children.length > 0) {
          flattenTree(node.children, depth + 1);
        }
      });
    };

    flattenTree(categoryTree);
    return result;
  }, [categoryTree, t]);

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);
  const activeLabel = selectedCategory ? selectedCategory.name : t("tx.selectAllCategories");

  // Expand/collapse state for tree nodes
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const toggleExpanded = useCallback((id: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

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
      if (idx >= 0 && idx < categoryTreeOptions.length) {
        handleSelect(categoryTreeOptions[idx].id);
      }
    }
  }, [open, categoryTreeOptions, isMobile]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button ref={triggerRef} onKeyDown={handleKeyDown} className="flex items-center gap-1.5 rounded-lg bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors whitespace-nowrap overflow-hidden max-w-[150px]">
          <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="truncate">{activeLabel}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-48 p-1 pointer-events-auto" onKeyDown={handleKeyDown} onOpenAutoFocus={(e) => e.preventDefault()}>
        {/* "All" option */}
        <button
          onClick={() => handleSelect(null)}
          className={cn(
            "w-full text-left rounded-md px-3 py-2 text-xs font-medium transition-colors flex items-center gap-2",
            selectedCategoryId === null
              ? "bg-primary/10 text-primary"
              : "text-foreground hover:bg-muted"
          )}
        >
          {!isMobile && (
            <span className="text-xs text-muted-foreground font-mono w-4 shrink-0">
              {indexToKey(0)}
            </span>
          )}
          <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="truncate">{t("tx.selectAllCategories")}</span>
        </button>
        {/* Tree items */}
        {categoryTree.map((node) => (
          <TreeItem
            key={node.id}
            node={node}
            depth={0}
            selectedCategoryId={selectedCategoryId}
            onSelect={handleSelect}
            expandedNodes={expandedNodes}
            onToggleExpand={toggleExpanded}
            isMobile={isMobile}
            indexToKey={indexToKey}
            t={t}
            idxCounter={{ value: 1 }}
          />
        ))}
      </PopoverContent>
    </Popover>
  );
});

CategorySelector.displayName = "CategorySelector";

export default CategorySelector;
