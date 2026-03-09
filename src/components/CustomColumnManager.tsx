import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, X, Hash, Type, EyeOff, Eye, FileText, GripVertical, Asterisk, Pencil, Check } from "lucide-react";
import { CustomColumn, ColumnType } from "@/hooks/useCustomColumns";
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
  columns: CustomColumn[];
  onAdd: (name: string, type: ColumnType) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onToggleMasked?: (id: string, masked: boolean) => Promise<void>;
  onToggleRequired?: (id: string, required: boolean) => Promise<void>;
  onUpdateSuggestions?: (id: string, suggestions: string[]) => Promise<void>;
  onReorder?: (id: string, direction: "up" | "down") => Promise<void>;
  onReorderAll?: (orderedIds: string[]) => Promise<void>;
  onRename?: (id: string, newName: string) => Promise<void>;
}

const SortableColumnItem = ({
  col,
  onDelete,
  onToggleMasked,
  onToggleRequired,
  onUpdateSuggestions,
  onRename,
  expandedCol,
  toggleExpand,
  suggestionsText,
  setSuggestionsText,
  handleSaveSuggestions,
  t,
}: {
  col: CustomColumn;
  onDelete: (id: string) => Promise<void>;
  onToggleMasked?: (id: string, masked: boolean) => Promise<void>;
  onToggleRequired?: (id: string, required: boolean) => Promise<void>;
  onUpdateSuggestions?: (id: string, suggestions: string[]) => Promise<void>;
  onRename?: (id: string, newName: string) => Promise<void>;
  expandedCol: string | null;
  toggleExpand: (col: CustomColumn) => void;
  suggestionsText: Record<string, string>;
  setSuggestionsText: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  handleSaveSuggestions: (colId: string) => void;
  t: (key: string) => string;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: col.id });
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(col.name);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const handleRenameSubmit = async () => {
    if (editName.trim() && editName.trim() !== col.name && onRename) {
      await onRename(col.id, editName.trim());
    }
    setEditing(false);
  };

  return (
    <div ref={setNodeRef} style={style} className="space-y-1">
      <div className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-sm text-foreground">
        <button {...attributes} {...listeners} className="touch-none text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing shrink-0 mr-0.5">
          <GripVertical className="h-4 w-4" />
        </button>
        {col.column_type === "numeric" ? (
          <Hash className="h-3 w-3 text-muted-foreground shrink-0" />
        ) : (
          <Type className="h-3 w-3 text-muted-foreground shrink-0" />
        )}
        {editing ? (
          <div className="flex-1 flex items-center gap-1">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="h-6 text-sm bg-background px-1.5 py-0"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameSubmit();
                if (e.key === "Escape") { setEditName(col.name); setEditing(false); }
              }}
            />
            <button onClick={handleRenameSubmit} className="text-muted-foreground hover:text-primary transition-colors">
              <Check className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <span className="flex-1 cursor-pointer" onDoubleClick={() => onRename && setEditing(true)}>{col.name}</span>
        )}
        {!editing && onRename && (
          <button
            onClick={() => { setEditName(col.name); setEditing(true); }}
            className="text-muted-foreground hover:text-primary transition-colors"
            title={t("cc.rename") || "Rename"}
          >
            <Pencil className="h-3 w-3" />
          </button>
        )}
        {col.column_type === "text" && onUpdateSuggestions && (
          <button
            onClick={() => toggleExpand(col)}
            className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-0.5"
            title={t("cc.manageSuggestions")}
          >
            <FileText className="h-3.5 w-3.5" />
            {(col.suggestions || []).length > 0 && (
              <span className="text-[10px] tabular-nums">{col.suggestions.length}</span>
            )}
          </button>
        )}
        {onToggleMasked && (
          <button
            onClick={() => onToggleMasked(col.id, !col.masked)}
            className={`transition-colors ${col.masked ? "text-amber-500" : "text-muted-foreground hover:text-amber-500"}`}
            title={col.masked ? t("cc.maskedOn") : t("cc.maskedOff")}
          >
            {col.masked ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        )}
        {onToggleRequired && (
          <button
            onClick={() => onToggleRequired(col.id, !col.required)}
            className={`transition-colors ${col.required ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
            title={col.required ? (t("cc.requiredOn") || "Required") : (t("cc.requiredOff") || "Optional")}
          >
            <Asterisk className={`h-3.5 w-3.5 ${col.required ? "" : "opacity-40"}`} />
          </button>
        )}
        <button onClick={() => onDelete(col.id)} className="text-muted-foreground hover:text-destructive transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {expandedCol === col.id && (
        <div className="ml-2 space-y-1.5">
          <p className="text-[11px] text-muted-foreground">{t("cc.suggestionsHint")}</p>
          <Textarea
            value={suggestionsText[col.id] || ""}
            onChange={(e) =>
              setSuggestionsText((prev) => ({ ...prev, [col.id]: e.target.value }))
            }
            placeholder={t("cc.suggestionsPlaceholder")}
            className="bg-background text-xs min-h-[80px]"
          />
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7"
            onClick={() => handleSaveSuggestions(col.id)}
          >
            {t("cc.saveSuggestions")}
          </Button>
        </div>
      )}
    </div>
  );
};

const CustomColumnManager = ({ columns, onAdd, onDelete, onToggleMasked, onToggleRequired, onUpdateSuggestions, onReorderAll, onRename }: Props) => {
  const [name, setName] = useState("");
  const [colType, setColType] = useState<ColumnType>("numeric");
  const [adding, setAdding] = useState(false);
  const [expandedCol, setExpandedCol] = useState<string | null>(null);
  const [suggestionsText, setSuggestionsText] = useState<Record<string, string>>({});
  const { t } = useI18n();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  const handleAdd = async () => {
    if (!name.trim()) return;
    setAdding(true);
    await onAdd(name.trim(), colType);
    setName("");
    setAdding(false);
  };

  const toggleExpand = (col: CustomColumn) => {
    if (expandedCol === col.id) {
      setExpandedCol(null);
    } else {
      setExpandedCol(col.id);
      if (!suggestionsText[col.id]) {
        setSuggestionsText((prev) => ({
          ...prev,
          [col.id]: (col.suggestions || []).join("\n"),
        }));
      }
    }
  };

  const handleSaveSuggestions = async (colId: string) => {
    if (!onUpdateSuggestions) return;
    const text = suggestionsText[colId] || "";
    const entries = text
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    await onUpdateSuggestions(colId, entries);
    setExpandedCol(null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !onReorderAll) return;

    const oldIndex = columns.findIndex((c) => c.id === active.id);
    const newIndex = columns.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(columns, oldIndex, newIndex);
    await onReorderAll(reordered.map((c) => c.id));
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="flex rounded-lg border border-input overflow-hidden shrink-0">
          <button
            type="button"
            onClick={() => setColType("numeric")}
            className={`px-2.5 py-2 text-xs font-medium transition-colors ${
              colType === "numeric" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
            }`}
            title={t("cc.numeric")}
          >
            <Hash className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setColType("text")}
            className={`px-2.5 py-2 text-xs font-medium transition-colors ${
              colType === "text" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
            }`}
            title={t("cc.text")}
          >
            <Type className="h-3.5 w-3.5" />
          </button>
        </div>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={colType === "numeric" ? t("cc.placeholder") : t("cc.textPlaceholder")}
          className="flex-1 bg-background"
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <Button size="sm" onClick={handleAdd} disabled={adding || !name.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {columns.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("cc.noColumns")}</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={columns.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {columns.map((col) => (
                <SortableColumnItem
                  key={col.id}
                  col={col}
                  onDelete={onDelete}
                  onToggleMasked={onToggleMasked}
                  onToggleRequired={onToggleRequired}
                  onUpdateSuggestions={onUpdateSuggestions}
                  onRename={onRename}
                  expandedCol={expandedCol}
                  toggleExpand={toggleExpand}
                  suggestionsText={suggestionsText}
                  setSuggestionsText={setSuggestionsText}
                  handleSaveSuggestions={handleSaveSuggestions}
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

export default CustomColumnManager;
