import { useState, useEffect, useRef } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Keyboard } from "lucide-react";
import { getShortcuts, saveShortcuts } from "@/hooks/useKeyboardShortcut";
import { useI18n } from "@/hooks/useI18n";
import { toast } from "sonner";

const ShortcutSettings = () => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [addTxKey, setAddTxKey] = useState(() => getShortcuts().addTransaction);
  const [recording, setRecording] = useState(false);
  const inputRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!recording) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      if (e.key === "Escape") {
        setRecording(false);
        return;
      }
      // Only accept single printable keys
      if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        setAddTxKey(e.key.toLowerCase());
        setRecording(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [recording]);

  const handleSave = () => {
    saveShortcuts({ addTransaction: addTxKey });
    window.dispatchEvent(new Event("shortcut-updated"));
    toast.success(t("shortcut.saved"));
    setOpen(false);
  };

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
      <PopoverContent className="w-72" align="end">
        <div className="space-y-3">
          <h4 className="font-medium text-sm">{t("shortcut.title")}</h4>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">{t("shortcut.addTransaction")}</label>
            <div className="flex items-center gap-2">
              <button
                ref={inputRef}
                onClick={() => setRecording(true)}
                className={`flex-1 h-9 rounded-md border px-3 text-sm font-mono text-center transition-colors ${
                  recording
                    ? "border-primary bg-primary/5 text-primary animate-pulse"
                    : "border-input bg-muted/50 text-foreground"
                }`}
              >
                {recording ? t("shortcut.pressKey") : addTxKey.toUpperCase()}
              </button>
              <Button size="sm" onClick={handleSave} disabled={recording}>
                {t("shortcut.save")}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">{t("shortcut.hint")}</p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ShortcutSettings;
