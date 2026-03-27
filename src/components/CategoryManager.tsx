import { useState, useMemo, useCallback, useRef } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Settings2, Plus, X, GripVertical, ChevronRight, ChevronDown, Tag, FileEdit, Save, RotateCcw } from "lucide-react";
import { Category, CategoryTreeNode } from "@/hooks/useCategories";
import { useI18n } from "@/hooks/useI18n";
import { cn } from "@/lib/utils";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Props {
  categories: Category[];
  onAdd: (name: string, code?: string) => Promise<void>;
  onAddSubCategory?: (parentId: string, name: string, code?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onUpdateName?: (id: string, name: string) => Promise<void>;
  onUpdateCode?: (id: string, code: string) => Promise<void>;
  onUpdateIcon?: (id: string, icon: string) => Promise<void>;
  onReorderAll?: (orderedIds: string[]) => Promise<void>;
  onUpdateParent?: (id: string, newParentId: string | null) => Promise<void>;
  onBulkUpdate?: (entries: { code: string; icon: string; name: string; level: number }[]) => Promise<void>;
  inline?: boolean;
}

// Tree structure for category display
interface CategoryTreeItemProps {
  node: CategoryTreeNode;
  depth: number;
  onDelete: (id: string) => void;
  onUpdateName?: (id: string, name: string) => void;
  onUpdateCode?: (id: string, code: string) => void;
  onUpdateIcon?: (id: string, icon: string) => Promise<void>;
  onUpdateParent?: (id: string, newParentId: string | null) => void;
  onAddSubCategory?: (parentId: string, name: string, code?: string) => Promise<void>;
  editingNameId: string | null;
  setEditingNameId: (id: string | null) => void;
  editNameValue: string;
  setEditNameValue: (v: string) => void;
  handleNameSave: (id: string) => void;
  editingCodeId: string | null;
  setEditingCodeId: (id: string | null) => void;
  editCodeValue: string;
  setEditCodeValue: (v: string) => void;
  handleCodeSave: (id: string) => void;
  editingIconId: string | null;
  setEditingIconId: (id: string | null) => void;
  editIconValue: string;
  setEditIconValue: (v: string) => void;
  handleIconSave: (id: string) => void;
  onUpdateIconFn?: (id: string, icon: string) => Promise<void>;
  t: (key: string) => string;
}

const CategoryTreeItem = ({ node, depth, onDelete, onUpdateName, onUpdateCode, onUpdateIcon, onUpdateParent, onAddSubCategory, editingNameId, setEditingNameId, editNameValue, setEditNameValue, handleNameSave, editingCodeId, setEditingCodeId, editCodeValue, setEditCodeValue, handleCodeSave, editingIconId, setEditingIconId, editIconValue, setEditIconValue, handleIconSave, onUpdateIconFn, t }: CategoryTreeItemProps) => {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div className="flex items-center gap-1">
        {/* Explicit expand/collapse button for tree structure */}
        {hasChildren && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="shrink-0 rounded transition-colors p-0.5 min-w-[20px] min-h-[20px] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
            title="Toggle children"
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        )}
        {/* Spacer if no children */}
        {!hasChildren && (
          <div className="w-[20px] h-[20px] shrink-0" />
        )}
        {/* Category code */}
        {editingCodeId === node.id ? (
          <Input
            value={editCodeValue}
            onChange={(e) => setEditCodeValue(e.target.value)}
            onBlur={() => handleCodeSave(node.id)}
            onKeyDown={(e) => e.key === "Enter" && handleCodeSave(node.id)}
            className="w-16 h-6 text-xs bg-muted/50 border-border/50 px-1.5 shrink-0"
            autoFocus
          />
        ) : (
          <button
            onClick={() => {
              if (onUpdateCode) {
                setEditingCodeId(node.id);
                setEditCodeValue(node.code);
              }
            }}
            className="text-[10px] font-mono text-muted-foreground bg-muted/50 rounded px-1.5 hover:bg-muted shrink-0"
            title={t("cat.editCode") || "Edit code"}
          >
            {node.code || "—"}
          </button>
        )}
        {/* Category emoji */}
        {editingIconId === node.id ? (
          <Input
            value={editIconValue}
            onChange={(e) => setEditIconValue(e.target.value)}
            onBlur={() => handleIconSave(node.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleIconSave(node.id);
            }}
            className="w-10 h-6 text-center text-sm bg-muted/50 border-border/50 px-1 shrink-0"
            autoFocus
            placeholder="😀"
          />
        ) : (
          <button
            onClick={() => {
              if (onUpdateIconFn) {
                setEditingIconId(node.id);
                setEditIconValue(node.icon || "");
              }
            }}
            className="text-base w-6 h-6 flex items-center justify-center rounded hover:bg-muted transition-colors shrink-0"
            title={t("cat.editIcon") || "Set emoji icon"}
          >
            {node.icon || "·"}
          </button>
        )}
        {/* Category name */}
        {editingNameId === node.id ? (
          <Input
            value={editNameValue}
            onChange={(e) => setEditNameValue(e.target.value)}
            onBlur={() => handleNameSave(node.id)}
            onKeyDown={(e) => e.key === "Enter" && handleNameSave(node.id)}
            className="flex-1 h-6 text-sm bg-muted/50 border-border/50 px-1.5 min-w-0"
            autoFocus
          />
        ) : (
          <span
            onClick={() => {
              if (onUpdateName) {
                setEditingNameId(node.id);
                setEditNameValue(node.name);
              }
            }}
            className="text-sm text-foreground truncate cursor-pointer hover:text-primary transition-colors flex-1 min-w-0"
          >
            {node.name}
          </span>
        )}
        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {onAddSubCategory && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const newSubCatName = prompt(t("cat.subCategoryPrompt") || "Enter sub-category name:");
                if (newSubCatName && newSubCatName.trim()) {
                  onAddSubCategory(node.id, newSubCatName.trim());
                }
              }}
              className="text-xs text-muted-foreground hover:text-primary transition-colors px-1 py-0.5 shrink-0"
              title={t("cat.addSubCategory") || "Add sub-category"}
            >
              <Plus className="h-3 w-3" />
            </button>
          )}
          <button onClick={() => onDelete(node.id)} className="text-xs text-muted-foreground hover:text-expense transition-colors px-1 py-0.5 shrink-0">
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
      {/* Children container */}
      {hasChildren && expanded && (
        <div className="flex flex-col pl-4">
          {node.children.map((child) => (
            <CategoryTreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              onDelete={onDelete}
              onUpdateName={onUpdateName}
              onUpdateCode={onUpdateCode}
              onUpdateIcon={onUpdateIcon}
              onUpdateParent={onUpdateParent}
              onAddSubCategory={onAddSubCategory}
              editingNameId={editingNameId}
              setEditingNameId={setEditingNameId}
              editNameValue={editNameValue}
              setEditNameValue={setEditNameValue}
              handleNameSave={handleNameSave}
              editingCodeId={editingCodeId}
              setEditingCodeId={setEditingCodeId}
              editCodeValue={editCodeValue}
              setEditCodeValue={setEditCodeValue}
              handleCodeSave={handleCodeSave}
              editingIconId={editingIconId}
              setEditingIconId={setEditingIconId}
              editIconValue={editIconValue}
              setEditIconValue={setEditIconValue}
              handleIconSave={handleIconSave}
              onUpdateIconFn={onUpdateIconFn}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const SortableCategoryItem = ({
  cat,
  onDelete,
  onUpdateName,
  onUpdateCode,
  onUpdateIcon,
  editingNameId,
  setEditingNameId,
  editNameValue,
  setEditNameValue,
  handleNameSave,
  editingCodeId,
  setEditingCodeId,
  editCodeValue,
  setEditCodeValue,
  handleCodeSave,
  editingIconId,
  setEditingIconId,
  editIconValue,
  setEditIconValue,
  onUpdateIconFn,
  onAddSubCategory,
  t,
}: {
  cat: Category;
  onDelete: (id: string) => Promise<void>;
  onUpdateName?: (id: string, name: string) => Promise<void>;
  onUpdateCode?: (id: string, code: string) => Promise<void>;
  onUpdateIcon?: (id: string, icon: string) => Promise<void>;
  editingNameId: string | null;
  setEditingNameId: (id: string | null) => void;
  editNameValue: string;
  setEditNameValue: (v: string) => void;
  handleNameSave: (id: string) => void;
  editingCodeId: string | null;
  setEditingCodeId: (id: string | null) => void;
  editCodeValue: string;
  setEditCodeValue: (v: string) => void;
  handleCodeSave: (id: string) => void;
  editingIconId: string | null;
  setEditingIconId: (id: string | null) => void;
  editIconValue: string;
  setEditIconValue: (v: string) => void;
  onUpdateIconFn?: (id: string, icon: string) => Promise<void>;
  onAddSubCategory?: (parentId: string, name: string, code?: string) => Promise<void>;
  t: (key: string) => string;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cat.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2.5">
      <button {...attributes} {...listeners} className="touch-none text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing shrink-0">
        <GripVertical className="h-4 w-4" />
      </button>
      {editingCodeId === cat.id ? (
        <Input
          value={editCodeValue}
          onChange={(e) => setEditCodeValue(e.target.value)}
          onBlur={() => handleCodeSave(cat.id)}
          onKeyDown={(e) => e.key === "Enter" && handleCodeSave(cat.id)}
          className="w-16 h-6 text-xs bg-background border-border/50 px-1.5"
          autoFocus
        />
      ) : (
        <button
          onClick={() => {
            setEditingCodeId(cat.id);
            setEditCodeValue(cat.code || "");
          }}
          className="text-[10px] font-mono text-muted-foreground bg-muted/50 rounded px-1.5 py-0.5 min-w-[2.5rem] text-center hover:bg-muted transition-colors"
          title={t("cat.editCode") || "Edit code"}
        >
          {cat.code || "—"}
        </button>
      )}
      {editingIconId === cat.id ? (
        <Input
          value={editIconValue}
          onChange={(e) => setEditIconValue(e.target.value)}
          onBlur={() => {
            if (onUpdateIconFn) onUpdateIconFn(cat.id, editIconValue);
            setEditingIconId(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (onUpdateIconFn) onUpdateIconFn(cat.id, editIconValue);
              setEditingIconId(null);
            }
          }}
          className="w-10 h-6 text-center text-sm bg-background border-border/50 px-1"
          autoFocus
          placeholder="😀"
        />
      ) : (
        <button
          onClick={() => {
            setEditingIconId(cat.id);
            setEditIconValue(cat.icon || "");
          }}
          className="text-base w-6 h-6 flex items-center justify-center rounded hover:bg-muted transition-colors shrink-0"
          title="Set emoji icon"
        >
          {cat.icon || "·"}
        </button>
      )}
      {editingNameId === cat.id ? (
        <Input
          value={editNameValue}
          onChange={(e) => setEditNameValue(e.target.value)}
          onBlur={() => handleNameSave(cat.id)}
          onKeyDown={(e) => e.key === "Enter" && handleNameSave(cat.id)}
          className="h-6 text-sm bg-background border-border/50 px-2 py-1 flex-1 min-w-0"
          autoFocus
        />
      ) : (
        <span
          onClick={() => {
            if (onUpdateName) {
              setEditingNameId(cat.id);
              setEditNameValue(cat.name);
            }
          }}
          className="text-sm text-foreground flex-1 min-w-0 truncate cursor-pointer hover:text-primary transition-colors"
          title={onUpdateName ? (t("cat.editName") || "Edit name") : undefined}
        >
          {cat.name}
        </span>
      )}
      {onAddSubCategory && (
        <button
          onClick={() => {
            const newSubCatName = prompt(t("cat.subCategoryPrompt") || "Enter sub-category name:");
            if (newSubCatName && newSubCatName.trim()) {
              onAddSubCategory(cat.id, newSubCatName.trim());
            }
          }}
          className="text-muted-foreground hover:text-income transition-colors p-1 shrink-0"
          title={t("cat.addSubCategory") || "Add sub-category"}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      )}
      <button onClick={() => onDelete(cat.id)} className="text-muted-foreground hover:text-expense transition-colors p-1 shrink-0">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

const CategoryContent = ({ categories, onAdd, onAddSubCategory, onDelete, onUpdateName, onUpdateCode, onUpdateIcon, onReorderAll, onBulkUpdate }: Omit<Props, "inline">) => {
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState("");
  const [editingCodeId, setEditingCodeId] = useState<string | null>(null);
  const [editCodeValue, setEditCodeValue] = useState("");
  const [editingIconId, setEditingIconId] = useState<string | null>(null);
  const [editIconValue, setEditIconValue] = useState("");
  const [isBulkEdit, setIsBulkEdit] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [savingBulk, setSavingBulk] = useState(false);
  const { t } = useI18n();

  // Build tree structure
  const treeStructure = useMemo(() => {
    const map = new Map<string, CategoryTreeNode>();
    const roots: CategoryTreeNode[] = [];

    // Initialize all nodes
    categories.forEach((cat) => {
      map.set(cat.id, { ...cat, children: [] });
    });

    // Build tree hierarchy
    categories.forEach((cat) => {
      const node = map.get(cat.id)!;
      if (cat.parent_id) {
        const parent = map.get(cat.parent_id);
        if (parent) {
          parent.children.push(node);
        } else {
          roots.push(node);
        }
      } else {
        roots.push(node);
      }
    });

    return roots;
  }, [categories]);

  const hasSubCategories = categories.some((cat) => cat.parent_id !== null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    await onAdd(newName, newCode);
    setNewName("");
    setNewCode("");
    setAdding(false);
  };

  const handleNameSave = async (id: string) => {
    if (onUpdateName) {
      await onUpdateName(id, editNameValue);
    }
    setEditingNameId(null);
  };

  const handleCodeSave = async (id: string) => {
    if (onUpdateCode) {
      await onUpdateCode(id, editCodeValue);
    }
    setEditingCodeId(null);
  };

  const handleIconSave = async (id: string) => {
    if (onUpdateIcon) {
      await onUpdateIcon(id, editIconValue);
    }
    setEditingIconId(null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !onReorderAll) return;

    const oldIndex = categories.findIndex((c) => c.id === active.id);
    const newIndex = categories.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(categories, oldIndex, newIndex);
    await onReorderAll(reordered.map((c) => c.id));
  };

  const handleEnterBulkEdit = () => {
    const flattened: { code: string; icon: string; name: string; level: number }[] = [];
    const traverse = (node: CategoryTreeNode, level: number) => {
      flattened.push({ code: node.code, icon: node.icon, name: node.name, level });
      node.children.forEach(child => traverse(child, level + 1));
    };
    treeStructure.forEach(root => traverse(root, 0));

    const text = flattened
      .map((c) => {
        const prefix = c.level > 0 ? "-".repeat(c.level) + " " : "";
        return `${prefix}${c.code || ""}, ${c.icon || ""}, ${c.name}`;
      })
      .join("\n");
    setBulkText(text);
    setIsBulkEdit(true);
  };

  const handleSaveBulk = async () => {
    if (!onBulkUpdate) return;
    setSavingBulk(true);
    const lines = bulkText.split("\n").filter((l) => l.trim());
    const entries = lines.map((line) => {
      const commentIdx = line.indexOf("#");
      const contentWithLevel = commentIdx !== -1 ? line.substring(0, commentIdx) : line;
      
      if (!contentWithLevel.trim()) return null;

      // Find indentation/hyphens
      const match = contentWithLevel.match(/^([ \t]*-*)[ \t]*(.*)/);
      const prefix = match?.[1] || "";
      const content = match?.[2] || "";
      const level = (prefix.match(/-/g) || []).length;

      // Determine delimiter (TAB, Comma, or Multiple Spaces)
      let code = "";
      let icon = "";
      let name = "";

      if (content.includes(",")) {
        const parts = content.split(",");
        code = parts[0]?.trim() || "";
        if (parts.length === 2) {
          name = parts[1]?.trim() || code || "Unnamed";
          icon = "";
        } else {
          icon = parts[1]?.trim() || "";
          name = parts.slice(2).join(",").trim() || code || "Unnamed";
        }
      } else if (content.includes("\t")) {
        const parts = content.split("\t");
        code = parts[0]?.trim() || "";
        name = parts.slice(1).join(" ").trim() || code || "Unnamed";
      } else {
        // Fallback: try splitting by 2+ spaces if no comma or tab
        const parts = content.split(/[ ]{2,}/);
        if (parts.length > 1) {
          code = parts[0]?.trim() || "";
          name = parts.slice(1).join(" ").trim() || code || "Unnamed";
        } else {
          name = content.trim() || "Unnamed";
        }
      }
      
      return { code, icon, name, level };
    }).filter((e): e is { code: string; icon: string; name: string; level: number } => e !== null);
    await onBulkUpdate(entries);
    setSavingBulk(false);
    setIsBulkEdit(false);
  };

  if (isBulkEdit) {
    return (
      <div className="space-y-3 animate-fade-in">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">
            {t("cat.bulkEditLabel") || "Bulk Edit (Code, Emoji, Name)"}
          </label>
          <Button variant="ghost" size="sm" onClick={() => setIsBulkEdit(false)} className="h-7 text-xs">
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            {t("tx.cancel") || "Cancel"}
          </Button>
        </div>
        <Textarea
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          placeholder="100, 🍔, Food"
          className="min-h-[250px] font-mono text-xs bg-muted/30 border-border/50"
        />
        <Button onClick={handleSaveBulk} disabled={savingBulk} className="w-full gradient-primary">
          <Save className="h-4 w-4 mr-1" />
          {savingBulk ? (t("tx.saving") || "Saving...") : (t("admin.save") || "Save")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 animate-fade-in">
      <div className="flex gap-2">
        <Input
          value={newCode}
          onChange={(e) => setNewCode(e.target.value)}
          placeholder={t("cat.codePlaceholder") || "Code"}
          className="bg-muted/50 border-border/50 w-20 shrink-0"
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t("cat.newPlaceholder")}
          className="bg-muted/50 border-border/50 flex-1"
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <div className="flex gap-1 shrink-0">
          <Button size="icon" onClick={handleAdd} disabled={adding || !newName.trim()} className="gradient-primary">
            <Plus className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleEnterBulkEdit} className="border-border/50">
            <FileEdit className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {hasSubCategories ? (
        <div className="space-y-1 max-h-[40vh] overflow-y-auto">
          {treeStructure.map((node) => (
            <CategoryTreeItem
              key={node.id}
              node={node}
              depth={0}
              onDelete={onDelete}
              onUpdateName={onUpdateName}
              onUpdateCode={onUpdateCode}
              onUpdateIcon={onUpdateIcon}
              onUpdateParent={undefined}
              onAddSubCategory={onAddSubCategory}
              editingNameId={editingNameId}
              setEditingNameId={setEditingNameId}
              editNameValue={editNameValue}
              setEditNameValue={setEditNameValue}
              handleNameSave={handleNameSave}
              editingCodeId={editingCodeId}
              setEditingCodeId={setEditingCodeId}
              editCodeValue={editCodeValue}
              setEditCodeValue={setEditCodeValue}
              handleCodeSave={handleCodeSave}
              editingIconId={editingIconId}
              setEditingIconId={setEditingIconId}
              editIconValue={editIconValue}
              setEditIconValue={setEditIconValue}
              handleIconSave={handleIconSave}
              onUpdateIconFn={onUpdateIcon}
              t={t}
            />
          ))}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-1 max-h-[40vh] overflow-y-auto">
              {categories.map((cat) => (
                <SortableCategoryItem
                  key={cat.id}
                  cat={cat}
                  onDelete={onDelete}
                  onUpdateName={onUpdateName}
                  onUpdateCode={onUpdateCode}
                  onUpdateIcon={onUpdateIcon}
                  editingNameId={editingNameId}
                  setEditingNameId={setEditingNameId}
                  editNameValue={editNameValue}
                  setEditNameValue={setEditNameValue}
                  handleNameSave={handleNameSave}
                  editingCodeId={editingCodeId}
                  setEditingCodeId={setEditingCodeId}
                  editCodeValue={editCodeValue}
                  setEditCodeValue={setEditCodeValue}
                  handleCodeSave={handleCodeSave}
                  editingIconId={editingIconId}
                  setEditingIconId={setEditingIconId}
                  editIconValue={editIconValue}
                  setEditIconValue={setEditIconValue}
                  onUpdateIconFn={onUpdateIcon}
                  onAddSubCategory={onAddSubCategory}
                  t={t}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
};

const CategoryManager = ({ categories, onAdd, onAddSubCategory, onDelete, onUpdateName, onUpdateCode, onUpdateIcon, onReorderAll, onBulkUpdate, inline }: Props) => {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
 
  if (inline) {
    return <CategoryContent categories={categories} onAdd={onAdd} onAddSubCategory={onAddSubCategory} onDelete={onDelete} onUpdateName={onUpdateName} onUpdateCode={onUpdateCode} onUpdateIcon={onUpdateIcon} onReorderAll={onReorderAll} onBulkUpdate={onBulkUpdate} />;
  }
 
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          <Settings2 className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl bg-card border-border/50 px-6 pb-8 max-h-[70vh]" data-testid="category-manager">
        <SheetHeader>
          <SheetTitle className="text-foreground">{t("cat.manageCategories")}</SheetTitle>
          <SheetDescription className="sr-only">{t("cat.manageCategoriesDesc")}</SheetDescription>
        </SheetHeader>
        <div className="mt-4">
          <CategoryContent categories={categories} onAdd={onAdd} onAddSubCategory={onAddSubCategory} onDelete={onDelete} onUpdateName={onUpdateName} onUpdateCode={onUpdateCode} onUpdateIcon={onUpdateIcon} onReorderAll={onReorderAll} onBulkUpdate={onBulkUpdate} />
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default CategoryManager;
