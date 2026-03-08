import { Transaction } from "@/hooks/useTransactions";
import { CustomColumn } from "@/hooks/useCustomColumns";
import { useI18n } from "@/hooks/useI18n";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
} from "recharts";
import { useMemo, useState } from "react";

interface Props {
  transactions: Transaction[];
  customColumns: CustomColumn[];
}

const COLORS = [
  "hsl(168, 60%, 48%)",
  "hsl(200, 60%, 50%)",
  "hsl(280, 60%, 60%)",
  "hsl(40, 80%, 55%)",
  "hsl(320, 60%, 55%)",
  "hsl(0, 72%, 58%)",
  "hsl(140, 50%, 45%)",
  "hsl(25, 75%, 55%)",
  "hsl(240, 55%, 58%)",
  "hsl(60, 70%, 48%)",
  "hsl(350, 65%, 52%)",
  "hsl(180, 50%, 45%)",
];

const TOOLTIP_STYLE = {
  backgroundColor: "hsl(220, 18%, 12%)",
  border: "1px solid hsl(220, 14%, 18%)",
  borderRadius: "8px",
  color: "hsl(210, 20%, 92%)",
  fontSize: 12,
  padding: "8px 12px",
};

type PieGroupKey = "category" | "type" | string;

const FinanceCharts = ({ transactions, customColumns }: Props) => {
  const { t } = useI18n();

  const pieGroupOptions: { key: PieGroupKey; label: string }[] = useMemo(() => {
    const base: { key: PieGroupKey; label: string }[] = [
      { key: "category", label: t("tx.category") },
      { key: "type", label: t("tx.type") },
    ];
    const textCols = customColumns
      .filter((col) => col.column_type === "text")
      .map((col) => ({ key: col.name as PieGroupKey, label: col.name }));
    return [...base, ...textCols];
  }, [customColumns, t]);

  const [pieGroupBy, setPieGroupBy] = useState<PieGroupKey>("category");

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.forEach((tx) => {
      let groupValue: string;
      if (pieGroupBy === "category") {
        groupValue = tx.category;
      } else if (pieGroupBy === "type") {
        groupValue = tx.type === "income" ? t("tx.income") : t("tx.expense");
      } else {
        groupValue = String(tx.custom_values?.[pieGroupBy] || "N/A");
      }
      map[groupValue] = (map[groupValue] || 0) + Number(tx.amount);
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [transactions, pieGroupBy, t]);

  if (transactions.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground text-sm">
        {t("chart.addToSee")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {categoryData.length > 0 && (
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-muted-foreground">{t("chart.expenseByCategory")}</h3>
            <div className="flex gap-1">
              {pieGroupOptions.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setPieGroupBy(opt.key)}
                  className={`rounded-md px-2 py-1 text-[10px] font-medium transition-all ${
                    pieGroupBy === opt.key
                      ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                      : "text-muted-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={categoryData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" strokeWidth={0}>
                {categoryData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: number) => [`$${value.toLocaleString()}`, ""]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            {categoryData.map((c, i) => (
              <div key={c.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                {c.name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FinanceCharts;
