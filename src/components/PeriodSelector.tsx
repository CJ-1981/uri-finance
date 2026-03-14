import { useState, useMemo, useCallback, useImperativeHandle, forwardRef, useRef, useEffect } from "react";
import { startOfDay, subDays, subMonths, format, parseISO } from "date-fns";
import { CalendarIcon, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useI18n } from "@/hooks/useI18n";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";

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
  const [selectingStart, setSelectingStart] = useState(true);
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [displayedYear, setDisplayedYear] = useState(new Date().getFullYear());
  const [displayedMonth, setDisplayedMonth] = useState(new Date());
  const isMobile = useIsMobile();
  const triggerRef = useRef<HTMLButtonElement>(null);

  const monthNames = useMemo(() => [
    t("calendar.january"),
    t("calendar.february"),
    t("calendar.march"),
    t("calendar.april"),
    t("calendar.may"),
    t("calendar.june"),
    t("calendar.july"),
    t("calendar.august"),
    t("calendar.september"),
    t("calendar.october"),
    t("calendar.november"),
    t("calendar.december"),
  ], [t]);

  // Update displayedYear, displayedMonth, and reset pickers when calendar opens
  useEffect(() => {
    if (calendarOpen) {
      const date = selectingStart ? customRange.from : customRange.to;
      const year = date?.getFullYear() || new Date().getFullYear();
      setDisplayedYear(year);
      setDisplayedMonth(date || new Date());
      setShowYearPicker(false);
      setShowMonthPicker(false);
    }
  }, [calendarOpen, selectingStart, customRange.from, customRange.to]);

  // Expose open method via ref
  useImperativeHandle(ref, () => ({
    open: () => {
      setMenuOpen(true);
      triggerRef.current?.focus();
    },
  }), []);

  const presets: { key: PeriodKey; label: string }[] = useMemo(() => [
    { key: "today", label: t("period.today") },
    { key: "week", label: t("period.week") },
    { key: "month", label: t("period.month") },
    { key: "sixMonths", label: t("period.sixMonths") },
    { key: "all", label: t("period.all") },
    { key: "custom", label: t("period.custom") },
  ], [t]);

  const activeLabel = useMemo(() => {
    // Check if it's a predefined period (not custom)
    if (period !== "custom") {
      return presets.find((p) => p.key === period)?.label || t("period.all");
    }
    // For custom period, always show the custom preset label
    return presets.find((p) => p.key === "custom")?.label || t("period.custom");
  }, [period, presets, t]);

  const startDateLabel = useMemo(() => {
    if (customRange.from) {
      return format(customRange.from, "MMM d");
    }
    return t("period.start");
  }, [customRange.from, t]);

  const endDateLabel = useMemo(() => {
    if (customRange.to) {
      return format(customRange.to, "MMM d");
    }
    return t("period.end");
  }, [customRange.to, t]);

  const handleSelect = (key: PeriodKey) => {
    if (key === "custom") {
      setMenuOpen(false);
      setCalendarOpen(true);
      onPeriodChange("custom");
      setSelectingStart(!customRange.from);
    } else {
      onPeriodChange(key);
      onCustomRangeChange({ from: undefined, to: undefined });
      setMenuOpen(false);
    }
  };

  const handleStartDateClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setCalendarOpen(true);
    setMenuOpen(false);
    setSelectingStart(true);
  }, []);

  const handleEndDateClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setCalendarOpen(true);
    setMenuOpen(false);
    setSelectingStart(false);
  }, []);

  const handleMenuClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen((prev) => !prev);
  }, []);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuOpen, presets, isMobile]);

  return (
    <div className="flex items-center gap-2">
      {/* Main period dropdown */}
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <button ref={triggerRef} onKeyDown={handleKeyDown} onClick={handleMenuClick} className="flex items-center gap-1.5 rounded-lg bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer">
            <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium">{activeLabel}</span>
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

      {/* Separate start/end date buttons for custom range */}
      {period === "custom" && (
        <div className="flex items-center gap-2">
          <Button
            variant={selectingStart ? "default" : "outline"}
            size="sm"
            onClick={handleStartDateClick}
            className="text-xs h-7 px-2"
          >
            {startDateLabel}
          </Button>
          <span className="text-muted-foreground text-xs">–</span>
          <Button
            variant={!selectingStart ? "default" : "outline"}
            size="sm"
            onClick={handleEndDateClick}
            className="text-xs h-7 px-2"
          >
            {endDateLabel}
          </Button>
        </div>
      )}

      {/* Calendar popover for custom range */}
      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild>
          <span />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-3 pb-2 border-b flex items-center justify-between">
            <div className="text-xs font-medium text-foreground">
              {selectingStart ? t("period.selectStart") : t("period.selectEnd")}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const today = startOfDay(new Date());
                if (selectingStart) {
                  onCustomRangeChange({ from: today, to: customRange.to });
                } else {
                  onCustomRangeChange({ from: customRange.from, to: today });
                }
                if (customRange.from || !selectingStart) {
                  setCalendarOpen(false);
                }
                onPeriodChange("custom");
              }}
              className="text-xs h-6 px-2"
            >
              {t("period.today")}
            </Button>
          </div>
          {showYearPicker ? (
            <div className="p-3">
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: 12 }, (_, i) => {
                  const year = displayedYear - 6 + i;
                  const isSelected = (selectingStart ? customRange.from : customRange.to)?.getFullYear() === year;
                  return (
                    <button
                      key={year}
                      onClick={() => {
                        const selectedDate = selectingStart ? customRange.from : customRange.to;
                        const newDate = selectedDate ? new Date(selectedDate) : new Date();
                        newDate.setFullYear(year);
                        if (selectingStart) {
                          onCustomRangeChange({ from: newDate, to: customRange.to });
                        } else {
                          onCustomRangeChange({ from: customRange.from, to: newDate });
                        }
                        setShowYearPicker(false);
                        setDisplayedMonth(newDate);
                        onPeriodChange("custom");
                      }}
                      className={cn(
                        "h-9 text-sm rounded-md transition-colors",
                        isSelected
                          ? "bg-primary text-primary-foreground hover:bg-primary/90"
                          : "hover:bg-muted"
                      )}
                    >
                      {year}
                    </button>
                  );
                })}
              </div>
              <div className="flex justify-between mt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDisplayedYear(displayedYear - 12)}
                  className="h-7 px-2 text-xs"
                >
                  ← Earlier
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDisplayedYear(displayedYear + 12)}
                  className="h-7 px-2 text-xs"
                >
                  Later →
                </Button>
              </div>
            </div>
          ) : showMonthPicker ? (
            <div className="p-3">
              <div className="grid grid-cols-3 gap-2">
                {monthNames.map((monthName, index) => {
                  const isSelected = displayedMonth.getMonth() === index;
                  return (
                    <button
                      key={monthName}
                      onClick={() => {
                        const selectedDate = selectingStart ? customRange.from : customRange.to;
                        const newDate = selectedDate ? new Date(selectedDate) : new Date();
                        newDate.setMonth(index);
                        newDate.setFullYear(displayedYear);
                        if (selectingStart) {
                          onCustomRangeChange({ from: newDate, to: customRange.to });
                        } else {
                          onCustomRangeChange({ from: customRange.from, to: newDate });
                        }
                        setShowMonthPicker(false);
                        setDisplayedMonth(newDate);
                        onPeriodChange("custom");
                      }}
                      className={cn(
                        "h-9 text-sm rounded-md transition-colors",
                        isSelected
                          ? "bg-primary text-primary-foreground hover:bg-primary/90"
                          : "hover:bg-muted"
                      )}
                    >
                      {monthName}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <Calendar
              mode="single"
              selected={selectingStart ? customRange.from : customRange.to}
              onSelect={(date) => {
                if (selectingStart) {
                  onCustomRangeChange({ from: date, to: customRange.to });
                  if (date) {
                    setSelectingStart(false);
                  }
                } else {
                  onCustomRangeChange({ from: customRange.from, to: date });
                  if (date && customRange.from) {
                    setCalendarOpen(false);
                  }
                }
                onPeriodChange("custom");
              }}
              disabled={(date) => {
                // Disable dates before start date when selecting end date
                if (!selectingStart && customRange.from) {
                  return date < customRange.from;
                }
                return false;
              }}
              defaultMonth={selectingStart ? customRange.from : customRange.to}
              onMonthChange={(month) => setDisplayedMonth(month)}
              numberOfMonths={1}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
              classNames={{
                caption: "flex justify-center pt-1 relative items-center",
                caption_label: "text-sm font-medium",
              }}
              components={{
                CaptionLabel: () => {
                  const year = (selectingStart ? customRange.from : customRange.to)?.getFullYear() || new Date().getFullYear();
                  const monthName = format(displayedMonth, "MMMM");
                  return (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setShowMonthPicker(true);
                        }}
                        className="text-sm font-medium hover:underline cursor-pointer"
                      >
                        {monthName}
                      </button>
                      <button
                        onClick={() => {
                          setDisplayedYear(year);
                          setShowYearPicker(true);
                        }}
                        className="text-sm font-medium hover:underline cursor-pointer"
                      >
                        {year}
                      </button>
                    </div>
                  );
                },
              }}
            />
          )}
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
