import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { PasswordChangeDialog } from "@/components/PasswordChangeDialog";
import { LogOut, KeyRound, Sun, Moon, Globe, Lock, LockOpen, Keyboard } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useTheme } from "next-themes";
import { isPinSet } from "@/lib/securePinStorage";
import PinSetupDialog from "@/components/PinSetupDialog";
import PinDisableDialog from "@/components/PinDisableDialog";
import ShortcutSettings from "@/components/ShortcutSettings";

export const UserMenu = () => {
  const { user, signOut, isStandalone } = useAuth();
  const { t, locale, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [pinDisableDialogOpen, setPinDisableDialogOpen] = useState(false);
  const [shortcutDialogOpen, setShortcutDialogOpen] = useState(false);
  const [hasPin, setHasPin] = useState(isPinSet());

  // Update pin state when dialogs close or components mount
  useEffect(() => {
    setHasPin(isPinSet());
  }, [pinDialogOpen, pinDisableDialogOpen]);

  const getUserInitials = () => {
    if (!user?.email) return "U";
    const email = user.email;
    const parts = email.split("@");
    if (parts.length > 0 && parts[0].length > 0) {
      return parts[0].charAt(0).toUpperCase();
    }
    return "U";
  };

  const toggleTheme = (e: React.MouseEvent) => {
    e.preventDefault();
    const newTheme = theme === "dark" ? "light" : "dark";
    const doc = document as Document & {
      startViewTransition?: (callback: () => void) => { finished: Promise<void> };
    };
    if (!doc.startViewTransition) {
      setTheme(newTheme);
      return;
    }
    doc.startViewTransition(() => {
      setTheme(newTheme);
    });
  };

  const toggleLocale = (e: React.MouseEvent) => {
    e.preventDefault();
    setLocale(locale === "en" ? "ko" : "en");
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground relative"
            data-testid="user-menu-trigger"
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                {getUserInitials()}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="px-2 py-1.5 text-sm">
            <p className="font-medium text-foreground truncate">{user?.email}</p>
          </div>
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={toggleTheme} className="cursor-pointer">
            {theme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
            <span>{theme === "dark" ? t("theme.light") || "Light Mode" : t("theme.dark") || "Dark Mode"}</span>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={toggleLocale} className="cursor-pointer">
            <Globe className="mr-2 h-4 w-4" />
            <span>{locale === "en" ? "한국어" : "English"}</span>
          </DropdownMenuItem>

          <DropdownMenuItem 
            onClick={(e) => {
              e.preventDefault();
              hasPin ? setPinDisableDialogOpen(true) : setPinDialogOpen(true);
            }} 
            className="cursor-pointer"
          >
            {hasPin ? <Lock className="mr-2 h-4 w-4" /> : <LockOpen className="mr-2 h-4 w-4" />}
            <span>{hasPin ? t("lock.disable") : t("lock.enable")}</span>
          </DropdownMenuItem>

          <DropdownMenuItem 
            onClick={(e) => {
              e.preventDefault();
              setShortcutDialogOpen(true);
            }} 
            className="cursor-pointer hidden md:flex"
          >
            <Keyboard className="mr-2 h-4 w-4" />
            <span>{t("shortcut.title")}</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {!isStandalone && (
            <>
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  setPasswordDialogOpen(true);
                }}
                className="cursor-pointer"
              >
                <KeyRound className="mr-2 h-4 w-4" />
                <span>{t("auth.changePassword")}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}

          <DropdownMenuItem
            onClick={(e) => {
              e.preventDefault();
              signOut();
            }}
            className="cursor-pointer text-destructive focus:text-destructive"
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span>{t("auth.signOut")}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <PasswordChangeDialog
        open={passwordDialogOpen}
        onOpenChange={setPasswordDialogOpen}
      />

      <PinSetupDialog 
        open={pinDialogOpen} 
        onOpenChange={setPinDialogOpen} 
        onComplete={() => setHasPin(true)} 
      />
      
      <PinDisableDialog 
        open={pinDisableDialogOpen} 
        onOpenChange={setPinDisableDialogOpen} 
        onDisableSuccess={() => setHasPin(false)} 
      />

      <ShortcutSettings 
        open={shortcutDialogOpen} 
        onOpenChange={setShortcutDialogOpen} 
      />
    </>
  );
};
