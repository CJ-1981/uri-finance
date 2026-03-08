import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { TrendingUp, TrendingDown, Trash2, Save } from "lucide-react";
import { Transaction } from "@/hooks/useTransactions";
import { Category } from "@/hooks/useCategories";
import { CustomColumn } from "@/hooks/useCustomColumns";

interface Props {
  transaction: Transaction | null;
  categories: Category[];
  customColumns: CustomColumn[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (id: string, updates: Partial<Pick<Transaction, "type" | "amount" | "category" | "description" | "transaction_date" | "custom_values">>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const TransactionDetailSheet = ({ transaction, categories, customColumns, open, onOpenChange, onUpdate, onDelete }: Props) => {
  const [type, setType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("General");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});

  const resetForm = () => {
    if (transaction) {
      setType(transaction.type);
      setAmount(String(transaction.amount));
      setCategory(transaction.category);
      setDescription(transaction.description || "");
      setDate(transaction.transaction_date);
      const cv: Record<string, string> = {};
      if (transaction.custom_values) {
        for (const [k, v] of Object.entries(transaction.custom_values)) {
          cv[k] = String(v);
        }
      }
      setCustomValues(cv);
    }
  };

  const handleOpenChange = (val: boolean) => {
    if (val && transaction) resetForm();
    onOpenChange(val);
  };

  const handleSave = async () => {
    if (!transaction || !amount || Number(amount) <= 0) return;
    setSaving(true);

    const cv: Record<string, number> = {};
    for (const col of customColumns) {
      const val = customValues[col.name];
      if (val && !isNaN(Number(val))) cv[col.name] = Number(val);
    }

    await onUpdate(transaction.id, {
      type,
      amount: Number(amount),
      category,
      description: description || null,
      transaction_date: date,
      custom_values: cv,
    });
    setSaving(false);
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!transaction) return;
    await onDelete(transaction.id);
    onOpenChange(false);
  };

  if (!transaction) return null;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl bg-card border-border/50 px-6 pb-8 max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-foreground">Edit Transaction</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setType("income")}
              className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-medium transition-all ${
                type === "income"
                  ? "income-badge ring-1 ring-income/30"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <TrendingUp className="h-4 w-4" /> Income
            </button>
            <button
              type="button"
              onClick={() => setType("expense")}
              className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-medium transition-all ${
                type === "expense"
                  ? "expense-badge ring-1 ring-expense/30"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <TrendingDown className="h-4 w-4" /> Expense
            </button>
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs">Amount</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="bg-muted/50 border-border/50 text-2xl font-bold h-14"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="bg-muted/50 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs">Date</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-muted/50 border-border/50"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs">Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What was this for?"
              className="bg-muted/50 border-border/50"
            />
          </div>

          {/* Custom numeric columns */}
          {customColumns.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {customColumns.map((col) => (
                <div key={col.id} className="space-y-2">
                  <Label className="text-muted-foreground text-xs">{col.name}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={customValues[col.name] || ""}
                    onChange={(e) => setCustomValues((prev) => ({ ...prev, [col.name]: e.target.value }))}
                    placeholder="0.00"
                    className="bg-muted/50 border-border/50"
                  />
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="h-12 px-4">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
                  <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 gradient-primary font-semibold text-primary-foreground hover:opacity-90 transition-opacity h-12"
            >
              <Save className="h-4 w-4 mr-1" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default TransactionDetailSheet;
