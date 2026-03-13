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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { signIn, signUp } = useAuth();
  const { t, locale, setLocale } = useI18n();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">{t("auth.loading")}</div>
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    <div className="flex min-h-screen flex-col items-center justify-center px-6 gradient-dark">
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
          <h2 className="mb-6 text-lg font-semibold text-foreground">
            {isLogin ? t("auth.welcomeBack") : t("auth.createAccount")}
          </h2>

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
                required
                className="bg-muted/50 border-border/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-muted-foreground text-sm">
                {t("auth.password")}
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="bg-muted/50 border-border/50"
              />
            </div>

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

          <div className="mt-4 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              {isLogin ? t("auth.switchToSignUp") : t("auth.switchToSignIn")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
