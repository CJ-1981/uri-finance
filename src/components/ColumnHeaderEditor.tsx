import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Settings2, RotateCcw } from "lucide-react";
import { ColumnHeaders } from "@/hooks/useColumnHeaders";
import { useI18n } from "@/hooks/useI18n";

interface Props {
  headers: ColumnHeaders;
  onUpdate: (key: keyof ColumnHeaders, value: string) => void;
  onReset: () => void;
}

const FIELD_KEYS: { key: keyof ColumnHeaders; placeholder: string }[] = [
  { key: "date", placeholder: "Date" },
  { key: "type", placeholder: "Type" },
  { key: "category", placeholder: "Category" },
  { key: "description", placeholder: "Description" },
  { key: "amount", placeholder: "Amount" },
];

const ColumnHeaderEditor = ({ headers, onUpdate, onReset }: Props) => {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          <Settings2 className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">{t("admin.columnHeaders")}</p>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={onReset}>
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
        {FIELD_KEYS.map(({ key, placeholder }) => (
          <div key={key} className="space-y-1">
            <Label className="text-xs text-muted-foreground">{placeholder}</Label>
            <Input
              value={headers[key]}
              onChange={(e) => onUpdate(key, e.target.value)}
              placeholder={placeholder}
              className="h-8 text-sm"
            />
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
};

export default ColumnHeaderEditor;
