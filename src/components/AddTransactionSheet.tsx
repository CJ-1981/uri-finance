import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, TrendingUp, TrendingDown } from "lucide-react";

const CATEGORIES = ["Salary", "Freelance", "Sales", "Investment", "Food", "Transport", "Utilities", "Entertainment", "Shopping", "Health", "Education", "General"];

interface Props {
  onAdd: (tx: {
    type: "income" | "expense";
    amount: number;
    category: string;
    description?: string;
    transaction_date?: string;
  }) => Promise<void>;
}

const AddTransactionSheet = ({ onAdd }: Props) => {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("General");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return;
    setSubmitting(true);
    await onAdd({
      type,
      amount: Number(amount),
      category,
      description: description || undefined,
      transaction_date: date,
    });
    setSubmitting(false);
    setAmount("");
    setDescription("");
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="icon" className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full gradient-primary shadow-lg shadow-primary/30">
          <Plus className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl bg-card border-border/50 px-6 pb-8">
        <SheetHeader>
          <SheetTitle className="text-foreground">Add Transaction</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Type toggle */}
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
              placeholder="0.00"
              required
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
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
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
            <Label className="text-muted-foreground text-xs">Description (optional)</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What was this for?"
              className="bg-muted/50 border-border/50"
            />
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full gradient-primary font-semibold text-primary-foreground hover:opacity-90 transition-opacity h-12"
          >
            {submitting ? "Adding..." : "Add Transaction"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
};

export default AddTransactionSheet;
