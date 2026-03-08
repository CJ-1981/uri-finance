import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X } from "lucide-react";
import { CustomColumn } from "@/hooks/useCustomColumns";

interface Props {
  columns: CustomColumn[];
  onAdd: (name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const CustomColumnManager = ({ columns, onAdd, onDelete }: Props) => {
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!name.trim()) return;
    setAdding(true);
    await onAdd(name.trim());
    setName("");
    setAdding(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Column name (e.g. Tax, Discount)"
          className="flex-1 bg-background"
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <Button size="sm" onClick={handleAdd} disabled={adding || !name.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {columns.length === 0 ? (
        <p className="text-xs text-muted-foreground">No custom columns yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {columns.map((col) => (
            <div
              key={col.id}
              className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-sm text-foreground"
            >
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
