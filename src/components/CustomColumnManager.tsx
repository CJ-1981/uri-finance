import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X, Hash, Type } from "lucide-react";
import { CustomColumn, ColumnType } from "@/hooks/useCustomColumns";
import { useI18n } from "@/hooks/useI18n";

interface Props {
  columns: CustomColumn[];
  onAdd: (name: string, type: ColumnType) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const CustomColumnManager = ({ columns, onAdd, onDelete }: Props) => {
  const [name, setName] = useState("");
  const [colType, setColType] = useState<ColumnType>("numeric");
  const [adding, setAdding] = useState(false);
  const { t } = useI18n();

  const handleAdd = async () => {
    if (!name.trim()) return;
    setAdding(true);
    await onAdd(name.trim(), colType);
    setName("");
    setAdding(false);
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
        <div className="flex flex-wrap gap-2">
          {columns.map((col) => (
            <div
              key={col.id}
              className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-sm text-foreground"
            >
              {col.column_type === "numeric" ? (
                <Hash className="h-3 w-3 text-muted-foreground shrink-0" />
              ) : (
                <Type className="h-3 w-3 text-muted-foreground shrink-0" />
              )}
              {col.name}
              <button onClick={() => onDelete(col.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomColumnManager;
