import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings2, Plus, X, GripVertical } from "lucide-react";
import { Category } from "@/hooks/useCategories";
import { useI18n } from "@/hooks/useI18n";
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
  onDelete: (id: string) => Promise<void>;
  onUpdateCode?: (id: string, code: string) => Promise<void>;
  onUpdateIcon?: (id: string, icon: string) => Promise<void>;
  onReorder?: (id: string, direction: "up" | "down") => Promise<void>;
  onReorderAll?: (orderedIds: string[]) => Promise<void>;
  inline?: boolean;
}

const SortableCategoryItem = ({
  cat,
  onDelete,
  onUpdateCode,
  onUpdateIcon,
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
  t,
}: {
  cat: Category;
  onDelete: (id: string) => Promise<void>;
  onUpdateCode?: (id: string, code: string) => Promise<void>;
  onUpdateIcon?: (id: string, icon: string) => Promise<void>;
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
      <span className="text-sm text-foreground flex-1 min-w-0 truncate">{cat.name}</span>
      <button onClick={() => onDelete(cat.id)} className="text-muted-foreground hover:text-expense transition-colors p-1 shrink-0">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

const CategoryContent = ({ categories, onAdd, onDelete, onUpdateCode, onUpdateIcon, onReorderAll }: Omit<Props, "inline" | "onReorder">) => {
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingCodeId, setEditingCodeId] = useState<string | null>(null);
  const [editCodeValue, setEditCodeValue] = useState("");
  const [editingIconId, setEditingIconId] = useState<string | null>(null);
  const [editIconValue, setEditIconValue] = useState("");
  const { t } = useI18n();

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

  const handleCodeSave = async (id: string) => {
    if (onUpdateCode) {
      await onUpdateCode(id, editCodeValue);
    }
    setEditingCodeId(null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !onReorderAll) return;

    const oldIndex = categories.findIndex((c) => c.id === active.id);
    const newIndex = categories.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(categories, oldIndex, newIndex);
    await onReorderAll(reordered.map((c) => c.id));
  };

  return (
    <div className="space-y-3">
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
        <Button size="icon" onClick={handleAdd} disabled={adding || !newName.trim()} className="shrink-0 gradient-primary">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1 max-h-[40vh] overflow-y-auto">
            {categories.map((cat) => (
              <SortableCategoryItem
                key={cat.id}
                cat={cat}
                onDelete={onDelete}
                onUpdateCode={onUpdateCode}
                onUpdateIcon={onUpdateIcon}
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
                t={t}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};

const CategoryManager = ({ categories, onAdd, onDelete, onUpdateCode, onUpdateIcon, onReorder, onReorderAll, inline }: Props) => {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();

  if (inline) {
    return <CategoryContent categories={categories} onAdd={onAdd} onDelete={onDelete} onUpdateCode={onUpdateCode} onUpdateIcon={onUpdateIcon} onReorderAll={onReorderAll} />;
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          <Settings2 className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl bg-card border-border/50 px-6 pb-8 max-h-[70vh]">
        <SheetHeader>
          <SheetTitle className="text-foreground">{t("cat.manageCategories")}</SheetTitle>
        </SheetHeader>
        <div className="mt-4">
          <CategoryContent categories={categories} onAdd={onAdd} onDelete={onDelete} onUpdateCode={onUpdateCode} onUpdateIcon={onUpdateIcon} onReorderAll={onReorderAll} />
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default CategoryManager;
