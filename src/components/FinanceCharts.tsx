import { Transaction } from "@/hooks/useTransactions";
import { CustomColumn } from "@/hooks/useCustomColumns";
import { useI18n } from "@/hooks/useI18n";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  AreaChart, Area, XAxis, YAxis,
  BarChart, Bar,
} from "recharts";
import { format, startOfMonth, subMonths } from "date-fns";
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

const ITEM_STYLE = { color: "hsl(210, 20%, 92%)" };

type PieGroupKey = "category" | "type" | string;
type MetricKey = "income" | "expense" | string;

const FinanceCharts = ({ transactions, customColumns }: Props) => {
  const { t } = useI18n();

  // --- Metric options for area/bar charts ---
  const metricOptions = useMemo(() => {
    const base = [
      { key: "income" as MetricKey, label: t("tx.income"), color: "hsl(152, 60%, 50%)" },
      { key: "expense" as MetricKey, label: t("tx.expense"), color: "hsl(0, 72%, 58%)" },
    ];
    const custom = customColumns
      .filter((col) => col.column_type === "numeric")
      .map((col, i) => ({
        key: col.name as MetricKey,
        label: col.name,
        color: COLORS[(i + 2) % COLORS.length],
      }));
    return [...base, ...custom];
  }, [customColumns, t]);

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

  const activeMetrics = metricOptions.filter((m) => selectedMetrics.has(m.key));

  // --- Monthly data ---
  const monthlyData = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const month = startOfMonth(subMonths(new Date(), 5 - i));
      const label = format(month, "MMM");
      const monthStr = format(month, "yyyy-MM");
      const monthTxs = transactions.filter((tx) => tx.transaction_date.startsWith(monthStr));

      const row: Record<string, string | number> = { name: label };
      row.income = monthTxs.filter((tx) => tx.type === "income").reduce((s, tx) => s + Number(tx.amount), 0);
      row.expense = monthTxs.filter((tx) => tx.type === "expense").reduce((s, tx) => s + Number(tx.amount), 0);

      for (const col of customColumns.filter((c) => c.column_type === "numeric")) {
        row[col.name] = monthTxs.reduce((s, tx) => {
          const v = tx.custom_values?.[col.name];
          return s + (v != null ? Number(v) : 0);
        }, 0);
      }
      return row;
    });
  }, [transactions, customColumns]);

  // --- Cumulative data ---
  const cumulativeData = useMemo(() => {
    const cumulative: Record<string, number> = {};
    return monthlyData.map((row) => {
      const cumRow: Record<string, string | number> = { name: row.name };
      for (const m of metricOptions) {
        cumulative[m.key] = (cumulative[m.key] || 0) + Number(row[m.key] || 0);
        cumRow[m.key] = cumulative[m.key];
      }
      return cumRow;
    });
  }, [monthlyData, metricOptions]);

  // --- Pie chart state ---
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
      {/* Metric selector */}
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

      {/* Filled Area Chart - Trend */}
      <div className="glass-card p-4">
        <h3 className="mb-4 text-sm font-medium text-muted-foreground">{t("chart.trend")}</h3>
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
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "hsl(215, 12%, 50%)", fontSize: 11 }} />
            <YAxis hide />
            <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={ITEM_STYLE} labelStyle={ITEM_STYLE} formatter={(value: number, name: string) => [`$${value.toLocaleString()}`, name]} />
            {activeMetrics.map((m) => (
              <Area key={m.key} type="monotone" dataKey={m.key} stroke={m.color} strokeWidth={2} fill={`url(#grad-${m.key})`} name={m.label} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Bar Chart - Cumulative */}
      <div className="glass-card p-4">
        <h3 className="mb-4 text-sm font-medium text-muted-foreground">{t("chart.cumulative")}</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={cumulativeData} barGap={2}>
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "hsl(215, 12%, 50%)", fontSize: 11 }} />
            <YAxis hide />
            <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={ITEM_STYLE} labelStyle={ITEM_STYLE} formatter={(value: number, name: string) => [`$${value.toLocaleString()}`, name]} />
            {activeMetrics.map((m) => (
              <Bar key={m.key} dataKey={m.key} fill={m.color} radius={[4, 4, 0, 0]} name={m.label} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Pie Chart */}
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
              <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={ITEM_STYLE} labelStyle={ITEM_STYLE} formatter={(value: number, name: string) => [`$${value.toLocaleString()}`, name]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            {categoryData.map((c, i) => (
              <div key={c.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                {c.name} <span className="text-foreground font-medium">${c.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FinanceCharts;
