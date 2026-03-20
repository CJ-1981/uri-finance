import { useState, useCallback, useMemo, useImperativeHandle, forwardRef, useRef } from "react";
import { ChevronDown, ChevronRight, Tag, Plus, Minus } from "lucide-react";
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

interface NameBasedProps {
  categories: Category[];
  selectedCategoryName: string | null;
  onCategoryChange: (name: string | null) => void;
}

interface TreeItemProps {
  node: CategoryTreeNode;
  depth: number;
  selectedCategoryId: string | null;
  focusedIndex: number | null;
  categoryOptions: Array<{ id: string | null; nodeId: string; name: string; depth: number }>;
  onSelect: (id: string | null) => void;
  expandedNodes: Set<string>;
  onToggleExpand: (id: string) => void;
  onSetFocus: (index: number) => void;
  isMobile: boolean;
  t: (key: string) => string;
  showShortcut?: boolean;
}

const TreeItem = ({ node, depth, selectedCategoryId, focusedIndex, categoryOptions, onSelect, expandedNodes, onToggleExpand, onSetFocus, isMobile, t, showShortcut }: TreeItemProps) => {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedNodes.has(node.id);

  // Find this item's actual index in the flat categoryOptions array
  const globalIndex = useMemo(() => {
    return categoryOptions.findIndex(opt => opt.nodeId === node.id);
  }, [categoryOptions, node.id]);

  const isFocused = focusedIndex === globalIndex;

  // Debug: log all TreeItem renders
  if (!isMobile) {
    console.log(`[CategorySelector] Rendering: "${node.name}" (globalIndex=${globalIndex}, depth=${depth}, hasChildren=${hasChildren}, childrenCount=${node.children.length})`);
  }

  // Debug: log when this item is focused
  if (isFocused && !isMobile) {
    console.log(`[CategorySelector] >>> FOCUSED: "${node.name}" (globalIndex=${globalIndex}, focusedIndex=${focusedIndex})`);
  }
  const getShortcutLabel = () => {
    // Only show shortcuts for level 1 parent categories (depth === 0)
    if (depth === 0) {
      // Map level 1 categories to 1-9, with 0 for the 10th
      if (globalIndex >= 1 && globalIndex <= 9) return String(globalIndex);
      if (globalIndex === 10) return "0";
    }
    return undefined;
  };
  const displayShortcut = showShortcut !== false && getShortcutLabel();

  // When expanded with children, don't render the parent button to avoid index collision
  // Only show children, which will have their own indices
  if (hasChildren && isExpanded) {
    return (
      <div>
        {/* Expand/collapse button only (collapsed state) */}
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.id);
            }}
            className={cn(
              "shrink-0 rounded transition-colors",
              isMobile
                ? "p-2 min-w-[36px] min-h-[36px] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
                : "p-0.5 min-w-[20px] min-h-[20px] flex items-center justify-center text-muted-foreground hover:text-foreground"
            )}
            title={t("tx.collapse") || "Collapse"}
          >
            {isMobile ? (
              <Minus className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>
          {/* Parent label (non-interactive, no focus) */}
          <span
            className={cn(
              "flex-1 px-3 py-2 text-xs font-medium flex items-center gap-2",
              selectedCategoryId === node.id
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground"
            )}
            style={{ paddingLeft: `${12 + depth * 16}px` }}
          >
            {node.icon && <span className="shrink-0">{node.icon}</span>}
            <span className="truncate">{node.name}</span>
          </span>
        </div>
        {/* Children container */}
        <div className="flex flex-col">
          {node.children.map((child) => (
            <TreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedCategoryId={selectedCategoryId}
              focusedIndex={focusedIndex}
              categoryOptions={categoryOptions}
              onSelect={onSelect}
              expandedNodes={expandedNodes}
              onToggleExpand={onToggleExpand}
              onSetFocus={onSetFocus}
              isMobile={isMobile}
              t={t}
              showShortcut={false}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-1">
        {/* Explicit expand/collapse button */}
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.id);
            }}
            className={cn(
              "shrink-0 rounded transition-colors",
              isMobile
                ? "p-2 min-w-[36px] min-h-[36px] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
                : "p-0.5 min-w-[20px] min-h-[20px] flex items-center justify-center text-muted-foreground hover:text-foreground"
            )}
            title={isExpanded ? t("tx.collapse") || "Collapse" : t("tx.expand") || "Expand"}
          >
            {isMobile ? (
              isExpanded ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />
            ) : (
              isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
            )}
          </button>
        )}
        {/* Spacer if no children */}
        {!hasChildren && (
          <div className={cn(
            isMobile ? "w-[36px] h-[36px]" : "w-[20px] h-[20px]"
          )} />
        )}
        {/* Category selection button */}
        <button
          onClick={() => onSelect(node.id)}
          onFocus={() => onSetFocus(globalIndex)}
          className={cn(
            "flex-1 text-left rounded-md px-3 py-2 text-xs font-medium transition-colors flex items-center gap-2",
            selectedCategoryId === node.id
              ? "bg-primary/10 text-primary"
              : "text-foreground hover:bg-muted",
            isFocused && !isMobile && "shadow-[inset_0_0_0_2px_hsl(var(--primary))]"
          )}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
        >
          {displayShortcut && !isMobile && (
            <span className="text-xs text-muted-foreground/50 font-mono w-4">{displayShortcut}</span>
          )}
          {node.icon && <span className="shrink-0">{node.icon}</span>}
          <span className="truncate">{node.name}</span>
        </button>
      </div>
      {/* Children container */}
      {hasChildren && isExpanded && (
        <div className="flex flex-col">
          {node.children.map((child) => (
            <TreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedCategoryId={selectedCategoryId}
              focusedIndex={focusedIndex}
              categoryOptions={categoryOptions}
              onSelect={onSelect}
              expandedNodes={expandedNodes}
              onToggleExpand={onToggleExpand}
              onSetFocus={onSetFocus}
              isMobile={isMobile}
              t={t}
              showShortcut={false}
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
  const popoverContentRef = useRef<HTMLDivElement>(null);

  // Reset focus when popover closes
  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen) {
      setFocusedIndex(null);
    }
    setOpen(newOpen);

    // Force enable touch scrolling on mobile
    if (newOpen && isMobile && popoverContentRef.current) {
      const scrollableElement = popoverContentRef.current.querySelector('[data-category-scroll="true"]') as HTMLElement;
      if (scrollableElement) {
        scrollableElement.style.touchAction = 'pan-y';
        (scrollableElement.style as any).WebkitOverflowScrolling = 'touch';
        scrollableElement.style.overscrollBehavior = 'contain';
      }
    }
  }, [isMobile]);

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
    const result: Array<{ id: string | null; name: string; icon?: string; depth: number; nodeId: string }> = [
      { id: null, name: t("tx.selectAllCategories"), icon: undefined, depth: 0, nodeId: "all" },
    ];

    const flattenTree = (nodes: CategoryTreeNode[], depth: number = 0) => {
      nodes.forEach(node => {
        result.push({ id: node.id, name: node.name, icon: node.icon || undefined, depth, nodeId: node.id });
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

  // Keyboard navigation state
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  // Build map of globalIndex -> category ID for keyboard shortcuts (parent-level only)
  const globalIndexToIdMap = useMemo(() => {
    const map = new Map<number, string | null>();
    map.set(0, null); // "All Categories"
    let count = 1;
    // Only map parent-level categories (depth 0) for shortcuts
    for (let i = 1; i < categoryTreeOptions.length; i++) {
      if (categoryTreeOptions[i].depth === 0) {
        map.set(count++, categoryTreeOptions[i].id);
      }
    }
    return map;
  }, [categoryTreeOptions]);

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

  const handleSelect = useCallback((id: string | null) => {
    onCategoryChange(id);
    setOpen(false);
    setFocusedIndex(null);
  }, [onCategoryChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (isMobile) return;

    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
        setFocusedIndex(0);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setFocusedIndex(prev => {
          const next = prev === null ? 0 : Math.min(prev + 1, categoryTreeOptions.length - 1);
          const nextItem = categoryTreeOptions[next];
          console.log(`[CategorySelector] ArrowDown: ${prev} -> ${next} | "${nextItem?.name}" depth:${nextItem?.depth}`);
          return next;
        });
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusedIndex(prev => {
          const next = prev === null ? 0 : Math.max(prev - 1, 0);
          const nextItem = categoryTreeOptions[next];
          console.log(`[CategorySelector] ArrowUp: ${prev} -> ${next} | "${nextItem?.name}" depth:${nextItem?.depth}`);
          return next;
        });
        break;
      case "ArrowRight":
        e.preventDefault();
        if (focusedIndex !== null && focusedIndex < categoryTreeOptions.length) {
          const categoryId = categoryTreeOptions[focusedIndex].id;
          if (categoryId !== null) {
            const hasChildren = categories.some(c => c.parent_id === categoryId);
            if (hasChildren && !expandedNodes.has(categoryId)) {
              toggleExpanded(categoryId);
            }
          }
        }
        break;
      case "ArrowLeft":
        e.preventDefault();
        if (focusedIndex !== null && focusedIndex < categoryTreeOptions.length) {
          const categoryId = categoryTreeOptions[focusedIndex].id;
          if (categoryId !== null && expandedNodes.has(categoryId)) {
            // Collapse if expanded
            toggleExpanded(categoryId);
          } else if (focusedIndex > 0) {
            // Move to parent/previous level
            const currentDepth = categoryTreeOptions[focusedIndex].depth;
            // Find first item with shallower depth
            for (let i = focusedIndex - 1; i >= 0; i--) {
              if (categoryTreeOptions[i].depth < currentDepth) {
                setFocusedIndex(i);
                break;
              }
            }
          }
        }
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (focusedIndex !== null && focusedIndex < categoryTreeOptions.length) {
          handleSelect(categoryTreeOptions[focusedIndex].id);
        }
        break;
      case "+":
      case "=":
        e.preventDefault();
        if (focusedIndex !== null && focusedIndex < categoryTreeOptions.length) {
          const categoryId = categoryTreeOptions[focusedIndex].id;
          if (categoryId !== null) {
            const hasChildren = categories.some(c => c.parent_id === categoryId);
            if (hasChildren) {
              toggleExpanded(categoryId);
            }
          }
        }
        break;
      case "-":
      case "_":
        e.preventDefault();
        if (focusedIndex !== null && focusedIndex < categoryTreeOptions.length) {
          const categoryId = categoryTreeOptions[focusedIndex].id;
          if (categoryId !== null && expandedNodes.has(categoryId)) {
            toggleExpanded(categoryId);
          }
        }
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        setFocusedIndex(null);
        break;
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
      case "6":
      case "7":
      case "8":
      case "9":
        e.preventDefault();
        const targetId = globalIndexToIdMap.get(parseInt(e.key, 10));
        if (targetId !== undefined) {
          handleSelect(targetId);
        }
        break;
      case "0":
        e.preventDefault();
        handleSelect(null); // "All Categories"
        break;
    }
  }, [open, categoryTreeOptions, isMobile, handleSelect, focusedIndex, categories, expandedNodes, toggleExpanded]);

  return (
    <Popover open={open} onOpenChange={handleOpenChange} modal={isMobile}>
      <PopoverTrigger asChild>
        <button ref={triggerRef} onKeyDown={handleKeyDown} className="flex items-center gap-1.5 rounded-lg bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors whitespace-nowrap overflow-hidden max-w-[200px]">
          <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="truncate">{activeLabel}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        ref={popoverContentRef}
        align="start"
        className={cn(
          "min-w-[200px] max-w-[300px] w-auto p-1 pointer-events-auto",
          isMobile && "max-h-[60vh]"
        )}
        onKeyDown={handleKeyDown}
        onOpenAutoFocus={(e) => e.preventDefault()}
        data-mobile-popover="true"
      >
        {/* "All" option */}
        <button
          onClick={() => handleSelect(null)}
          onFocus={() => setFocusedIndex(0)}
          className={cn(
            "w-full text-left rounded-md px-3 py-2 text-xs font-medium transition-colors flex items-center gap-2",
            selectedCategoryId === null
              ? "bg-primary/10 text-primary"
              : "text-foreground hover:bg-muted",
            focusedIndex === 0 && !isMobile && "shadow-[inset_0_0_0_2px_hsl(var(--primary))]"
          )}
        >
          {!isMobile && <span className="text-xs text-muted-foreground/50 font-mono w-4">0</span>}
          <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="truncate">{t("tx.selectAllCategories")}</span>
        </button>
        {/* Tree items with scrollable container */}
        <div
          data-category-scroll="true"
          className={cn(
            "overflow-y-auto overflow-x-hidden",
            isMobile && "max-h-[calc(60vh-50px)]"
          )}
          style={isMobile ? {
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
            overscrollBehavior: 'contain'
          } : undefined}
        >
          {categoryTree.map((node) => (
            <TreeItem
              key={node.id}
              node={node}
              depth={0}
              selectedCategoryId={selectedCategoryId}
              focusedIndex={focusedIndex}
              categoryOptions={categoryTreeOptions}
              onSelect={handleSelect}
              expandedNodes={expandedNodes}
              onToggleExpand={toggleExpanded}
              onSetFocus={setFocusedIndex}
              isMobile={isMobile}
              t={t}
              showShortcut={true}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
});

CategorySelector.displayName = "CategorySelector";

export default CategorySelector;

// Name-based category selector for modal forms
const CategoryNameSelector = forwardRef<CategorySelectorHandle, NameBasedProps>(({ categories, selectedCategoryName, onCategoryChange }, ref) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverContentRef = useRef<HTMLDivElement>(null);

  // Force touch scrolling on mobile when popover opens
  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen) {
      setFocusedIndex(null);
    }
    setOpen(newOpen);

    // Force enable touch scrolling on mobile
    if (newOpen && isMobile && popoverContentRef.current) {
      const scrollableElement = popoverContentRef.current.querySelector('[data-category-scroll="true"]') as HTMLElement;
      if (scrollableElement) {
        scrollableElement.style.touchAction = 'pan-y';
        (scrollableElement.style as any).WebkitOverflowScrolling = 'touch';
        scrollableElement.style.overscrollBehavior = 'contain';
      }
    }
  }, [isMobile]);

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
    const result: Array<{ id: string | null; name: string; icon?: string; depth: number; nodeId: string }> = [
      { id: null, name: t("tx.selectAllCategories"), icon: undefined, depth: 0, nodeId: "all" },
    ];

    const flattenTree = (nodes: CategoryTreeNode[], depth: number = 0) => {
      nodes.forEach(node => {
        result.push({ id: node.id, name: node.name, icon: node.icon || undefined, depth, nodeId: node.id });
        if (node.children.length > 0) {
          flattenTree(node.children, depth + 1);
        }
      });
    };

    flattenTree(categoryTree);
    return result;
  }, [categoryTree, t]);

  const selectedCategory = categories.find((c) => c.name === selectedCategoryName);
  const activeLabel = selectedCategory ? selectedCategory.name : t("tx.selectAllCategories");

  // Expand/collapse state for tree nodes
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Keyboard navigation state
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  // Build map of globalIndex -> category ID for keyboard shortcuts (parent-level only)
  const globalIndexToIdMap = useMemo(() => {
    const map = new Map<number, string | null>();
    map.set(0, null); // "All Categories"
    let count = 1;
    // Only map parent-level categories (depth 0) for shortcuts
    for (let i = 1; i < categoryTreeOptions.length; i++) {
      if (categoryTreeOptions[i].depth === 0) {
        map.set(count++, categoryTreeOptions[i].id);
      }
    }
    return map;
  }, [categoryTreeOptions]);

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

  const handleSelect = useCallback((id: string | null) => {
    if (id === null) {
      onCategoryChange(null);
    } else {
      const category = categories.find(c => c.id === id);
      if (category) {
        onCategoryChange(category.name);
      }
    }
    setOpen(false);
    setFocusedIndex(null);
  }, [onCategoryChange, categories]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (isMobile) return;

    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
        setFocusedIndex(0);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setFocusedIndex(prev => {
          const next = prev === null ? 0 : Math.min(prev + 1, categoryTreeOptions.length - 1);
          const nextItem = categoryTreeOptions[next];
          console.log(`[CategorySelector] ArrowDown: ${prev} -> ${next} | "${nextItem?.name}" depth:${nextItem?.depth}`);
          return next;
        });
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusedIndex(prev => {
          const next = prev === null ? 0 : Math.max(prev - 1, 0);
          const nextItem = categoryTreeOptions[next];
          console.log(`[CategorySelector] ArrowUp: ${prev} -> ${next} | "${nextItem?.name}" depth:${nextItem?.depth}`);
          return next;
        });
        break;
      case "ArrowRight":
        e.preventDefault();
        if (focusedIndex !== null && focusedIndex < categoryTreeOptions.length) {
          const categoryId = categoryTreeOptions[focusedIndex].id;
          if (categoryId !== null) {
            const hasChildren = categories.some(c => c.parent_id === categoryId);
            if (hasChildren && !expandedNodes.has(categoryId)) {
              toggleExpanded(categoryId);
            }
          }
        }
        break;
      case "ArrowLeft":
        e.preventDefault();
        if (focusedIndex !== null && focusedIndex < categoryTreeOptions.length) {
          const categoryId = categoryTreeOptions[focusedIndex].id;
          if (categoryId !== null && expandedNodes.has(categoryId)) {
            // Collapse if expanded
            toggleExpanded(categoryId);
          } else if (focusedIndex > 0) {
            // Move to parent/previous level
            const currentDepth = categoryTreeOptions[focusedIndex].depth;
            // Find first item with shallower depth
            for (let i = focusedIndex - 1; i >= 0; i--) {
              if (categoryTreeOptions[i].depth < currentDepth) {
                setFocusedIndex(i);
                break;
              }
            }
          }
        }
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (focusedIndex !== null && focusedIndex < categoryTreeOptions.length) {
          handleSelect(categoryTreeOptions[focusedIndex].id);
        }
        break;
      case "+":
      case "=":
        e.preventDefault();
        if (focusedIndex !== null && focusedIndex < categoryTreeOptions.length) {
          const categoryId = categoryTreeOptions[focusedIndex].id;
          if (categoryId !== null) {
            const hasChildren = categories.some(c => c.parent_id === categoryId);
            if (hasChildren) {
              toggleExpanded(categoryId);
            }
          }
        }
        break;
      case "-":
      case "_":
        e.preventDefault();
        if (focusedIndex !== null && focusedIndex < categoryTreeOptions.length) {
          const categoryId = categoryTreeOptions[focusedIndex].id;
          if (categoryId !== null && expandedNodes.has(categoryId)) {
            toggleExpanded(categoryId);
          }
        }
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        setFocusedIndex(null);
        break;
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
      case "6":
      case "7":
      case "8":
      case "9":
        e.preventDefault();
        const targetId = globalIndexToIdMap.get(parseInt(e.key, 10));
        if (targetId !== undefined) {
          handleSelect(targetId);
        }
        break;
      case "0":
        e.preventDefault();
        handleSelect(null); // "All Categories"
        break;
    }
  }, [open, categoryTreeOptions, isMobile, handleSelect, focusedIndex, categories, expandedNodes, toggleExpanded, globalIndexToIdMap]);

  return (
    <Popover open={open} onOpenChange={handleOpenChange} modal={isMobile}>
      <PopoverTrigger asChild>
        <button ref={triggerRef} tabIndex={0} data-tab-stop={!open ? "" : undefined} onKeyDown={handleKeyDown} className="flex items-center gap-1.5 rounded-lg bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors whitespace-nowrap overflow-hidden max-w-[200px]">
          <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="truncate">{activeLabel}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        ref={popoverContentRef}
        align="start"
        className={cn(
          "min-w-[200px] max-w-[300px] w-auto p-1 pointer-events-auto",
          isMobile && "max-h-[60vh]",
          isMobile && "z-[100]"
        )}
        onKeyDown={handleKeyDown}
        onOpenAutoFocus={(e) => e.preventDefault()}
        data-mobile-popover="true"
      >
        {/* "All" option */}
        <button
          onClick={() => handleSelect(null)}
          onFocus={() => setFocusedIndex(0)}
          className={cn(
            "w-full text-left rounded-md px-3 py-2 text-xs font-medium transition-colors flex items-center gap-2",
            selectedCategoryName === null
              ? "bg-primary/10 text-primary"
              : "text-foreground hover:bg-muted",
            focusedIndex === 0 && !isMobile && "shadow-[inset_0_0_0_2px_hsl(var(--primary))]"
          )}
        >
          {!isMobile && <span className="text-xs text-muted-foreground/50 font-mono w-4">0</span>}
          <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="truncate">{t("tx.selectAllCategories")}</span>
        </button>
        {/* Tree items with scrollable container */}
        <div
          data-category-scroll="true"
          className={cn(
            "overflow-y-auto overflow-x-hidden",
            isMobile && "max-h-[calc(60vh-50px)]"
          )}
          style={isMobile ? {
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
            overscrollBehavior: 'contain'
          } : undefined}
        >
          {categoryTree.map((node, index) => (
            <TreeItem
              key={node.id}
              node={node}
              depth={0}
              selectedCategoryId={selectedCategory ? selectedCategory.id : null}
              focusedIndex={focusedIndex}
              globalIndex={index + 1}
              onSelect={handleSelect}
              expandedNodes={expandedNodes}
              onToggleExpand={toggleExpanded}
              onSetFocus={setFocusedIndex}
              isMobile={isMobile}
              t={t}
              showShortcut={true}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
});

CategoryNameSelector.displayName = "CategoryNameSelector";

export { CategoryNameSelector };
