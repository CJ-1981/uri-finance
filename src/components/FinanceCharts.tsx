import { Transaction } from "@/hooks/useTransactions";
import { CustomColumn } from "@/hooks/useCustomColumns";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip,
  PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import { format, parseISO, startOfMonth, subMonths } from "date-fns";
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
];

const TOOLTIP_STYLE = {
  backgroundColor: "hsl(220, 18%, 12%)",
  border: "1px solid hsl(220, 14%, 18%)",
  borderRadius: "8px",
  color: "hsl(210, 20%, 92%)",
  fontSize: 12,
};

type MetricKey = "income" | "expense" | string;

const FinanceCharts = ({ transactions, customColumns }: Props) => {
  // Available metrics: income, expense + custom columns
  const metricOptions: { key: MetricKey; label: string; color: string }[] = useMemo(() => {
    const base = [
      { key: "income" as MetricKey, label: "Income", color: "hsl(152, 60%, 50%)" },
      { key: "expense" as MetricKey, label: "Expense", color: "hsl(0, 72%, 58%)" },
    ];
    const custom = customColumns.map((col, i) => ({
      key: col.name as MetricKey,
      label: col.name,
      color: COLORS[(i + 2) % COLORS.length],
    }));
    return [...base, ...custom];
  }, [customColumns]);

  const [selectedMetrics, setSelectedMetrics] = useState<Set<MetricKey>>(
    new Set(["income", "expense"])
  );

  const toggleMetric = (key: MetricKey) => {
    setSelectedMetrics((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const monthlyData = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const month = startOfMonth(subMonths(new Date(), 5 - i));
      const label = format(month, "MMM");
      const monthStr = format(month, "yyyy-MM");
      const monthTxs = transactions.filter((t) => t.transaction_date.startsWith(monthStr));

      const row: Record<string, string | number> = { name: label };

      row.income = monthTxs
        .filter((t) => t.type === "income")
        .reduce((s, t) => s + Number(t.amount), 0);

      row.expense = monthTxs
        .filter((t) => t.type === "expense")
        .reduce((s, t) => s + Number(t.amount), 0);

      // Custom column aggregates
      for (const col of customColumns) {
        row[col.name] = monthTxs.reduce((s, t) => {
          const v = t.custom_values?.[col.name];
          return s + (v != null ? Number(v) : 0);
        }, 0);
      }

      return row;
    });
  }, [transactions, customColumns]);

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

  const activeMetrics = metricOptions.filter((m) => selectedMetrics.has(m.key));

  return (
    <div className="space-y-6">
      {/* Metric selector chips */}
      <div className="flex flex-wrap gap-2">
        {metricOptions.map((m) => (
          <button
            key={m.key}
            onClick={() => toggleMetric(m.key)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              selectedMetrics.has(m.key)
                ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                : "bg-muted/30 text-muted-foreground"
            }`}
          >
            <div
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: m.color, opacity: selectedMetrics.has(m.key) ? 1 : 0.4 }}
            />
            {m.label}
          </button>
        ))}
      </div>

      {/* Filled area chart */}
      <div className="glass-card p-4">
        <h3 className="mb-4 text-sm font-medium text-muted-foreground">
          Trend (6 months)
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={monthlyData}>
            <defs>
              {activeMetrics.map((m) => (
                <linearGradient key={m.key} id={`grad-${m.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={m.color} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={m.color} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(215, 12%, 50%)", fontSize: 11 }}
            />
            <YAxis hide />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value: number, name: string) => [`$${value.toLocaleString()}`, name]}
            />
            {activeMetrics.map((m) => (
              <Area
                key={m.key}
                type="monotone"
                dataKey={m.key}
                stroke={m.color}
                strokeWidth={2}
                fill={`url(#grad-${m.key})`}
                name={m.label}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly bar chart */}
      <div className="glass-card p-4">
        <h3 className="mb-4 text-sm font-medium text-muted-foreground">Comparison (6 months)</h3>
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
              contentStyle={TOOLTIP_STYLE}
              formatter={(value: number, name: string) => [`$${value.toLocaleString()}`, name]}
            />
            {activeMetrics.map((m) => (
              <Bar key={m.key} dataKey={m.key} fill={m.color} radius={[4, 4, 0, 0]} name={m.label} />
            ))}
          </BarChart>
        </ResponsiveContainer>
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
                contentStyle={TOOLTIP_STYLE}
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
