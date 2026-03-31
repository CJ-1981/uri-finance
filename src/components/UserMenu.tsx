import { useState } from "react";
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
import { LogOut, KeyRound } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export const UserMenu = () => {
  const { user, signOut } = useAuth();
  const { t } = useI18n();
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);

  const getUserInitials = () => {
    if (!user?.email) return "U";
    const email = user.email;
    const parts = email.split("@");
    if (parts.length > 0 && parts[0].length > 0) {
      return parts[0].charAt(0).toUpperCase();
    }
    return "U";
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
        <DropdownMenuContent align="end" className="w-48">
          <div className="px-2 py-1.5 text-sm">
            <p className="font-medium text-foreground truncate">{user?.email}</p>
          </div>
          <DropdownMenuSeparator />
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
          <DropdownMenuItem
            onClick={(e) => {
              e.preventDefault();
              signOut();
            }}
            className="cursor-pointer text-destructive"
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
    </>
  );
};
