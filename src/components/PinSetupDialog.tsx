import { useState } from "react";
import { useI18n } from "@/hooks/useI18n";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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

  const handleDigit = (digit: string) => {
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
  };

  const handleDelete = () => {
    setCurrentPin((p) => p.slice(0, -1));
    setError(false);
  };

  const resetState = () => {
    setPin("");
    setConfirmPin("");
    setStep("enter");
    setError(false);
  };

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
        <div className="grid grid-cols-3 gap-2 place-items-center">
          {digits.map((d, i) => {
            if (d === "") return <div key={i} />;
            if (d === "del")
              return (
                <button
                  key={i}
                  onClick={handleDelete}
                  className="flex h-12 w-12 items-center justify-center rounded-full text-sm text-muted-foreground hover:bg-muted transition-colors"
                >
                  ←
                </button>
              );
            return (
              <button
                key={i}
                onClick={() => handleDigit(d)}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50 text-lg font-semibold text-foreground hover:bg-muted transition-colors active:scale-95"
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
