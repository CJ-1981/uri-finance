import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings2, Plus, X, ChevronUp, ChevronDown } from "lucide-react";
import { Category } from "@/hooks/useCategories";
import { useI18n } from "@/hooks/useI18n";

interface Props {
  categories: Category[];
  onAdd: (name: string, code?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onUpdateCode?: (id: string, code: string) => Promise<void>;
  onReorder?: (id: string, direction: "up" | "down") => Promise<void>;
  inline?: boolean;
}

const CategoryContent = ({ categories, onAdd, onDelete, onUpdateCode, onReorder }: Omit<Props, "inline">) => {
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingCodeId, setEditingCodeId] = useState<string | null>(null);
  const [editCodeValue, setEditCodeValue] = useState("");
  const { t } = useI18n();

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
      <div className="space-y-1 max-h-[40vh] overflow-y-auto">
        {categories.map((cat, idx) => (
          <div key={cat.id} className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2.5">
            {onReorder && (
              <div className="flex flex-col shrink-0">
                <button
                  onClick={() => onReorder(cat.id, "up")}
                  disabled={idx === 0}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
                >
                  <ChevronUp className="h-3 w-3" />
                </button>
                <button
                  onClick={() => onReorder(cat.id, "down")}
                  disabled={idx === categories.length - 1}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
                >
                  <ChevronDown className="h-3 w-3" />
                </button>
              </div>
            )}
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
            <span className="text-sm text-foreground flex-1 min-w-0 truncate">{cat.name}</span>
            <button onClick={() => onDelete(cat.id)} className="text-muted-foreground hover:text-expense transition-colors p-1 shrink-0">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

const CategoryManager = ({ categories, onAdd, onDelete, onUpdateCode, onReorder, inline }: Props) => {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();

  if (inline) {
    return <CategoryContent categories={categories} onAdd={onAdd} onDelete={onDelete} onUpdateCode={onUpdateCode} onReorder={onReorder} />;
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
          <CategoryContent categories={categories} onAdd={onAdd} onDelete={onDelete} onUpdateCode={onUpdateCode} onReorder={onReorder} />
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default CategoryManager;
