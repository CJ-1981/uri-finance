import { useState, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Keyboard, X } from "lucide-react";
import { getShortcuts, saveShortcuts, ShortcutConfig } from "@/hooks/useKeyboardShortcut";
import { useI18n } from "@/hooks/useI18n";
import { toast } from "sonner";

type RecordingTarget = keyof ShortcutConfig;

const ShortcutSettings = () => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [shortcuts, setShortcuts] = useState<ShortcutConfig>(getShortcuts);
  const [recordingKey, setRecordingKey] = useState<RecordingTarget | null>(null);

  useEffect(() => {
    if (!recordingKey) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      if (e.key === "Escape") {
        setRecordingKey(null);
        return;
      }
      if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        setShortcuts((prev) => ({ ...prev, [recordingKey]: e.key.toLowerCase() }));
        setRecordingKey(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [recordingKey]);

  const handleSave = () => {
    saveShortcuts(shortcuts);
    window.dispatchEvent(new Event("shortcut-updated"));
    toast.success(t("shortcut.saved"));
    setOpen(false);
  };

  const renderKeyButton = (target: RecordingTarget, value: string) => (
    <div className="flex gap-1">
      <button
        onClick={() => setRecordingKey(target)}
        className={`flex-1 h-9 rounded-md border px-3 text-sm font-mono text-center transition-colors ${
          recordingKey === target
            ? "border-primary bg-primary/5 text-primary animate-pulse"
            : "border-input bg-muted/50 text-foreground"
        }`}
      >
        {recordingKey === target
          ? t("shortcut.pressKey")
          : value
            ? value.toUpperCase()
            : t("shortcut.clickToSet")}
      </button>
      {value && (
        <button
          onClick={() => setShortcuts((prev) => ({ ...prev, [target]: "" }))}
          className="h-9 w-9 rounded-md border border-input bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground hidden md:inline-flex"
          title={t("shortcut.title")}
        >
          <Keyboard className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <h4 className="font-medium text-sm">{t("shortcut.title")}</h4>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">{t("shortcut.addTransaction")}</label>
            {renderKeyButton("addTransaction", shortcuts.addTransaction)}
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">{t("shortcut.addTransactionAlt")}</label>
            {renderKeyButton("addTransactionAlt", shortcuts.addTransactionAlt)}
          </div>

          <div className="border-t border-border/50 pt-3 space-y-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">{t("shortcut.tabList")}</label>
              {renderKeyButton("tabList", shortcuts.tabList)}
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">{t("shortcut.tabCharts")}</label>
              {renderKeyButton("tabCharts", shortcuts.tabCharts)}
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">{t("shortcut.tabCash")}</label>
              {renderKeyButton("tabCash", shortcuts.tabCash)}
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground">{t("shortcut.hint")}</p>

          <Button size="sm" onClick={handleSave} disabled={!!recordingKey} className="w-full">
            {t("shortcut.save")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ShortcutSettings;
