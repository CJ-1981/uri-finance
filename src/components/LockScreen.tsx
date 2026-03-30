import { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/hooks/useI18n";
import { Lock, ShieldAlert } from "lucide-react";
import {
  verifyPin,
  loadLockState,
  saveLockState,
} from "@/lib/securePinStorage";

interface LockScreenProps {
  onUnlock: () => void;
}

const PIN_LENGTH = 4;
const MAX_FREE_ATTEMPTS = 3;

const getBlockDuration = (failCount: number): number => {
  // After 3 free attempts: 15s, 30s, 60s, 120s, 300s...
  const extra = failCount - MAX_FREE_ATTEMPTS;
  if (extra <= 0) return 0;
  return Math.min(15 * Math.pow(2, extra - 1), 600) * 1000;
};

const LockScreen = ({ onUnlock }: LockScreenProps) => {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [lockState, setLockState] = useState(loadLockState);
  const [remainingMs, setRemainingMs] = useState(() => {
    const initial = loadLockState();
    const diff = initial.blockedUntil - Date.now();
    return diff > 0 ? diff : 0;
  });
  const { t } = useI18n();

  const isBlocked = remainingMs > 0;

  // Countdown timer
  useEffect(() => {
    const tick = () => {
      const diff = lockState.blockedUntil - Date.now();
      setRemainingMs(diff > 0 ? diff : 0);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockState.blockedUntil]);

  const handleDigit = useCallback(
    (digit: string) => {
      // Eagerly check block status against persistent state to prevent refresh bypass
      if (Date.now() < lockState.blockedUntil) {
        setPin(""); // Clear any attempted entries while blocked
        return;
      }
      if (pin.length >= PIN_LENGTH) return;
      const next = pin + digit;
      setPin(next);
      setError(false);

      if (next.length === PIN_LENGTH) {
        verifyPin(next).then((isValid) => {
          if (isValid) {
            // Reset on success
            const cleared = { failCount: 0, blockedUntil: 0 };
            saveLockState(cleared);
            setLockState(cleared);
            onUnlock();
          } else {
            const newCount = lockState.failCount + 1;
            const blockMs = getBlockDuration(newCount);
            const newState = {
              failCount: newCount,
              blockedUntil: blockMs > 0 ? Date.now() + blockMs : 0,
            };
            saveLockState(newState);
            setLockState(newState);
            setError(true);
            setTimeout(() => setPin(""), 400);
          }
        });
      }
    },
    [pin, onUnlock, lockState.failCount, lockState.blockedUntil]
  );

  const handleDelete = () => {
    if (isBlocked) return;
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

  const formatTime = (ms: number) => {
    const s = Math.ceil(ms / 1000);
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return min > 0 ? `${min}:${sec.toString().padStart(2, "0")}` : `${sec}s`;
  };

  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

  const statusMessage = isBlocked
    ? `${t("lock.blocked")} ${formatTime(remainingMs)}`
    : error
    ? lockState.failCount >= MAX_FREE_ATTEMPTS
      ? t("lock.wrong")
      : `${t("lock.wrong")} (${lockState.failCount}/${MAX_FREE_ATTEMPTS})`
    : t("lock.enter");

  return (
    <div className={`fixed inset-0 z-[100] flex flex-col items-center justify-center transition-colors duration-300 ${error || isBlocked ? "bg-destructive/10" : "bg-background"}`}>
      <div className="flex flex-col items-center gap-6 animate-fade-in">
        <div className={`flex h-16 w-16 items-center justify-center rounded-2xl transition-all duration-300 ${error || isBlocked ? "bg-destructive/20 animate-pulse-red" : "bg-primary/10"}`}>
          {isBlocked ? (
            <ShieldAlert className="h-8 w-8 text-destructive" />
          ) : (
            <Lock className={`h-8 w-8 transition-colors duration-300 ${error ? "text-destructive" : "text-primary"}`} />
          )}
        </div>

        <div className="text-center">
          <h1 className="text-xl font-bold text-foreground">{t("lock.title")}</h1>
          <p className={`mt-1 text-sm transition-colors duration-200 ${error || isBlocked ? "text-destructive font-medium" : "text-muted-foreground"}`}>
            {statusMessage}
          </p>
        </div>

        {/* PIN dots */}
        <div className={`flex gap-3 ${error ? "animate-shake-hard" : ""}`}>
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <div
              key={i}
              className={`h-4 w-4 rounded-full border-2 transition-all duration-200 ${
                error
                  ? "border-destructive bg-destructive animate-dot-pop"
                  : i < pin.length
                  ? "border-primary bg-primary animate-dot-pop"
                  : isBlocked
                  ? "border-muted-foreground/10 bg-transparent"
                  : "border-muted-foreground/30 bg-transparent"
              }`}
              style={error ? { animationDelay: `${i * 60}ms` } : undefined}
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
                  disabled={isBlocked}
                  tabIndex={-1}
                  style={{ touchAction: "manipulation" }}
                  className="flex h-20 w-20 items-center justify-center rounded-full text-sm text-muted-foreground hover:bg-muted transition-colors active:scale-90 transition-transform disabled:opacity-30 disabled:pointer-events-none focus:outline-none"
                >
                  ←
                </button>
              );
            return (
              <button
                key={i}
                onPointerDown={() => handleDigit(d)}
                disabled={isBlocked}
                tabIndex={-1}
                style={{ touchAction: "manipulation" }}
                className="flex h-20 w-20 items-center justify-center rounded-full bg-muted/50 text-lg font-semibold text-foreground hover:bg-muted transition-colors active:scale-90 transition-transform disabled:opacity-30 disabled:pointer-events-none focus:outline-none"
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
