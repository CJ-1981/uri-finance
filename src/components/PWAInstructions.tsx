import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

export const PWAInstructions = () => {
  const { isStandalone } = useAuth();
  const { t } = useI18n();
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Check if app is already running in standalone mode
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    
    // Only show if in standalone mode AND NOT already running as PWA
    if (isStandalone && !isPWA) {
      // Check if user has dismissed it before in this session
      const dismissed = sessionStorage.getItem("pwa_instructions_dismissed");
      if (!dismissed) {
        setShow(true);
      }
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, [isStandalone]);

  const handleDismiss = () => {
    setShow(false);
    sessionStorage.setItem("pwa_instructions_dismissed", "true");
  };

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User response to the install prompt: ${outcome}`);
      setDeferredPrompt(null);
      setShow(false);
    } else {
      // For iOS or browsers where beforeinstallprompt is not supported, 
      // we just show a generic alert or instructions could be expanded here.
      alert(t("pwa.installDesc"));
    }
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="glass-card p-4 flex flex-col gap-3 border-primary/20 bg-primary/5 shadow-lg">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Download className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">{t("pwa.installTitle")}</h3>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {t("pwa.installDesc")}
              </p>
            </div>
          </div>
          <button 
            onClick={handleDismiss}
            className="p-1 hover:bg-muted rounded-full transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <Button 
          size="sm" 
          className="w-full gradient-primary text-xs font-semibold"
          onClick={handleInstall}
        >
          {t("pwa.installBtn")}
        </Button>
      </div>
    </div>
  );
};
