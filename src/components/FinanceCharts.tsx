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
import { useMemo, useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";


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
          className={`rounded-md px-2 py-1 text-[10px] font-medium transition-all ${value === opt.key
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

function ClickableLegend({ series, hidden, onToggle }: {
  series: { key: string; color: string }[];
  hidden: Set<string>;
  onToggle: (key: string) => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap justify-center gap-3">
      {series.map((s) => (
        <button
          key={s.key}
          onClick={() => onToggle(s.key)}
          className={`flex items-center gap-1.5 text-xs transition-opacity ${hidden.has(s.key) ? "opacity-30 line-through" : "text-muted-foreground"
            }`}
        >
          <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
          {s.key}
        </button>
      ))}
    </div>
  );
}

function ClickablePieLegend({ data, hidden, onToggle, fmt }: {
  data: { name: string; value: number }[];
  hidden: Set<string>;
  onToggle: (key: string) => void;
  fmt: (v: number) => string;
}) {
  return (
    <div className="mt-2 flex flex-wrap justify-center gap-3">
      {data.map((c, i) => (
        <button
          key={c.name}
          onClick={() => onToggle(c.name)}
          className={`flex items-center gap-1.5 text-xs transition-opacity ${hidden.has(c.name) ? "opacity-30 line-through" : "text-muted-foreground"
            }`}
        >
          <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
          {c.name} <span className="text-foreground font-medium">{fmt(c.value)}</span>
        </button>
      ))}
    </div>
  );
}

function useHiddenSeries() {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const toggle = (key: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const reset = () => setHidden(new Set());
  return { hidden, toggle, reset };
}

const PieChartForCurrency = ({
  currency,
  transactions,
  projectCurrency,
  groupOptions,
  fmt,
  t,
}: {
  currency: string;
  transactions: Transaction[];
  projectCurrency: string;
  groupOptions: { key: GroupKey; label: string }[];
  fmt: (v: number, c: string) => string;
  t: (k: string) => string;
}) => {
  const [pieGroupBy, setPieGroupBy] = useState<GroupKey>("category");
  const pieHidden = useHiddenSeries();

  const handlePieGroup = (k: GroupKey) => {
    setPieGroupBy(k);
    pieHidden.reset();
  };

  const pieData = useMemo(() => {
    const map: Record<string, number> = {};
    transactions
      .filter((tx) => (tx.currency || projectCurrency) === currency)
      .forEach((tx) => {
        const g = getGroupValue(tx, pieGroupBy, t);
        map[g] = (map[g] || 0) + Number(tx.amount);
      });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [transactions, pieGroupBy, projectCurrency, t, currency]);

  if (pieData.length === 0) return null;
  const filteredPieData = pieData.filter((d) => !pieHidden.hidden.has(d.name));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-l-2 border-primary pl-2">
            {currency}
          </div>
        </div>
        <GroupSelector options={groupOptions} value={pieGroupBy} onChange={handlePieGroup} />
      </div>
      <div className="flex flex-col md:flex-row md:items-center md:gap-6">
        <div className="flex-1 w-full">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={filteredPieData}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={120}
                dataKey="value"
                strokeWidth={0}
                animationDuration={800}
              >
                {filteredPieData.map((entry) => {
                  const origIndex = pieData.findIndex((d) => d.name === entry.name);
                  return <Cell key={entry.name} fill={COLORS[origIndex % COLORS.length]} />;
                })}
              </Pie>
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                itemStyle={ITEM_STYLE}
                labelStyle={ITEM_STYLE}
                formatter={(value: number, name: string) => [fmt(value, currency), name]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="md:w-48 w-full">
          <ClickablePieLegend data={pieData} hidden={pieHidden.hidden} onToggle={pieHidden.toggle} fmt={(v) => fmt(v, currency)} />
        </div>
      </div>
    </div>
  );
};

const TrendChartForCurrency = ({
  currency,
  transactions,
  projectCurrency,
  groupOptions,
  buckets,
  fmt,
  t,
}: {
  currency: string;
  transactions: Transaction[];
  projectCurrency: string;
  groupOptions: { key: GroupKey; label: string }[];
  buckets: any[];
  fmt: (v: number, c: string) => string;
  t: (k: string) => string;
}) => {
  const [trendGroupBy, setTrendGroupBy] = useState<GroupKey>("category");
  const trendHidden = useHiddenSeries();

  const handleTrendGroup = (k: GroupKey) => {
    setTrendGroupBy(k);
    trendHidden.reset();
  };

  const trendData = useMemo(() => {
    const currencyTxs = transactions.filter((tx) => (tx.currency || projectCurrency) === currency);
    const allGroups = new Set<string>();
    currencyTxs.forEach((tx) => allGroups.add(getGroupValue(tx, trendGroupBy, t)));
    const groups = Array.from(allGroups).sort();

    const data = buckets.map((bucket) => {
      const bucketTxs = currencyTxs.filter((tx) => {
        const d = parseISO(tx.transaction_date);
        return isWithinInterval(d, { start: bucket.start, end: bucket.end });
      });
      const row: Record<string, string | number> = { name: bucket.label };
      for (const g of groups) {
        row[g] = bucketTxs
          .filter((tx) => getGroupValue(tx, trendGroupBy, t) === g)
          .reduce((s, tx) => s + Number(tx.amount), 0);
      }
      return row;
    });

    const series = groups.map((g, i) => ({
      key: g,
      color: COLORS[i % COLORS.length],
    }));

    return { data, series };
  }, [transactions, trendGroupBy, buckets, projectCurrency, t, currency]);

  if (trendData.series.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-l-2 border-primary pl-2">
            {currency}
          </div>
        </div>
        <GroupSelector options={groupOptions} value={trendGroupBy} onChange={handleTrendGroup} />
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={trendData.data}>
          <defs>
            {trendData.series.map((s) => (
              <linearGradient key={s.key} id={`grad-trend-${currency}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "hsl(215, 12%, 50%)", fontSize: 11 }} />
          <YAxis hide />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            itemStyle={ITEM_STYLE}
            labelStyle={ITEM_STYLE}
            formatter={(value: number, name: string) => [fmt(value, currency), name]}
          />
          {trendData.series.filter((s) => !trendHidden.hidden.has(s.key)).map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              stroke={s.color}
              strokeWidth={2}
              fill={`url(#grad-trend-${currency}-${s.key})`}
              name={s.key}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
      <ClickableLegend series={trendData.series} hidden={trendHidden.hidden} onToggle={trendHidden.toggle} />
    </div>
  );
};

const CumulativeChartForCurrency = ({
  currency,
  transactions,
  projectCurrency,
  groupOptions,
  buckets,
  fmt,
  t,
}: {
  currency: string;
  transactions: Transaction[];
  projectCurrency: string;
  groupOptions: { key: GroupKey; label: string }[];
  buckets: any[];
  fmt: (v: number, c: string) => string;
  t: (k: string) => string;
}) => {
  const [cumulativeGroupBy, setCumulativeGroupBy] = useState<GroupKey>("category");
  const cumulativeHidden = useHiddenSeries();

  const handleCumulativeGroup = (k: GroupKey) => {
    setCumulativeGroupBy(k);
    cumulativeHidden.reset();
  };

  const cumulativeData = useMemo(() => {
    const currencyTxs = transactions.filter((tx) => (tx.currency || projectCurrency) === currency);
    const allGroups = new Set<string>();
    currencyTxs.forEach((tx) => allGroups.add(getGroupValue(tx, cumulativeGroupBy, t)));
    const groups = Array.from(allGroups).sort();

    const data = buckets.map((bucket) => {
      const bucketTxs = currencyTxs.filter((tx) => {
        const d = parseISO(tx.transaction_date);
        return isWithinInterval(d, { start: bucket.start, end: bucket.end });
      });
      const row: Record<string, string | number> = { name: bucket.label };
      for (const g of groups) {
        row[g] = bucketTxs
          .filter((tx) => getGroupValue(tx, cumulativeGroupBy, t) === g)
          .reduce((s, tx) => s + Number(tx.amount), 0);
      }
      return row;
    });

    const series = groups.map((g, i) => ({
      key: g,
      color: COLORS[i % COLORS.length],
    }));

    const cumulativeMap: Record<string, number> = {};
    const cumulativeRows = data.map((row) => {
      const cumRow: Record<string, string | number> = { name: row.name };
      for (const s of series) {
        cumulativeMap[s.key] = (cumulativeMap[s.key] || 0) + Number(row[s.key] || 0);
        cumRow[s.key] = cumulativeMap[s.key];
      }
      return cumRow;
    });

    return { data: cumulativeRows, series };
  }, [transactions, cumulativeGroupBy, buckets, projectCurrency, t, currency]);

  if (cumulativeData.series.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-l-2 border-primary pl-2">
            {currency}
          </div>
        </div>
        <GroupSelector options={groupOptions} value={cumulativeGroupBy} onChange={handleCumulativeGroup} />
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={cumulativeData.data} barGap={2}>
          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "hsl(215, 12%, 50%)", fontSize: 11 }} />
          <YAxis hide />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            itemStyle={ITEM_STYLE}
            labelStyle={ITEM_STYLE}
            formatter={(value: number, name: string) => [fmt(value, currency), name]}
          />
          {cumulativeData.series.filter((s) => !cumulativeHidden.hidden.has(s.key)).map((s) => (
            <Bar key={s.key} dataKey={s.key} fill={s.color} radius={[4, 4, 0, 0]} name={s.key} />
          ))}
        </BarChart>
      </ResponsiveContainer>
      <ClickableLegend series={cumulativeData.series} hidden={cumulativeHidden.hidden} onToggle={cumulativeHidden.toggle} />
    </div>
  );
};

const FinanceCharts = ({ transactions, customColumns, period, customRange, isViewer, projectCurrency = "EUR" }: Props) => {
  const { t } = useI18n();
  const [showOtherCurrencies, setShowOtherCurrencies] = useState(() =>
    localStorage.getItem("chart-show-other-currencies") === "true"
  );

  useEffect(() => {
    localStorage.setItem("chart-show-other-currencies", String(showOtherCurrencies));
  }, [showOtherCurrencies]);

  const currencies = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach(tx => set.add(tx.currency || projectCurrency));
    const list = Array.from(set).sort();
    const idx = list.indexOf(projectCurrency);
    if (idx > -1) {
      list.splice(idx, 1);
      list.unshift(projectCurrency);
    }
    return list;
  }, [transactions, projectCurrency]);

  const activeCurrencies = showOtherCurrencies ? currencies : [projectCurrency];

  const fmt = (value: number, currency: string = projectCurrency) =>
    `${currency} ${value.toLocaleString()}`;

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

  const buckets = useMemo(() => getTimeBuckets(period, customRange), [period, customRange]);

  const hasOtherCurrencies = currencies.length > 1;

  if (transactions.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground text-sm">
        {t("chart.addToSee")}
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="finance-charts">
      {/* Settings row */}
      {hasOtherCurrencies && (
        <div className="flex items-center justify-end px-1">
          <div className="flex items-center gap-2 bg-muted/20 px-3 py-1.5 rounded-full border border-border/20" data-html2canvas-ignore="true">
            <Switch
              id="show-other-currency"
              checked={showOtherCurrencies}
              onCheckedChange={setShowOtherCurrencies}
              className="scale-75 origin-left"
            />
            <Label htmlFor="show-other-currency" className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider cursor-pointer -ml-1.5">
              {t("chart.showOtherCurrency")}
            </Label>
          </div>
        </div>
      )}

      {/* Pie Chart */}
      <div className="glass-card p-4" data-chart-type="pie">
        <h3 className="text-sm font-medium text-muted-foreground mb-4">{t("chart.byCategory")}</h3>
        <div className="space-y-12">
          {activeCurrencies.map(cur => (
            <PieChartForCurrency
              key={cur}
              currency={cur}
              transactions={transactions}
              projectCurrency={projectCurrency}
              groupOptions={groupOptions}
              fmt={fmt}
              t={t}
            />
          ))}
        </div>
      </div>

      {/* Trend Chart */}
      <div className="glass-card p-4" data-chart-type="trend">
        <h3 className="text-sm font-medium text-muted-foreground mb-4">{t("chart.trend")}</h3>
        <div className="space-y-12">
          {activeCurrencies.map(cur => (
            <TrendChartForCurrency
              key={cur}
              currency={cur}
              transactions={transactions}
              projectCurrency={projectCurrency}
              groupOptions={groupOptions}
              fmt={fmt}
              t={t}
              buckets={buckets}
            />
          ))}
        </div>
      </div>

      {/* Cumulative Chart */}
      <div className="glass-card p-4" data-chart-type="cumulative">
        <h3 className="text-sm font-medium text-muted-foreground mb-4">{t("chart.cumulative")}</h3>
        <div className="space-y-12">
          {activeCurrencies.map(cur => (
            <CumulativeChartForCurrency
              key={cur}
              currency={cur}
              transactions={transactions}
              projectCurrency={projectCurrency}
              groupOptions={groupOptions}
              fmt={fmt}
              t={t}
              buckets={buckets}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default FinanceCharts;
