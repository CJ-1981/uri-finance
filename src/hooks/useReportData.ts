// SPEC-REPORT-001: useReportData hook for aggregating transaction data for the report summary table
import { useMemo } from "react";
import { Transaction } from "@/hooks/useTransactions";
import { Category } from "@/hooks/useCategories";

export interface ReportSummaryRow {
  categoryCode: string;
  categoryName: string;
  categoryEmoji: string;
  descriptions: string[];
  income: number;
  expense: number;
  net: number;
  percentage: number;
  currency: string;
  transactions: Transaction[];
}

export interface ReportSummaryByCurrency {
  currency: string;
  rows: ReportSummaryRow[];
  totalIncome: number;
  totalExpense: number;
  totalNet: number;
}

interface UseReportDataProps {
  transactions: Transaction[];
  categories: Category[];
  projectCurrency: string;
}

export function useReportData({
  transactions,
  categories,
  projectCurrency,
}: UseReportDataProps): ReportSummaryByCurrency[] {
  return useMemo(() => {
    // Group transactions by currency first
    const byCurrency: Record<
      string,
      {
        byCat: Record<
          string,
          { income: number; expense: number; catObj: Category | null; descriptions: Set<string>; transactions: Transaction[] }
        >;
        totalIncome: number;
        totalExpense: number;
      }
    > = {};

    for (const tx of transactions) {
      const cur = tx.currency || projectCurrency;
      if (!byCurrency[cur]) {
        byCurrency[cur] = { byCat: {}, totalIncome: 0, totalExpense: 0 };
      }
      const currGroup = byCurrency[cur];

      if (!currGroup.byCat[tx.category]) {
        const catObj = categories.find((c) => c.name === tx.category) || null;
        currGroup.byCat[tx.category] = { income: 0, expense: 0, catObj, descriptions: new Set(), transactions: [] };
      }
      
      currGroup.byCat[tx.category].transactions.push(tx);

      const desc = tx.description?.trim();
      if (desc) {
        currGroup.byCat[tx.category].descriptions.add(desc);
      }

      const amount = Number(tx.amount);
      if (tx.type === "income") {
        currGroup.byCat[tx.category].income += amount;
        currGroup.totalIncome += amount;
      } else {
        currGroup.byCat[tx.category].expense += amount;
        currGroup.totalExpense += amount;
      }
    }

    // Build result sorted: project currency first, then alphabetical
    const currencies = Object.keys(byCurrency).sort((a, b) => {
      if (a === projectCurrency) return -1;
      if (b === projectCurrency) return 1;
      return a.localeCompare(b);
    });

    return currencies.map((currency) => {
      const { byCat, totalIncome, totalExpense } = byCurrency[currency];
      const totalAbsolute = totalIncome + totalExpense;

      const rows: ReportSummaryRow[] = Object.entries(byCat)
        .map(([catName, { income, expense, catObj, descriptions, transactions }]) => {
          const net = income - expense;
          const catTotal = income + expense;
          const percentage =
            totalAbsolute > 0
              ? Math.round((catTotal / totalAbsolute) * 1000) / 10
              : 0;

          return {
            categoryCode: catObj?.code || "",
            categoryName: catName,
            categoryEmoji: catObj?.icon || "",
            descriptions: Array.from(descriptions),
            income,
            expense,
            net,
            percentage,
            currency,
            transactions: transactions.sort((a, b) => 
              new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
            ),
          };
        })
        .sort((a, b) => {
          const getGroup = (inc: number, exp: number) => {
            if (inc > 0 && exp === 0) return 0; // income only
            if (inc === 0 && exp > 0) return 1; // expense only
            return 2; // combined
          };

          const groupA = getGroup(a.income, a.expense);
          const groupB = getGroup(b.income, b.expense);
          if (groupA !== groupB) return groupA - groupB;

          // Tie-breaker: by total amount descending
          const aTotal = a.income + a.expense;
          const bTotal = b.income + b.expense;
          return bTotal - aTotal;
        });

      return {
        currency,
        rows,
        totalIncome,
        totalExpense,
        totalNet: totalIncome - totalExpense,
      };
    });
  }, [transactions, categories, projectCurrency]);
}
