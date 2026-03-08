import { useState, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Keyboard } from "lucide-react";
import { getShortcuts, saveShortcuts, SHORTCUT_LABELS, ShortcutConfig } from "@/hooks/useKeyboardShortcut";
import { useI18n } from "@/hooks/useI18n";
import { toast } from "sonner";

const ShortcutSettings = () => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [shortcuts, setShortcuts] = useState<ShortcutConfig>(getShortcuts);
  const [recordingKey, setRecordingKey] = useState<keyof ShortcutConfig | null>(null);

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

  const entries = Object.entries(SHORTCUT_LABELS) as [keyof ShortcutConfig, string][];

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

          {entries.map(([action, labelKey]) => (
            <div key={action} className="space-y-1">
              <label className="text-xs text-muted-foreground">{t(labelKey)}</label>
              <button
                onClick={() => setRecordingKey(action)}
                className={`w-full h-9 rounded-md border px-3 text-sm font-mono text-center transition-colors ${
                  recordingKey === action
                    ? "border-primary bg-primary/5 text-primary animate-pulse"
                    : "border-input bg-muted/50 text-foreground"
                }`}
              >
                {recordingKey === action ? t("shortcut.pressKey") : (shortcuts[action as keyof ShortcutConfig] as string).toUpperCase()}
              </button>
            </div>
          ))}

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
