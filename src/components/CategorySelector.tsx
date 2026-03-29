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
  visibleShortcutNumber?: number; // The shortcut number for this visible parent item
}

const TreeItem = ({ node, depth, selectedCategoryId, focusedIndex, categoryOptions, onSelect, expandedNodes, onToggleExpand, onSetFocus, isMobile, t, showShortcut, visibleShortcutNumber }: TreeItemProps) => {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedNodes.has(node.id);

  // Find this item's actual index in the flat categoryOptions array
  const globalIndex = useMemo(() => {
    return categoryOptions.findIndex(opt => opt.nodeId === node.id);
  }, [categoryOptions, node.id]);

  const isFocused = focusedIndex === globalIndex;
  const getShortcutLabel = () => {
    // Only show shortcuts for level 1 parent categories (depth === 0)
    // Use the provided visibleShortcutNumber (1-9, with 0 for the 10th)
    if (depth === 0 && visibleShortcutNumber !== undefined) {
      if (visibleShortcutNumber >= 1 && visibleShortcutNumber <= 9) return String(visibleShortcutNumber);
      if (visibleShortcutNumber === 10) return "0";
    }
    return undefined;
  };
  const displayShortcut = showShortcut !== false && getShortcutLabel();

  return (
    <div>
      <div className="flex items-center gap-1">
        {/* Explicit expand/collapse button */}
        {hasChildren && (
          <button
            type="button"
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
            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
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
          type="button"
          onClick={() => onSelect(node.id)}
          onFocus={() => onSetFocus(globalIndex)}
          onPointerDown={(e) => isMobile && e.stopPropagation()}
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
        (scrollableElement.style as CSSStyleDeclaration & { WebkitOverflowScrolling?: string }).WebkitOverflowScrolling = 'touch';
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

  // Build map of child -> parent for visibility checking
  const childToParentMap = useMemo(() => {
    const map = new Map<string, string>();
    const buildMap = (nodes: CategoryTreeNode[]) => {
      nodes.forEach(node => {
        if (node.children.length > 0) {
          node.children.forEach(child => {
            map.set(child.id, node.id);
          });
          buildMap(node.children);
        }
      });
    };
    buildMap(categoryTree);
    return map;
  }, [categoryTree]);

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);
  const activeLabel = selectedCategory ? selectedCategory.name : t("tx.selectAllCategories");

  // Expand/collapse state for tree nodes
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Check if an item is visible (all ancestors are expanded)
  const isItemVisible = useCallback((index: number): boolean => {
    if (index === 0) return true; // "All Categories" is always visible
    if (index >= categoryTreeOptions.length) return false;

    const item = categoryTreeOptions[index];
    if (item.depth === 0) return true; // Root items are always visible

    // Check if all ancestors are expanded
    let currentId = item.nodeId;
    while (currentId && childToParentMap.has(currentId)) {
      const parentId = childToParentMap.get(currentId)!;
      if (!expandedNodes.has(parentId)) {
        return false;
      }
      currentId = parentId;
    }
    return true;
  }, [categoryTreeOptions, expandedNodes, childToParentMap]);

  // Keyboard navigation state
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  // Calculate visible shortcut numbers for parent items (depth 0 only)
  const visibleShortcutMap = useMemo(() => {
    const map = new Map<string, number>();
    let count = 1; // Start from 1 (0 is for "All Categories")
    for (let i = 1; i < categoryTreeOptions.length; i++) {
      const item = categoryTreeOptions[i];
      // Only assign shortcuts to visible parent items (depth 0)
      if (item.depth === 0 && isItemVisible(i)) {
        map.set(item.nodeId, count++);
        if (count > 10) break; // Only support 0-9 shortcuts
      }
    }
    return map;
  }, [categoryTreeOptions, isItemVisible]);

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
          let next = prev === null ? 0 : prev + 1;
          // Skip invisible items (children whose parent is collapsed)
          while (next < categoryTreeOptions.length && !isItemVisible(next)) {
            next++;
          }
          if (next >= categoryTreeOptions.length) next = Math.max(0, prev ?? 0);
          return next;
        });
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusedIndex(prev => {
          let next = prev === null ? 0 : prev - 1;
          // Skip invisible items (children whose parent is collapsed)
          while (next >= 0 && !isItemVisible(next)) {
            next--;
          }
          if (next < 0) next = Math.min(categoryTreeOptions.length - 1, prev ?? 0);
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
      case "9": {
        e.preventDefault();
        const targetId = globalIndexToIdMap.get(parseInt(e.key, 10));
        if (targetId !== undefined) {
          handleSelect(targetId);
        }
        break;
      }
      case "0":
        e.preventDefault();
        handleSelect(null); // "All Categories"
        break;
    }
  }, [open, categoryTreeOptions, isMobile, handleSelect, focusedIndex, categories, expandedNodes, toggleExpanded]);

  return (
    <Popover open={open} onOpenChange={handleOpenChange} modal={isMobile}>
      <PopoverTrigger asChild>
        <button ref={triggerRef} type="button" onPointerDown={(e) => isMobile && e.stopPropagation()} onKeyDown={handleKeyDown} className="flex items-center gap-1.5 rounded-lg bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors whitespace-nowrap overflow-hidden max-w-[200px]">
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
          isMobile && "max-h-[60vh] z-[100]"
        )}
        onKeyDown={handleKeyDown}
        onOpenAutoFocus={(e) => e.preventDefault()}
        data-mobile-popover="true"
      >
        {/* "All" option */}
        <button
          type="button"
          onClick={() => handleSelect(null)}
          onFocus={() => setFocusedIndex(0)}
          onPointerDown={(e) => isMobile && e.stopPropagation()}
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
        {/* Tree items with native scroll for Safari compatibility */}
        <div
          data-category-scroll="true"
          className={cn(
            "overflow-y-auto",
            "max-h-[calc(50vh-50px)]",
            isMobile && "max-h-[calc(60vh-50px)]"
          )}
          style={{
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
            position: 'relative',
            zIndex: 1
          }}
          onWheel={(e) => {
            // Safari blocks wheel events on portaled popovers inside modals.
            // Imperatively scroll to ensure mouse wheel works on Safari desktop.
            e.stopPropagation();
            e.currentTarget.scrollTop += e.deltaY;
          }}
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
              visibleShortcutNumber={visibleShortcutMap.get(node.id)}
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

  // Handle open/close state
  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen) {
      setFocusedIndex(null);
    }
    setOpen(newOpen);

    // Auto-scroll modal to position category selector at top of viewport
    // This ensures the full dropdown list is visible on mobile
    if (newOpen && isMobile && triggerRef.current) {
      setTimeout(() => {
        if (!triggerRef.current) return;

        triggerRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
          inline: 'nearest'
        });
      }, 100);
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

  // Build map of child -> parent for visibility checking
  const childToParentMap = useMemo(() => {
    const map = new Map<string, string>();
    const buildMap = (nodes: CategoryTreeNode[]) => {
      nodes.forEach(node => {
        if (node.children.length > 0) {
          node.children.forEach(child => {
            map.set(child.id, node.id);
          });
          buildMap(node.children);
        }
      });
    };
    buildMap(categoryTree);
    return map;
  }, [categoryTree]);

  const selectedCategory = categories.find((c) => c.name === selectedCategoryName);
  const activeLabel = selectedCategory ? selectedCategory.name : t("tx.selectAllCategories");

  // Expand/collapse state for tree nodes
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Check if an item is visible (all ancestors are expanded)
  const isItemVisible = useCallback((index: number): boolean => {
    if (index === 0) return true; // "All Categories" is always visible
    if (index >= categoryTreeOptions.length) return false;

    const item = categoryTreeOptions[index];
    if (item.depth === 0) return true; // Root items are always visible

    // Check if all ancestors are expanded
    let currentId = item.nodeId;
    while (currentId && childToParentMap.has(currentId)) {
      const parentId = childToParentMap.get(currentId)!;
      if (!expandedNodes.has(parentId)) {
        return false;
      }
      currentId = parentId;
    }
    return true;
  }, [categoryTreeOptions, expandedNodes, childToParentMap]);

  // Keyboard navigation state
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  // Calculate visible shortcut numbers for parent items (depth 0 only)
  const visibleShortcutMap = useMemo(() => {
    const map = new Map<string, number>();
    let count = 1; // Start from 1 (0 is for "All Categories")
    for (let i = 1; i < categoryTreeOptions.length; i++) {
      const item = categoryTreeOptions[i];
      // Only assign shortcuts to visible parent items (depth 0)
      if (item.depth === 0 && isItemVisible(i)) {
        map.set(item.nodeId, count++);
        if (count > 10) break; // Only support 0-9 shortcuts
      }
    }
    return map;
  }, [categoryTreeOptions, isItemVisible]);

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
          let next = prev === null ? 0 : prev + 1;
          // Skip invisible items (children whose parent is collapsed)
          while (next < categoryTreeOptions.length && !isItemVisible(next)) {
            next++;
          }
          if (next >= categoryTreeOptions.length) next = Math.max(0, prev ?? 0);
          return next;
        });
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusedIndex(prev => {
          let next = prev === null ? 0 : prev - 1;
          // Skip invisible items (children whose parent is collapsed)
          while (next >= 0 && !isItemVisible(next)) {
            next--;
          }
          if (next < 0) next = Math.min(categoryTreeOptions.length - 1, prev ?? 0);
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
      case "9": {
        e.preventDefault();
        const targetId = globalIndexToIdMap.get(parseInt(e.key, 10));
        if (targetId !== undefined) {
          handleSelect(targetId);
        }
        break;
      }
      case "0":
        e.preventDefault();
        handleSelect(null); // "All Categories"
        break;
    }
  }, [open, categoryTreeOptions, isMobile, handleSelect, focusedIndex, categories, expandedNodes, toggleExpanded, globalIndexToIdMap]);

  return (
    <Popover open={open} onOpenChange={handleOpenChange} modal={isMobile}>
      <PopoverTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          onPointerDown={(e) => isMobile && e.stopPropagation()}
          tabIndex={0}
          data-tab-stop={!open ? "" : undefined}
          data-category-dropdown-open={open}
          onKeyDown={handleKeyDown}
          className="flex items-center gap-1.5 rounded-lg bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors whitespace-nowrap overflow-hidden max-w-[200px]"
        >
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
          isMobile && "max-h-[60vh] z-[100]"
        )}
        onKeyDown={handleKeyDown}
        onOpenAutoFocus={(e) => e.preventDefault()}
        data-mobile-popover="true"
      >
        {/* "All" option */}
        <button
          type="button"
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
        {/* Tree items with native scroll for Safari compatibility */}
        <div
          data-category-scroll="true"
          className={cn(
            "overflow-y-auto",
            "max-h-[calc(50vh-50px)]",
            isMobile && "max-h-[calc(60vh-50px)]"
          )}
          style={{
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
            position: 'relative',
            zIndex: 1
          }}
          onWheel={(e) => {
            // Safari blocks wheel events on portaled popovers inside modals.
            // Imperatively scroll to ensure mouse wheel works on Safari desktop.
            e.stopPropagation();
            e.currentTarget.scrollTop += e.deltaY;
          }}
        >
          {categoryTree.map((node) => (
            <TreeItem
              key={node.id}
              node={node}
              depth={0}
              selectedCategoryId={selectedCategory ? selectedCategory.id : null}
              focusedIndex={focusedIndex}
              categoryOptions={categoryTreeOptions}
              onSelect={handleSelect}
              expandedNodes={expandedNodes}
              onToggleExpand={toggleExpanded}
              onSetFocus={setFocusedIndex}
              isMobile={isMobile}
              t={t}
              showShortcut={true}
              visibleShortcutNumber={visibleShortcutMap.get(node.id)}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
});

CategoryNameSelector.displayName = "CategoryNameSelector";

export { CategoryNameSelector };
