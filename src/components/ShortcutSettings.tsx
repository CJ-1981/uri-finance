import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { getShortcuts, saveShortcuts, ShortcutConfig } from "@/hooks/useKeyboardShortcut";
import { useI18n } from "@/hooks/useI18n";
import { toast } from "sonner";

type RecordingTarget = keyof ShortcutConfig;

interface ShortcutSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ShortcutSettings = ({ open, onOpenChange }: ShortcutSettingsProps) => {
  const { t } = useI18n();
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
    onOpenChange(false);
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("shortcut.title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pb-2 pt-4">
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

          <div className="border-t border-border/50 pt-3 space-y-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">{t("shortcut.openPeriod")}</label>
              {renderKeyButton("openPeriod", shortcuts.openPeriod)}
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">{t("shortcut.openCategory")}</label>
              {renderKeyButton("openCategory", shortcuts.openCategory)}
            </div>
          </div>

          <div className="border-t border-border/50 pt-3 space-y-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">{t("shortcut.nextTx")}</label>
              {renderKeyButton("nextTx", shortcuts.nextTx)}
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">{t("shortcut.prevTx")}</label>
              {renderKeyButton("prevTx", shortcuts.prevTx)}
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground">{t("shortcut.hint")}</p>

          <Button size="sm" onClick={handleSave} disabled={!!recordingKey} className="w-full">
            {t("shortcut.save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShortcutSettings;
