import { Transaction } from "@/hooks/useTransactions";
import { TrendingUp, TrendingDown } from "lucide-react";
import { format, parseISO } from "date-fns";

interface Props {
  transactions: Transaction[];
}

const TransactionList = ({ transactions }: Props) => {
  if (transactions.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground text-sm">
        No transactions yet. Tap + to add one.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {transactions.slice(0, 20).map((tx, i) => (
        <div
          key={tx.id}
          className="flex items-center gap-3 rounded-xl bg-muted/30 px-4 py-3 animate-fade-in"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              tx.type === "income" ? "income-badge" : "expense-badge"
            }`}
          >
            {tx.type === "income" ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {tx.description || tx.category}
            </p>
            <p className="text-xs text-muted-foreground">
              {tx.category} · {format(parseISO(tx.transaction_date), "MMM d")}
            </p>
          </div>
          <p
            className={`text-sm font-semibold ${
              tx.type === "income" ? "text-income" : "text-expense"
            }`}
          >
            {tx.type === "income" ? "+" : "-"}${Number(tx.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
        </div>
      ))}
    </div>
  );
};

export default TransactionList;
