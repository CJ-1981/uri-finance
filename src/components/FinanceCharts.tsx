import { Transaction } from "@/hooks/useTransactions";
import { CustomColumn } from "@/hooks/useCustomColumns";
import { useI18n } from "@/hooks/useI18n";
import { PeriodKey, DateRange } from "@/components/PeriodSelector";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  AreaChart, Area, XAxis, YAxis,
  BarChart, Bar,
} from "recharts";
import {
  format, startOfDay, startOfWeek, startOfMonth,
  eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval,
  subMonths, subDays, endOfDay, parseISO, isWithinInterval,
} from "date-fns";
import { useMemo, useState } from "react";

interface Props {
  transactions: Transaction[];
  customColumns: CustomColumn[];
  period: PeriodKey;
  customRange: DateRange;
  isViewer?: boolean;
  projectCurrency?: string;
}

const COLORS = [
  "hsl(168, 60%, 48%)", "hsl(200, 60%, 50%)", "hsl(280, 60%, 60%)",
  "hsl(40, 80%, 55%)", "hsl(320, 60%, 55%)", "hsl(0, 72%, 58%)",
  "hsl(140, 50%, 45%)", "hsl(25, 75%, 55%)", "hsl(240, 55%, 58%)",
  "hsl(60, 70%, 48%)", "hsl(350, 65%, 52%)", "hsl(180, 50%, 45%)",
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

type GroupKey = "category" | "type" | string;

function getTimeBuckets(period: PeriodKey, customRange: DateRange) {
  const now = new Date();
  let start: Date;
  let end: Date = endOfDay(now);

  switch (period) {
    case "today": start = startOfDay(now); break;
    case "week": start = startOfDay(subDays(now, 7)); break;
    case "month": start = startOfDay(subMonths(now, 1)); break;
    case "sixMonths": start = startOfDay(subMonths(now, 6)); break;
    case "custom":
      start = customRange.from ? startOfDay(customRange.from) : startOfDay(subMonths(now, 6));
      end = customRange.to ? endOfDay(customRange.to) : end;
      break;
    case "all": default: start = startOfDay(subMonths(now, 12)); break;
  }

  const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays <= 1) {
    return [{ start, end, label: format(start, "MMM d") }];
  } else if (diffDays <= 14) {
    return eachDayOfInterval({ start, end }).map((d) => ({
      start: startOfDay(d), end: endOfDay(d), label: format(d, "MMM d"),
    }));
  } else if (diffDays <= 90) {
    return eachWeekOfInterval({ start, end }).map((d) => ({
      start: startOfWeek(d),
      end: endOfDay(new Date(Math.min(startOfWeek(new Date(d.getTime() + 7 * 86400000)).getTime() - 1, end.getTime()))),
      label: format(d, "MMM d"),
    }));
  } else {
    return eachMonthOfInterval({ start, end }).map((d) => ({
      start: startOfMonth(d),
      end: endOfDay(new Date(Math.min(startOfMonth(new Date(d.getFullYear(), d.getMonth() + 1, 1)).getTime() - 1, end.getTime()))),
      label: format(d, "MMM yyyy"),
    }));
  }
}

function getGroupValue(tx: Transaction, groupBy: GroupKey, t: (k: string) => string): string {
  if (groupBy === "category") return tx.category;
  if (groupBy === "type") return tx.type === "income" ? t("tx.income") : t("tx.expense");
  return String(tx.custom_values?.[groupBy] || "N/A");
}

function GroupSelector({ options, value, onChange }: {
  options: { key: GroupKey; label: string }[];
  value: GroupKey;
  onChange: (k: GroupKey) => void;
}) {
  return (
    <div className="flex gap-1">
      {options.map((opt) => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          className={`rounded-md px-2 py-1 text-[10px] font-medium transition-all ${
            value === opt.key
              ? "bg-card text-foreground shadow-sm ring-1 ring-border"
              : "text-muted-foreground"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

const FinanceCharts = ({ transactions, customColumns, period, customRange, isViewer, projectCurrency = "USD" }: Props) => {
  const { t } = useI18n();
  const fmt = (value: number) => `${projectCurrency} ${value.toLocaleString()}`;

  // Filter out masked columns for viewers
  const visibleColumns = useMemo(() =>
    isViewer ? customColumns.filter((col) => !col.masked) : customColumns,
    [customColumns, isViewer]
  );

  const groupOptions: { key: GroupKey; label: string }[] = useMemo(() => {
    const base: { key: GroupKey; label: string }[] = [
      { key: "category", label: t("tx.category") },
      { key: "type", label: t("tx.type") },
    ];
    const textCols = visibleColumns
      .filter((col) => col.column_type === "text")
      .map((col) => ({ key: col.name as GroupKey, label: col.name }));
    return [...base, ...textCols];
  }, [visibleColumns, t]);

  const [trendGroupBy, setTrendGroupBy] = useState<GroupKey>("category");
  const [cumulativeGroupBy, setCumulativeGroupBy] = useState<GroupKey>("category");
  const [pieGroupBy, setPieGroupBy] = useState<GroupKey>("category");

  const buckets = useMemo(() => getTimeBuckets(period, customRange), [period, customRange]);

  // Build grouped time-series data for a given groupBy key
  const buildGroupedData = (groupBy: GroupKey) => {
    // Collect all unique group values
    const allGroups = new Set<string>();
    transactions.forEach((tx) => allGroups.add(getGroupValue(tx, groupBy, t)));
    const groups = Array.from(allGroups).sort();

    const data = buckets.map((bucket) => {
      const bucketTxs = transactions.filter((tx) => {
        const d = parseISO(tx.transaction_date);
        return isWithinInterval(d, { start: bucket.start, end: bucket.end });
      });
      const row: Record<string, string | number> = { name: bucket.label };
      for (const g of groups) {
        row[g] = bucketTxs
          .filter((tx) => getGroupValue(tx, groupBy, t) === g)
          .reduce((s, tx) => s + Number(tx.amount), 0);
      }
      return row;
    });

    const series = groups.map((g, i) => ({
      key: g,
      color: COLORS[i % COLORS.length],
    }));

    return { data, series };
  };

  const trendData = useMemo(() => buildGroupedData(trendGroupBy), [transactions, trendGroupBy, buckets, t]);
  const cumulativeRaw = useMemo(() => buildGroupedData(cumulativeGroupBy), [transactions, cumulativeGroupBy, buckets, t]);

  const cumulativeData = useMemo(() => {
    const cumulative: Record<string, number> = {};
    const data = cumulativeRaw.data.map((row) => {
      const cumRow: Record<string, string | number> = { name: row.name };
      for (const s of cumulativeRaw.series) {
        cumulative[s.key] = (cumulative[s.key] || 0) + Number(row[s.key] || 0);
        cumRow[s.key] = cumulative[s.key];
      }
      return cumRow;
    });
    return { data, series: cumulativeRaw.series };
  }, [cumulativeRaw]);

  // Pie chart data
  const pieData = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.forEach((tx) => {
      const g = getGroupValue(tx, pieGroupBy, t);
      map[g] = (map[g] || 0) + Number(tx.amount);
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
      {/* Pie Chart */}
      {pieData.length > 0 && (
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-muted-foreground">{t("chart.byCategory")}</h3>
            <GroupSelector options={groupOptions} value={pieGroupBy} onChange={setPieGroupBy} />
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" strokeWidth={0}>
                {pieData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={ITEM_STYLE} labelStyle={ITEM_STYLE} formatter={(value: number, name: string) => [fmt(value), name]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            {pieData.map((c, i) => (
              <div key={c.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                {c.name} <span className="text-foreground font-medium">{fmt(c.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filled Area Chart - Trend */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-muted-foreground">{t("chart.trend")}</h3>
          <GroupSelector options={groupOptions} value={trendGroupBy} onChange={setTrendGroupBy} />
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={trendData.data}>
            <defs>
              {trendData.series.map((s) => (
                <linearGradient key={s.key} id={`grad-trend-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "hsl(215, 12%, 50%)", fontSize: 11 }} />
            <YAxis hide />
            <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={ITEM_STYLE} labelStyle={ITEM_STYLE} formatter={(value: number, name: string) => [fmt(value), name]} />
            {trendData.series.map((s) => (
              <Area key={s.key} type="monotone" dataKey={s.key} stroke={s.color} strokeWidth={2} fill={`url(#grad-trend-${s.key})`} name={s.key} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          {trendData.series.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
              {s.key}
            </div>
          ))}
        </div>
      </div>

      {/* Bar Chart - Cumulative */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-muted-foreground">{t("chart.cumulative")}</h3>
          <GroupSelector options={groupOptions} value={cumulativeGroupBy} onChange={setCumulativeGroupBy} />
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={cumulativeData.data} barGap={2}>
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "hsl(215, 12%, 50%)", fontSize: 11 }} />
            <YAxis hide />
            <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={ITEM_STYLE} labelStyle={ITEM_STYLE} formatter={(value: number, name: string) => [fmt(value), name]} />
            {cumulativeData.series.map((s) => (
              <Bar key={s.key} dataKey={s.key} fill={s.color} radius={[4, 4, 0, 0]} name={s.key} />
            ))}
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          {cumulativeData.series.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
              {s.key}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FinanceCharts;
