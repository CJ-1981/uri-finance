import { useState, useCallback, useEffect } from "react";
import { useI18n } from "@/hooks/useI18n";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { verifyPin, clearPin } from "@/lib/securePinStorage";
import { toast } from "sonner";

interface PinDisableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDisableSuccess: () => void;
}

const PIN_LENGTH = 4;

/**
 * Dialog for verifying PIN before disabling app lock.
 * Requires users to enter their current PIN as a security measure.
 */
const PinDisableDialog = ({ open, onOpenChange, onDisableSuccess }: PinDisableDialogProps) => {
  const { t } = useI18n();
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const handleDigit = useCallback(async (digit: string) => {
    if (pin.length >= PIN_LENGTH || verifying) return;
    const next = pin + digit;
    setPin(next);
    setError(false);

    if (next.length === PIN_LENGTH) {
      setVerifying(true);
      try {
        const isValid = await verifyPin(next);
        if (isValid) {
          // PIN verified, clear it
          clearPin();
          toast.success(t("lock.disabledSuccess"));
          resetState();
          onDisableSuccess();
          onOpenChange(false);
        } else {
          setError(true);
          toast.error(t("lock.wrong"));
          setTimeout(() => {
            setPin("");
            setError(false);
          }, 600);
        }
      } catch (err) {
        console.error("Failed to verify PIN:", err);
        toast.error(t("lock.pinRemoveFailed"));
      } finally {
        setVerifying(false);
      }
    }
  }, [pin, verifying, t, onDisableSuccess, onOpenChange]);

  const handleDelete = useCallback(() => {
    if (verifying) return;
    setPin((p) => p.slice(0, -1));
    setError(false);
  }, [verifying]);

  const resetState = () => {
    setPin("");
    setError(false);
    setVerifying(false);
  };

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        handleDelete();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, handleDigit, handleDelete]);

  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetState();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>{t("lock.disableTitle")}</DialogTitle>
          <DialogDescription>
            {error
              ? t("lock.wrong")
              : t("lock.disableConfirm")}
          </DialogDescription>
        </DialogHeader>

        {/* Dots */}
        <div className="flex justify-center gap-3 py-4">
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <div
              key={i}
              className={`h-4 w-4 rounded-full border-2 transition-all ${
                error
                  ? "border-destructive bg-destructive"
                  : i < pin.length
                  ? "border-primary bg-primary"
                  : "border-muted-foreground/30"
              }`}
            />
          ))}
        </div>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-4 place-items-center">
          {digits.map((d, i) => {
            if (d === "") return <div key={i} />;
            if (d === "del")
              return (
                <button
                  key={i}
                  onPointerDown={handleDelete}
                  disabled={verifying}
                  tabIndex={-1}
                  style={{ touchAction: "manipulation" }}
                  className="flex h-20 w-20 items-center justify-center rounded-full text-sm text-muted-foreground hover:bg-muted transition-colors active:scale-90 transition-transform focus:outline-none disabled:opacity-50"
                >
                  ←
                </button>
              );
            return (
              <button
                key={i}
                onPointerDown={() => handleDigit(d)}
                disabled={verifying}
                tabIndex={-1}
                style={{ touchAction: "manipulation" }}
                className="flex h-20 w-20 items-center justify-center rounded-full bg-muted/50 text-lg font-semibold text-foreground hover:bg-muted transition-colors active:scale-90 transition-transform focus:outline-none disabled:opacity-50"
              >
                {d}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PinDisableDialog;
