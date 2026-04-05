import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/hooks/useI18n";

const Auth = () => {
  const { user, loading } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [isPasswordReset, setIsPasswordReset] = useState(false);
  
  const [authError, setAuthError] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error_description') || params.get('error');
    if (error) {
      // Clear URL params to avoid re-showing error on manual refresh
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    return error;
  });

  // Detect if we are in recovery mode via URL or sessionStorage flag (preserved from AuthCallback)
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(() => {
    const hasUrlFlag = window.location.hash.includes("type=recovery") || 
                       window.location.search.includes("type=recovery");
    const hasStorageFlag = sessionStorage.getItem("auth_recovery") === "1";
    
    if (hasStorageFlag) {
      sessionStorage.removeItem("auth_recovery");
      return true;
    }
    return hasUrlFlag;
  });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { signIn, signUp, resetPassword, updatePassword, enableStandaloneMode } = useAuth();
  const { t, locale, setLocale } = useI18n();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">{t("auth.loading")}</div>
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;

  const handleStandalone = () => {
    localStorage.removeItem("pending_invite_code");
    enableStandaloneMode();
    toast.success(t("auth.standaloneMode"));
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const { error } = await resetPassword(email);
    setSubmitting(false);

    if (error) {
      const isRateLimit = error.message?.toLowerCase().includes("rate limit") || 
                          (error as any)?.status === 429;
      toast.error(isRateLimit ? t("auth.rateLimitError") || "Too many requests. Please wait a while before trying again." : t("auth.resetPasswordError"));
      console.error("Password reset error:", error);
    } else {
      toast.success(t("auth.resetPasswordSent"));
      setIsPasswordReset(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error(t("auth.passwordMismatch"));
      return;
    }

    if (newPassword.length < 6) {
      toast.error(t("auth.passwordTooShort") || "Password must be at least 6 characters");
      return;
    }

    setSubmitting(true);

    const { error } = await updatePassword(newPassword);
    setSubmitting(false);

    if (error) {
      toast.error(t("auth.updatePasswordError"));
      console.error("Update password error:", error);
    } else {
      toast.success(t("auth.updatePasswordSuccess"));
      setNewPassword("");
      setConfirmPassword("");
      setIsUpdatingPassword(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Manual validation to avoid default browser tooltips
    if (!email.trim()) {
      toast.error(t("auth.emailRequired") || "Email is required");
      return;
    }
    if (!password) {
      toast.error(t("auth.passwordRequired") || "Password is required");
      return;
    }

    if (!isLogin) {
      if (password.length < 6) {
        toast.error(t("auth.passwordTooShort") || "Password must be at least 6 characters");
        return;
      }
      if (password !== confirmPassword) {
        toast.error(t("auth.passwordMismatch"));
        return;
      }
    }

    setSubmitting(true);

    if (isLogin) {
      console.log("Attempting login for:", email);
      const { error } = await signIn(email, password);
      setSubmitting(false);
      if (error) {
        console.error("Login error:", error);
        toast.error(error.message || "Login failed");
      } else {
        console.log("Login successful");
      }
    } else {
      // Store invite code for later joining (after authentication)
      if (inviteCode.trim()) {
        localStorage.setItem("pending_invite_code", inviteCode.trim());
      }

      // Create account
      const { error } = await signUp(email, password);
      setSubmitting(false);
      if (error) {
        // Don't clear pending invite code - keep it for use after login
        // Check if error is about user already existing
        const errorMessage = error.message || "";
        if (errorMessage.includes("already registered") ||
            errorMessage.includes("already exists") ||
            errorMessage.includes("User already")) {
          toast.error(t("auth.userExists"));
        } else {
          toast.error(error.message);
        }
        return;
      }

      toast.success(t("auth.accountCreated"));
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 gradient-dark" data-testid="auth-page">
      {/* Language toggle */}
      <button
        onClick={() => setLocale(locale === "en" ? "ko" : "en")}
        className="fixed top-4 right-4 z-50 rounded-lg bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        {t("lang.label")}
      </button>

      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary">
            <ArrowRightLeft className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t("auth.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("auth.subtitle")}
          </p>
        </div>

        <div className="glass-card p-6">
          {authError ? (
            <div className="text-center space-y-4">
              <h2 className="text-lg font-semibold text-destructive">
                {authError.toLowerCase().includes("expired") || authError.toLowerCase().includes("invalid") 
                  ? t("auth.invalidLink") 
                  : "Authentication Error"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {authError.toLowerCase().includes("expired") || authError.toLowerCase().includes("invalid")
                  ? t("auth.invalidLinkDesc")
                  : authError}
              </p>
              <Button 
                onClick={() => setAuthError(null)} 
                className="w-full gradient-primary"
              >
                {t("auth.backToSignIn")}
              </Button>
            </div>
          ) : (
            <>
              <h2 className="mb-6 text-lg font-semibold text-foreground">
                {isUpdatingPassword ? t("auth.changePassword") : isPasswordReset ? t("auth.resetPassword") : isLogin ? t("auth.welcomeBack") : t("auth.createAccount")}
              </h2>

              {/* Update Password Form (Recovery Mode) */}
              {isUpdatingPassword ? (
                <form onSubmit={handleUpdatePassword} className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {t("auth.recoveryModeDesc")}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="new-password" id="new-password-label" className="text-muted-foreground text-sm">
                      {t("auth.newPassword")}
                    </Label>
                    <Input
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      className="bg-muted/50 border-border/50"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("auth.passwordGuideline")}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password" id="confirm-password-label" className="text-muted-foreground text-sm">
                      {t("auth.confirmPassword")}
                    </Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      className="bg-muted/50 border-border/50"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full gradient-primary font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
                  >
                    {submitting ? t("auth.submitting") : t("auth.updatePassword")}
                  </Button>

                  <div className="mt-4 text-center">
                    <button
                      type="button"
                      onClick={() => setIsUpdatingPassword(false)}
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      {t("auth.backToSignIn")}
                    </button>
                  </div>
                </form>
              ) : isPasswordReset ? (
                <form onSubmit={handlePasswordReset} className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {t("auth.resetPasswordDesc")}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reset-email" className="text-muted-foreground text-sm">
                      {t("auth.email")}
                    </Label>
                    <Input
                      id="reset-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      className="bg-muted/50 border-border/50"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full gradient-primary font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
                  >
                    {submitting ? t("auth.submitting") : t("auth.resetPasswordSubmit")}
                  </Button>

                  <div className="mt-4 text-center">
                    <button
                      type="button"
                      onClick={() => setIsPasswordReset(false)}
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      {t("auth.backToSignIn")}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-muted-foreground text-sm">
                      {t("auth.email")}
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      autoComplete={isLogin ? "username" : "email"}
                      className="bg-muted/50 border-border/50"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-muted-foreground text-sm">
                        {t("auth.password")}
                      </Label>
                      {isLogin && (
                        <button
                          type="button"
                          onClick={() => setIsPasswordReset(true)}
                          className="text-xs text-primary hover:text-primary/80 transition-colors"
                        >
                          {t("auth.forgotPassword")}
                        </button>
                      )}
                    </div>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      minLength={6}
                      autoComplete={isLogin ? "current-password" : "new-password"}
                      className="bg-muted/50 border-border/50"
                    />
                    {!isLogin && (
                      <p className="text-xs text-muted-foreground">
                        {t("auth.passwordGuideline")}
                      </p>
                    )}
                  </div>

                  {!isLogin && (
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword" className="text-muted-foreground text-sm">
                        {t("auth.confirmPassword") || "Repeat Password"}
                      </Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        minLength={6}
                        autoComplete="new-password"
                        className="bg-muted/50 border-border/50"
                      />
                    </div>
                  )}

                  {/* Invite code field - only shown on signup (optional) */}
                  {!isLogin && (
                    <div className="space-y-2">
                      <Label htmlFor="inviteCode" className="text-muted-foreground text-sm">
                        {t("auth.inviteCode")} <span className="text-xs text-muted-foreground opacity-60">({t("common.optional")})</span>
                      </Label>
                      <Input
                        id="inviteCode"
                        value={inviteCode}
                        onChange={(e) => setInviteCode(e.target.value)}
                        placeholder={t("auth.inviteCodePlaceholder")}
                        className="bg-muted/50 border-border/50 font-mono"
                      />
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full gradient-primary font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
                  >
                    {submitting ? t("auth.submitting") : isLogin ? t("auth.signIn") : t("auth.signUp")}
                  </Button>
                </form>
              )}

              {!isPasswordReset && !isUpdatingPassword && (
                <>
                  <div className="mt-4 text-center">
                    <button
                      onClick={() => setIsLogin(!isLogin)}
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      {isLogin ? t("auth.switchToSignUp") : t("auth.switchToSignIn")}
                    </button>
                  </div>

                  <div className="mt-6 flex items-center gap-2">
                    <div className="h-px flex-1 bg-border/50"></div>
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
                      {t("common.or") || "OR"}
                    </span>
                    <div className="h-px flex-1 bg-border/50"></div>
                  </div>

                  <div className="mt-6">
                    <Button
                      variant="outline"
                      onClick={handleStandalone}
                      className="w-full border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors flex flex-col h-auto py-3 px-4 gap-1"
                    >
                      <span className="font-semibold text-primary">{t("auth.continueStandalone")}</span>
                      <span className="text-[10px] text-muted-foreground font-normal whitespace-normal line-clamp-2">
                        {t("auth.standaloneDesc")}
                      </span>
                    </Button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
