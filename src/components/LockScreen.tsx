import { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/hooks/useI18n";
import { Lock, Delete, Fingerprint } from "lucide-react";

interface LockScreenProps {
  onUnlock: () => void;
}

const PIN_LENGTH = 4;

const LockScreen = ({ onUnlock }: LockScreenProps) => {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const { t } = useI18n();

  const storedHash = localStorage.getItem("app_lock_pin");

  const hashPin = async (value: string) => {
    const encoded = new TextEncoder().encode(value);
    const buffer = await crypto.subtle.digest("SHA-256", encoded);
    return Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  };

  const handleDigit = useCallback(
    (digit: string) => {
      if (pin.length >= PIN_LENGTH) return;
      const next = pin + digit;
      setPin(next);
      setError(false);

      if (next.length === PIN_LENGTH) {
        hashPin(next).then((hash) => {
          if (hash === storedHash) {
            onUnlock();
          } else {
            setError(true);
            setTimeout(() => setPin(""), 400);
          }
        });
      }
    },
    [pin, storedHash, onUnlock]
  );

  const handleDelete = () => {
    setPin((p) => p.slice(0, -1));
    setError(false);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) handleDigit(e.key);
      if (e.key === "Backspace") handleDelete();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleDigit]);

  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-8 animate-fade-in">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Lock className="h-8 w-8 text-primary" />
        </div>

        <div className="text-center">
          <h1 className="text-xl font-bold text-foreground">{t("lock.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {error ? t("lock.wrong") : t("lock.enter")}
          </p>
        </div>

        {/* PIN dots */}
        <div className="flex gap-3">
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <div
              key={i}
              className={`h-4 w-4 rounded-full border-2 transition-all duration-200 ${
                error
                  ? "border-destructive bg-destructive"
                  : i < pin.length
                  ? "border-primary bg-primary"
                  : "border-muted-foreground/30 bg-transparent"
              } ${error ? "animate-shake" : ""}`}
            />
          ))}
        </div>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3">
          {digits.map((d, i) => {
            if (d === "") return <div key={i} />;
            if (d === "del")
              return (
                <button
                  key={i}
                  onClick={handleDelete}
                  className="flex h-16 w-16 items-center justify-center rounded-full text-muted-foreground hover:bg-muted transition-colors"
                >
                  <Delete className="h-5 w-5" />
                </button>
              );
            return (
              <button
                key={i}
                onClick={() => handleDigit(d)}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/50 text-xl font-semibold text-foreground hover:bg-muted transition-colors active:scale-95"
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default LockScreen;
