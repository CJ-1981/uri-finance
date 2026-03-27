import { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/hooks/useI18n";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface PinSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

const PIN_LENGTH = 4;

import { storePin } from "@/lib/securePinStorage";

const PinSetupDialog = ({ open, onOpenChange, onComplete }: PinSetupDialogProps) => {
  const { t } = useI18n();
  const [step, setStep] = useState<"enter" | "confirm">("enter");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState(false);

  const currentPin = step === "enter" ? pin : confirmPin;
  const setCurrentPin = step === "enter" ? setPin : setConfirmPin;

  const handleDigit = useCallback((digit: string) => {
    if (currentPin.length >= PIN_LENGTH) return;
    const next = currentPin + digit;
    setCurrentPin(next);
    setError(false);

    if (step === "enter" && next.length === PIN_LENGTH) {
      setTimeout(() => setStep("confirm"), 300);
    }

    if (step === "confirm" && next.length === PIN_LENGTH) {
      if (next === pin) {
        storePin(next).then(() => {
          toast.success(t("lock.pinSet"));
          resetState();
          onComplete();
          onOpenChange(false);
        }).catch((err) => {
          console.error(err);
          toast.error(t("pinSetup.failedToSetPinSecurely"));
        });
      } else {
        setError(true);
        setTimeout(() => {
          setConfirmPin("");
          setStep("enter");
          setPin("");
          setError(false);
        }, 600);
      }
    }
  }, [currentPin, step, pin, t, onComplete, onOpenChange]); // Exhaustive dependencies

  const handleDelete = useCallback(() => {
    setCurrentPin((p) => p.slice(0, -1));
    setError(false);
  }, [setCurrentPin]);

  const resetState = () => {
    setPin("");
    setConfirmPin("");
    setStep("enter");
    setError(false);
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
      <DialogContent className="max-w-xs" data-testid="pin-setup-dialog">
        <DialogHeader>
          <DialogTitle>{t("lock.setupTitle")}</DialogTitle>
          <DialogDescription>
            {error
              ? t("lock.mismatch")
              : step === "enter"
              ? t("lock.setupEnter")
              : t("lock.setupConfirm")}
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
                  : i < currentPin.length
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
                  tabIndex={-1}
                  style={{ touchAction: "manipulation" }}
                  className="flex h-20 w-20 items-center justify-center rounded-full text-sm text-muted-foreground hover:bg-muted transition-colors active:scale-90 transition-transform focus:outline-none"
                >
                  ←
                </button>
              );
            return (
              <button
                key={i}
                onPointerDown={() => handleDigit(d)}
                tabIndex={-1}
                style={{ touchAction: "manipulation" }}
                className="flex h-20 w-20 items-center justify-center rounded-full bg-muted/50 text-lg font-semibold text-foreground hover:bg-muted transition-colors active:scale-90 transition-transform focus:outline-none"
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

export default PinSetupDialog;
