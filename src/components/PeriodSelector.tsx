import { useState, useMemo, useCallback, useImperativeHandle, forwardRef, useRef } from "react";
import { startOfDay, subDays, subMonths, format, parseISO } from "date-fns";
import { CalendarIcon, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useI18n } from "@/hooks/useI18n";
import { useIsMobile } from "@/hooks/use-mobile";

export type PeriodKey = "today" | "week" | "month" | "sixMonths" | "all" | "custom";

export interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

export interface PeriodSelectorHandle {
  open: () => void;
}

interface Props {
  period: PeriodKey;
  onPeriodChange: (p: PeriodKey) => void;
  customRange: DateRange;
  onCustomRangeChange: (r: DateRange) => void;
}

const PeriodSelector = forwardRef<PeriodSelectorHandle, Props>(({ period, onPeriodChange, customRange, onCustomRangeChange }, ref) => {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const isMobile = useIsMobile();
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Expose open method via ref
  useImperativeHandle(ref, () => ({
    open: () => {
      setMenuOpen(true);
      triggerRef.current?.focus();
    },
  }), []);

  const presets: { key: PeriodKey; label: string }[] = [
    { key: "today", label: t("period.today") },
    { key: "week", label: t("period.week") },
    { key: "month", label: t("period.month") },
    { key: "sixMonths", label: t("period.sixMonths") },
    { key: "all", label: t("period.all") },
    { key: "custom", label: t("period.custom") },
  ];

  const activeLabel = useMemo(() => {
    if (period === "custom" && customRange.from) {
      const from = format(customRange.from, "MMM d");
      const to = customRange.to ? format(customRange.to, "MMM d") : "…";
      return `${from} – ${to}`;
    }
    return presets.find((p) => p.key === period)?.label || t("period.all");
  }, [period, customRange, presets, t]);

  const handleSelect = (key: PeriodKey) => {
    if (key === "custom") {
      setMenuOpen(false);
      setCalendarOpen(true);
      onPeriodChange("custom");
    } else {
      onPeriodChange(key);
      setMenuOpen(false);
    }
  };

  const indexToKey = (i: number) => (i < 9 ? String(i + 1) : "0");
  const keyToIndex = (key: string) => (key === "0" ? 9 : Number(key) - 1);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (isMobile) return;

    if (!menuOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setMenuOpen(true);
      }
      return;
    }

    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      const idx = keyToIndex(e.key);
      if (idx >= 0 && idx < presets.length) {
        handleSelect(presets[idx].key);
      }
    }
  }, [menuOpen, presets, isMobile]);

  return (
    <div className="flex items-center gap-2">
      {/* Main period dropdown */}
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <button ref={triggerRef} onKeyDown={handleKeyDown} className="flex items-center gap-1.5 rounded-lg bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors">
            <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
            {activeLabel}
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-36 p-1 pointer-events-auto" onKeyDown={handleKeyDown} onOpenAutoFocus={(e) => e.preventDefault()}>
          {presets.map((p, idx) => (
            <button
              key={p.key}
              onClick={() => handleSelect(p.key)}
              className={cn(
                "w-full text-left rounded-md px-3 py-2 text-xs font-medium transition-colors flex items-center gap-2",
                period === p.key
                  ? "bg-primary/10 text-primary"
                  : "text-foreground hover:bg-muted"
              )}
            >
              {!isMobile && idx < 10 && (
                <span className="text-xs text-muted-foreground font-mono w-4 shrink-0">
                  {indexToKey(idx)}
                </span>
              )}
              {p.label}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      {/* Calendar popover for custom range */}
      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild>
          <span />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={{ from: customRange.from, to: customRange.to }}
            onSelect={(range) => {
              onCustomRangeChange({ from: range?.from, to: range?.to });
              onPeriodChange("custom");
              if (range?.from && range?.to) {
                setCalendarOpen(false);
              }
            }}
            numberOfMonths={1}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
});

PeriodSelector.displayName = "PeriodSelector";

export default PeriodSelector;

/** Helper: get the start date for a given period key */
export const getStartDate = (period: PeriodKey, customFrom?: Date): Date | undefined => {
  const now = new Date();
  switch (period) {
    case "today": return startOfDay(now);
    case "week": return startOfDay(subDays(now, 7));
    case "month": return startOfDay(subMonths(now, 1));
    case "sixMonths": return startOfDay(subMonths(now, 6));
    case "all": return undefined;
    case "custom": return customFrom;
  }
};

export const getEndDate = (period: PeriodKey, customTo?: Date): Date | undefined => {
  if (period === "custom") return customTo;
  return undefined;
};

export const filterByPeriod = <T extends { transaction_date: string }>(
  items: T[],
  period: PeriodKey,
  customRange: DateRange
): T[] => {
  const start = getStartDate(period, customRange.from);
  const end = getEndDate(period, customRange.to);

  return items.filter((item) => {
    const d = parseISO(item.transaction_date);
    if (start && d < start) return false;
    if (end && d > end) return false;
    return true;
  });
};
