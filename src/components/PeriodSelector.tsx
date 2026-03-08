import { useState, useMemo } from "react";
import { startOfDay, subDays, subMonths, format, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useI18n } from "@/hooks/useI18n";

export type PeriodKey = "today" | "week" | "month" | "sixMonths" | "all" | "custom";

export interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

interface Props {
  period: PeriodKey;
  onPeriodChange: (p: PeriodKey) => void;
  customRange: DateRange;
  onCustomRangeChange: (r: DateRange) => void;
}

const PeriodSelector = ({ period, onPeriodChange, customRange, onCustomRangeChange }: Props) => {
  const { t } = useI18n();
  const [calendarOpen, setCalendarOpen] = useState(false);

  const presets: { key: PeriodKey; label: string }[] = [
    { key: "today", label: t("period.today") },
    { key: "week", label: t("period.week") },
    { key: "month", label: t("period.month") },
    { key: "sixMonths", label: t("period.sixMonths") },
    { key: "all", label: t("period.all") },
    { key: "custom", label: t("period.custom") },
  ];

  const handlePreset = (key: PeriodKey) => {
    if (key === "custom") {
      setCalendarOpen(true);
    }
    onPeriodChange(key);
  };

  const customLabel = useMemo(() => {
    if (period !== "custom") return t("period.custom");
    const from = customRange.from ? format(customRange.from, "MMM d") : "…";
    const to = customRange.to ? format(customRange.to, "MMM d") : "…";
    return `${from} – ${to}`;
  }, [period, customRange, t]);

  return (
    <div className="flex flex-wrap gap-1.5">
      {presets.map((p) => {
        if (p.key === "custom") {
          return (
            <Popover key="custom" open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <button
                  onClick={() => handlePreset("custom")}
                  className={cn(
                    "flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                    period === "custom"
                      ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                      : "bg-muted/30 text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="h-3 w-3" />
                  {customLabel}
                </button>
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
          );
        }

        return (
          <button
            key={p.key}
            onClick={() => handlePreset(p.key)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
              period === p.key
                ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                : "bg-muted/30 text-muted-foreground"
            )}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
};

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
  return undefined; // up to today for presets
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
