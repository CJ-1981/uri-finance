import { useState, useMemo, useCallback } from "react";
import { useI18n } from "@/hooks/useI18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus, Trash2, FileText, Copy } from "lucide-react";
import { toast } from "sonner";

// Currency denomination configs
const DENOMINATIONS: Record<string, { bills: number[]; coins: number[] }> = {
  USD: {
    bills: [100, 50, 20, 10, 5, 2, 1],
    coins: [0.25, 0.10, 0.05, 0.01],
  },
  KRW: {
    bills: [50000, 10000, 5000, 1000],
    coins: [500, 100, 50, 10],
  },
  EUR: {
    bills: [200, 100, 50, 20, 10, 5],
    coins: [2, 1, 0.50, 0.20, 0.10, 0.05, 0.02, 0.01],
  },
  GBP: {
    bills: [50, 20, 10, 5],
    coins: [2, 1, 0.50, 0.20, 0.10, 0.05, 0.02, 0.01],
  },
  JPY: {
    bills: [10000, 5000, 2000, 1000],
    coins: [500, 100, 50, 10, 5, 1],
  },
  CNY: {
    bills: [100, 50, 20, 10, 5, 1],
    coins: [0.50, 0.10],
  },
  CAD: {
    bills: [100, 50, 20, 10, 5],
    coins: [2, 1, 0.25, 0.10, 0.05],
  },
  AUD: {
    bills: [100, 50, 20, 10, 5],
    coins: [2, 1, 0.50, 0.20, 0.10, 0.05],
  },
};

const DEFAULT_DENOMS = {
  bills: [100, 50, 20, 10, 5, 1],
  coins: [0.50, 0.25, 0.10, 0.05, 0.01],
};

function formatDenom(value: number, currency: string): string {
  if (value >= 1) return value.toLocaleString();
  // For coins < 1, show as cents/pence etc.
  if (currency === "USD" || currency === "CAD" || currency === "AUD") return `${Math.round(value * 100)}¢`;
  if (currency === "GBP") return `${Math.round(value * 100)}p`;
  if (currency === "EUR") return `${Math.round(value * 100)}c`;
  return value.toString();
}

interface CashCalculatorProps {
  currency: string;
  targetAmount?: number;
}

type Counts = Record<string, { named: number; anon: number }>;

const CACHE_KEY = "cash_calculator_counts";

function loadCachedCounts(allDenoms: number[]): Counts {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const today = new Date().toISOString().slice(0, 10);
      if (parsed.date === today && parsed.currency) {
        return parsed.counts;
      }
    }
  } catch {}
  const init: Counts = {};
  allDenoms.forEach((d) => { init[d.toString()] = { named: 0, anon: 0 }; });
  return init;
}

function saveCacheCounts(counts: Counts, currency: string) {
  const today = new Date().toISOString().slice(0, 10);
  localStorage.setItem(CACHE_KEY, JSON.stringify({ date: today, currency, counts }));
}

const CashCalculator = ({ currency }: CashCalculatorProps) => {
  const { t } = useI18n();
  const denoms = DENOMINATIONS[currency] || DEFAULT_DENOMS;
  const allDenoms = [...denoms.bills, ...denoms.coins];

  const [counts, setCounts] = useState<Counts>(() => loadCachedCounts(allDenoms));

  // Persist to localStorage on every change
  const setCountsAndCache = useCallback((updater: Counts | ((prev: Counts) => Counts)) => {
    setCounts((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveCacheCounts(next, currency);
      return next;
    });
  }, [currency]);

  // Reset counts when currency changes
  const denomKey = allDenoms.join(",");
  const [prevDenomKey, setPrevDenomKey] = useState(denomKey);
  if (denomKey !== prevDenomKey) {
    const init: Counts = {};
    allDenoms.forEach((d) => { init[d.toString()] = { named: 0, anon: 0 }; });
    setCounts(init);
    saveCacheCounts(init, currency);
    setPrevDenomKey(denomKey);
  }

  const updateCount = useCallback((denom: string, column: "named" | "anon", delta: number) => {
    setCountsAndCache((prev) => {
      const current = prev[denom]?.[column] ?? 0;
      const newVal = Math.max(0, current + delta);
      return { ...prev, [denom]: { ...prev[denom], [column]: newVal } };
    });
  }, [setCountsAndCache]);

  const setCount = useCallback((denom: string, column: "named" | "anon", value: number) => {
    setCountsAndCache((prev) => ({
      ...prev,
      [denom]: { ...prev[denom], [column]: Math.max(0, value) },
    }));
  }, [setCountsAndCache]);

  const totals = useMemo(() => {
    let namedBills = 0, namedCoins = 0, anonBills = 0, anonCoins = 0;
    allDenoms.forEach((d) => {
      const key = d.toString();
      const c = counts[key];
      if (c) {
        const isBillDenom = denoms.bills.includes(d);
        if (isBillDenom) {
          namedBills += d * c.named;
          anonBills += d * c.anon;
        } else {
          namedCoins += d * c.named;
          anonCoins += d * c.anon;
        }
      }
    });
    const named = namedBills + namedCoins;
    const anon = anonBills + anonCoins;
    return { named, anon, total: named + anon, namedBills, namedCoins, anonBills, anonCoins };
  }, [counts, allDenoms, denoms.bills]);

  const clearAll = () => {
    const init: Counts = {};
    allDenoms.forEach((d) => {
      init[d.toString()] = { named: 0, anon: 0 };
    });
    setCountsAndCache(init);
    toast.success(t("cash.cleared"));
  };

  const buildMarkdown = () => {
    const today = new Date().toISOString().slice(0, 10);
    const lines: string[] = [];
    lines.push(`# ${t("cash.title")} - ${today}`);
    lines.push("");
    lines.push(`Currency: ${currency}`);
    lines.push("");
    lines.push(`| ${t("cash.denomination")} | ${t("cash.named")} | ${t("cash.anon")} |`);
    lines.push("|---:|---:|---:|");

    allDenoms.forEach((d) => {
      const key = d.toString();
      const c = counts[key] || { named: 0, anon: 0 };
      if (c.named > 0 || c.anon > 0) {
        lines.push(`| ${formatDenom(d, currency)} | ${c.named} | ${c.anon} |`);
      }
    });

    const fmt = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2 });
    const billLabel = t("cash.bills");
    const coinLabel = t("cash.coins");

    lines.push("");
    lines.push(`**${t("cash.namedTotal")}:** ${currency} ${fmt(totals.named)} (${billLabel}: ${fmt(totals.namedBills)}, ${coinLabel}: ${fmt(totals.namedCoins)})`);
    lines.push("");
    lines.push(`**${t("cash.anonTotal")}:** ${currency} ${fmt(totals.anon)} (${billLabel}: ${fmt(totals.anonBills)}, ${coinLabel}: ${fmt(totals.anonCoins)})`);
    lines.push("");
    const totalBills = totals.namedBills + totals.anonBills;
    const totalCoins = totals.namedCoins + totals.anonCoins;
    lines.push(`**${t("cash.grandTotal")}:** ${currency} ${fmt(totals.total)} (${billLabel}: ${fmt(totalBills)}, ${coinLabel}: ${fmt(totalCoins)})`);
    return lines.join("\n");
  };

  const exportMarkdown = () => {
    const md = buildMarkdown();
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cash-count-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t("cash.exported"));
  };

  const copyMarkdown = async () => {
    const md = buildMarkdown();
    await navigator.clipboard.writeText(md);
    toast.success(t("cash.copied"));
  };

  const isBill = (d: number) => denoms.bills.includes(d);

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="grid grid-cols-[1fr_1fr_1fr] gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sticky top-0 bg-background z-10 py-1.5 border-b border-border/30">
        <div className="text-center">{t("cash.denomination")}</div>
        <div className="text-center">{t("cash.named")}</div>
        <div className="text-center">{t("cash.anon")}</div>
      </div>

      {/* Bills section */}
      {denoms.bills.length > 0 && (
        <div className="space-y-0.5">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-1">
            {t("cash.bills")}
          </p>
          {denoms.bills.map((d) => (
            <DenomRow
              key={`bill-${d}`}
              denom={d}
              label={formatDenom(d, currency)}
              counts={counts[d.toString()] || { named: 0, anon: 0 }}
              onUpdate={updateCount}
              onSet={setCount}
              isBill
            />
          ))}
        </div>
      )}

      {/* Coins section */}
      {denoms.coins.length > 0 && (
        <div className="space-y-0.5">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-1">
            {t("cash.coins")}
          </p>
          {denoms.coins.map((d) => (
            <DenomRow
              key={`coin-${d}`}
              denom={d}
              label={formatDenom(d, currency)}
              counts={counts[d.toString()] || { named: 0, anon: 0 }}
              onUpdate={updateCount}
              onSet={setCount}
              isBill={false}
            />
          ))}
        </div>
      )}

      {/* Totals */}
      <div className="glass-card p-3 space-y-1.5">
        <div className="space-y-0.5">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">{t("cash.namedTotal")}</span>
            <span className="font-bold text-income">
              {currency} {totals.named.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-end text-[10px] text-muted-foreground/70">
            ({t("cash.bills")}: {totals.namedBills.toLocaleString("en-US", { minimumFractionDigits: 2 })}, {t("cash.coins")}: {totals.namedCoins.toLocaleString("en-US", { minimumFractionDigits: 2 })})
          </div>
        </div>
        <div className="space-y-0.5">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">{t("cash.anonTotal")}</span>
            <span className="font-bold text-income">
              {currency} {totals.anon.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-end text-[10px] text-muted-foreground/70">
            ({t("cash.bills")}: {totals.anonBills.toLocaleString("en-US", { minimumFractionDigits: 2 })}, {t("cash.coins")}: {totals.anonCoins.toLocaleString("en-US", { minimumFractionDigits: 2 })})
          </div>
        </div>
        <div className="border-t border-border/30 pt-1.5 space-y-0.5">
          <div className="flex justify-between text-sm">
            <span className="font-semibold">{t("cash.grandTotal")}</span>
            <span className="font-bold text-foreground">
              {currency} {totals.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-end text-[10px] text-muted-foreground/70">
            ({t("cash.bills")}: {(totals.namedBills + totals.anonBills).toLocaleString("en-US", { minimumFractionDigits: 2 })}, {t("cash.coins")}: {(totals.namedCoins + totals.anonCoins).toLocaleString("en-US", { minimumFractionDigits: 2 })})
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-1.5 pb-4">
        <Button variant="outline" className="flex-1 text-[10px] leading-tight whitespace-normal h-auto py-2 px-2" onClick={clearAll}>
          <Trash2 className="h-3.5 w-3.5 mr-0.5 shrink-0" />
          {t("cash.clearAll")}
        </Button>
        <Button variant="outline" className="flex-1 text-[10px] leading-tight whitespace-normal h-auto py-2 px-2" onClick={copyMarkdown}>
          <Copy className="h-3.5 w-3.5 mr-0.5 shrink-0" />
          {t("cash.copy")}
        </Button>
        <Button variant="default" className="flex-1 text-[10px] leading-tight whitespace-normal h-auto py-2 px-2" onClick={exportMarkdown}>
          <FileText className="h-3.5 w-3.5 mr-0.5 shrink-0" />
          {t("cash.export")}
        </Button>
      </div>
    </div>
  );
};

interface DenomRowProps {
  denom: number;
  label: string;
  counts: { named: number; anon: number };
  onUpdate: (denom: string, column: "named" | "anon", delta: number) => void;
  onSet: (denom: string, column: "named" | "anon", value: number) => void;
  isBill: boolean;
}

const DenomRow = ({ denom, label, counts, onUpdate, onSet, isBill: isBillType }: DenomRowProps) => {
  const key = denom.toString();

  return (
    <div className="grid grid-cols-[1fr_1fr_1fr] gap-1 items-center py-0.5">
      {/* Denomination label */}
      <div className="flex items-center justify-center">
        <span className={`text-xs font-mono font-semibold ${isBillType ? "text-foreground" : "text-muted-foreground"}`}>
          {label}
        </span>
      </div>

      {/* Named column */}
      <CounterCell
        value={counts.named}
        onChange={(v) => onSet(key, "named", v)}
        onIncrement={() => onUpdate(key, "named", 1)}
        onDecrement={() => onUpdate(key, "named", -1)}
      />

      {/* Anon column */}
      <CounterCell
        value={counts.anon}
        onChange={(v) => onSet(key, "anon", v)}
        onIncrement={() => onUpdate(key, "anon", 1)}
        onDecrement={() => onUpdate(key, "anon", -1)}
      />
    </div>
  );
};

interface CounterCellProps {
  value: number;
  onChange: (v: number) => void;
  onIncrement: () => void;
  onDecrement: () => void;
}

const CounterCell = ({ value, onChange, onIncrement, onDecrement }: CounterCellProps) => (
  <div className="flex items-center gap-1 justify-center">
    <button
      type="button"
      onClick={onDecrement}
      className="h-9 w-9 flex items-center justify-center rounded-md bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95 transition-all shrink-0"
    >
      <Minus className="h-4 w-4" />
    </button>
    <Input
      type="number"
      inputMode="numeric"
      min={0}
      value={value || ""}
      onChange={(e) => onChange(parseInt(e.target.value) || 0)}
      className="h-8 w-12 text-center text-sm px-0.5 border-border/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
    />
    <button
      type="button"
      onClick={onIncrement}
      className="h-9 w-9 flex items-center justify-center rounded-md bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95 transition-all shrink-0"
    >
      <Plus className="h-4 w-4" />
    </button>
  </div>
);

export default CashCalculator;
