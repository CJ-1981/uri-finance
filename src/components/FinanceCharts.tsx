import { Transaction } from "@/hooks/useTransactions";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from "recharts";
import { format, parseISO, startOfMonth, subMonths } from "date-fns";
import { useMemo } from "react";

interface Props {
  transactions: Transaction[];
}

const COLORS = [
  "hsl(168, 60%, 48%)",
  "hsl(200, 60%, 50%)",
  "hsl(280, 60%, 60%)",
  "hsl(40, 80%, 55%)",
  "hsl(320, 60%, 55%)",
  "hsl(0, 72%, 58%)",
];

const FinanceCharts = ({ transactions }: Props) => {
  const monthlyData = useMemo(() => {
    const last6 = Array.from({ length: 6 }, (_, i) => {
      const month = startOfMonth(subMonths(new Date(), 5 - i));
      const label = format(month, "MMM");
      const monthStr = format(month, "yyyy-MM");

      const income = transactions
        .filter((t) => t.type === "income" && t.transaction_date.startsWith(monthStr))
        .reduce((s, t) => s + Number(t.amount), 0);

      const expense = transactions
        .filter((t) => t.type === "expense" && t.transaction_date.startsWith(monthStr))
        .reduce((s, t) => s + Number(t.amount), 0);

      return { name: label, income, expense };
    });
    return last6;
  }, [transactions]);

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    transactions
      .filter((t) => t.type === "expense")
      .forEach((t) => {
        map[t.category] = (map[t.category] || 0) + Number(t.amount);
      });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [transactions]);

  if (transactions.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground text-sm">
        Add transactions to see charts
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Monthly bar chart */}
      <div className="glass-card p-4">
        <h3 className="mb-4 text-sm font-medium text-muted-foreground">Income vs Expenses (6 months)</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={monthlyData} barGap={2}>
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(215, 12%, 50%)", fontSize: 11 }}
            />
            <YAxis hide />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(220, 18%, 12%)",
                border: "1px solid hsl(220, 14%, 18%)",
                borderRadius: "8px",
                color: "hsl(210, 20%, 92%)",
                fontSize: 12,
              }}
              formatter={(value: number) => [`$${value.toLocaleString()}`, ""]}
            />
            <Bar dataKey="income" fill="hsl(152, 60%, 50%)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expense" fill="hsl(0, 72%, 58%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-2 flex justify-center gap-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="h-2.5 w-2.5 rounded-sm bg-income" /> Income
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="h-2.5 w-2.5 rounded-sm bg-expense" /> Expense
          </div>
        </div>
      </div>

      {/* Category pie */}
      {categoryData.length > 0 && (
        <div className="glass-card p-4">
          <h3 className="mb-4 text-sm font-medium text-muted-foreground">Expense by Category</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={75}
                dataKey="value"
                strokeWidth={0}
              >
                {categoryData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(220, 18%, 12%)",
                  border: "1px solid hsl(220, 14%, 18%)",
                  borderRadius: "8px",
                  color: "hsl(210, 20%, 92%)",
                  fontSize: 12,
                }}
                formatter={(value: number) => [`$${value.toLocaleString()}`, ""]}
              />
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
