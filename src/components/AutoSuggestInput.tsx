import { useState, useRef, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (val: string) => void;
  suggestions: string[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  inputMode?: "text" | "decimal";
  [key: `data-${string}`]: unknown;
}

const AutoSuggestInput = ({ value, onChange, suggestions, placeholder, disabled, className, inputMode, ...rest }: Props) => {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = useMemo(() => {
    if (!value.trim()) return [];
    const lower = value.toLowerCase();
    return suggestions
      .filter((s) => s.toLowerCase().includes(lower))
      .slice(0, 8);
  }, [value, suggestions]);

  const showDropdown = open && filtered.length > 0 && value.trim().length > 0;

  useEffect(() => {
    setActiveIdx(-1);
  }, [filtered]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const select = (val: string) => {
    onChange(val);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      select(filtered[activeIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (activeIdx >= 0 && listRef.current) {
      const el = listRef.current.children[activeIdx] as HTMLElement;
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIdx]);

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
        inputMode={inputMode}
        autoComplete="off"
        {...rest}
      />
      {showDropdown && (
        <ul
          ref={listRef}
          className="absolute z-50 mt-1 w-full max-h-40 overflow-y-auto rounded-md border border-border bg-popover shadow-md"
        >
          {filtered.map((item, i) => {
            // Highlight the matching portion
            const lower = item.toLowerCase();
            const matchIdx = lower.indexOf(value.toLowerCase());
            const before = item.slice(0, matchIdx);
            const match = item.slice(matchIdx, matchIdx + value.length);
            const after = item.slice(matchIdx + value.length);

            return (
              <li
                key={item + i}
                onMouseDown={() => select(item)}
                className={cn(
                  "px-3 py-1.5 text-sm cursor-pointer transition-colors",
                  i === activeIdx
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-muted text-foreground"
                )}
              >
                {matchIdx >= 0 ? (
                  <>
                    {before}
                    <span className="font-semibold text-primary">{match}</span>
                    {after}
                  </>
                ) : (
                  item
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default AutoSuggestInput;
