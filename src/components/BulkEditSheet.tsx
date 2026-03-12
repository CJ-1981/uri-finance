import { useState, useMemo } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import NumberedSelect from "@/components/NumberedSelect";
import { Transaction } from "@/hooks/useTransactions";
import { Category } from "@/hooks/useCategories";
import { useI18n } from "@/hooks/useI18n";
import { Save } from "lucide-react";

interface Props {
  transactions: Transaction[];
  categories: Category[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBulkUpdate: (ids: string[], updates: Partial<Pick<Transaction, "type" | "category">>) => Promise<void>;
}

const BulkEditSheet = ({ transactions, categories, open, onOpenChange, onBulkUpdate }: Props) => {
  const { t } = useI18n();
  const [category, setCategory] = useState<string>("");
  const [type, setType] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Build options for selects
  const categoryOptions = useMemo(() => [
    { value: "", label: t("tx.bulkNoChange") },
    ...categories.map((c) => ({ value: c.name, label: c.name })),
  ], [categories, t]);

  const typeOptions = useMemo(() => [
    { value: "", label: t("tx.bulkNoChange") },
    { value: "income", label: t("tx.income") },
    { value: "expense", label: t("tx.expense") },
  ], [t]);

  const handleSave = async () => {
    const ids = transactions.map((tx) => tx.id);
    const updates: Partial<Pick<Transaction, "type" | "category">> = {};
    if (category) updates.category = category;
    if (type === "income" || type === "expense") updates.type = type;

    if (Object.keys(updates).length === 0) return;

    setSaving(true);
    await onBulkUpdate(ids, updates);
    setSaving(false);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl bg-card border-border/50 px-6 pb-8 max-h-[60vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-foreground">
            {t("tx.bulkEditTitle").replace("{n}", String(transactions.length))}
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            {t("tx.bulkEditDesc")}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">


          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs">{t("tx.category")}</Label>
            <NumberedSelect
              value={category}
              onValueChange={setCategory}
              items={categoryOptions}
              className="bg-muted/50 border-border/50"
              showNumbers
            />
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs">{t("tx.bulkType")}</Label>
            <NumberedSelect
              value={type}
              onValueChange={setType}
              items={typeOptions}
              className="bg-muted/50 border-border/50"
              showNumbers
            />
          </div>

          <Button
            onClick={handleSave}
            disabled={saving || (!category && !type)}
            className="w-full gradient-primary font-semibold text-primary-foreground hover:opacity-90 transition-opacity h-12"
          >
            <Save className="h-4 w-4 mr-1" />
            {saving ? t("tx.saving") : t("tx.bulkApply").replace("{n}", String(transactions.length))}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default BulkEditSheet;
