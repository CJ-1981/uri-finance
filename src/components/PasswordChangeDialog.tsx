import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";

interface PasswordChangeDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const PasswordChangeDialog = ({ open: controlledOpen, onOpenChange }: PasswordChangeDialogProps = {}) => {
  const { t } = useI18n();
  const { user, signIn, updatePassword } = useAuth();
  const [internalOpen, setInternalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setIsOpen = onOpenChange || setInternalOpen;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword) {
      toast.error(t("auth.currentPasswordRequired"));
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error(t("auth.passwordMismatch"));
      return;
    }

    if (newPassword.length < 6) {
      toast.error(t("auth.passwordTooShort"));
      return;
    }

    if (!user?.email) {
      toast.error("User email not found");
      return;
    }

    setSubmitting(true);

    // First verify current password is correct
    const { error: signInError } = await signIn(user.email, currentPassword);
    if (signInError) {
      setSubmitting(false);
      toast.error(t("auth.wrongCurrentPassword"));
      return;
    }

    // Current password is correct, now update to new password
    const { error } = await updatePassword(newPassword);
    setSubmitting(false);

    if (error) {
      toast.error(t("auth.updatePasswordError"));
      console.error("Update password error:", error);
    } else {
      toast.success(t("auth.updatePasswordSuccess"));
      setIsOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  // If controlled, render without DialogTrigger
  if (isControlled) {
    return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("auth.changePassword")}</DialogTitle>
            <DialogDescription>
              {t("auth.passwordGuideline")}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password" className="text-sm">
                {t("auth.currentPassword")}
              </Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="bg-muted/50 border-border/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password" className="text-sm">
                {t("auth.newPassword")}
              </Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                autoComplete="new-password"
                className="bg-muted/50 border-border/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-sm">
                {t("auth.confirmPassword")}
              </Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                autoComplete="new-password"
                className="bg-muted/50 border-border/50"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
                disabled={submitting}
              >
                {t("tx.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="gradient-primary text-primary-foreground hover:opacity-90 transition-opacity"
              >
                {submitting ? t("auth.submitting") : t("auth.updatePassword")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    );
  }

  // Default mode: with trigger button
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <KeyRound className="h-4 w-4" />
          {t("auth.changePassword")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("auth.changePassword")}</DialogTitle>
          <DialogDescription>
            {t("auth.passwordGuideline")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password" className="text-sm">
              {t("auth.currentPassword")}
            </Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className="bg-muted/50 border-border/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password" className="text-sm">
              {t("auth.newPassword")}
            </Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              autoComplete="new-password"
              className="bg-muted/50 border-border/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password" className="text-sm">
              {t("auth.confirmPassword")}
            </Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              autoComplete="new-password"
              className="bg-muted/50 border-border/50"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={submitting}
            >
              {t("tx.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="gradient-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              {submitting ? t("auth.submitting") : t("auth.updatePassword")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
