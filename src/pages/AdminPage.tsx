import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProjects } from "@/hooks/useProjects";
import { useCategories } from "@/hooks/useCategories";
import { useColumnHeaders } from "@/hooks/useColumnHeaders";
import { useCustomColumns } from "@/hooks/useCustomColumns";
import { useI18n } from "@/hooks/useI18n";
import CategoryManager from "@/components/CategoryManager";
import CustomColumnManager from "@/components/CustomColumnManager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ShieldCheck, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const AdminPage = () => {
  const { user } = useAuth();
  const { projects, activeProject, fetchProjects } = useProjects();
  const { categories, addCategory, deleteCategory } = useCategories(activeProject?.id);
  const { headers, updateHeader, resetHeaders } = useColumnHeaders(activeProject?.id);
  const { columns: customColumns, addColumn, deleteColumn } = useCustomColumns(activeProject?.id);
  const { t } = useI18n();
  const navigate = useNavigate();
  const [currency, setCurrency] = useState(activeProject?.currency || "USD");
  const [savingCurrency, setSavingCurrency] = useState(false);

  const isOwner = activeProject && user && activeProject.owner_id === user.id;

  const handleCurrencyChange = async () => {
    if (!activeProject || !currency.trim()) return;
    setSavingCurrency(true);
    const { error } = await supabase
      .from("projects")
      .update({ currency: currency.trim().toUpperCase() })
      .eq("id", activeProject.id);
    setSavingCurrency(false);
    if (error) {
      toast.error(t("admin.currencyFailed"));
      return;
    }
    toast.success(t("admin.currencyUpdated"));
    await fetchProjects();
  };

  if (!activeProject) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">{t("admin.noProject")}</p>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <ShieldCheck className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">{t("admin.ownerOnly")}</p>
        <Button variant="outline" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> {t("admin.backToDashboard")}
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/30 px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-sm font-semibold text-foreground">{t("admin.title")}</h1>
            <p className="text-xs text-muted-foreground">{activeProject.name}</p>
          </div>
        </div>
      </header>

      <main className="px-4 pt-6 max-w-lg mx-auto space-y-8">
        {/* Column Headers */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">{t("admin.columnHeaders")}</h2>
              <p className="text-xs text-muted-foreground">{t("admin.columnHeadersDesc")}</p>
            </div>
            <Button variant="outline" size="sm" onClick={resetHeaders} className="text-xs">
              {t("admin.reset")}
            </Button>
          </div>
          <div className="grid gap-3 rounded-xl border border-border/50 bg-card p-4">
            {(["date", "type", "category", "description", "amount"] as const).map((key) => (
              <div key={key} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                <label className="text-xs text-muted-foreground capitalize shrink-0 sm:w-20">{key}</label>
                <input
                  value={headers[key]}
                  onChange={(e) => updateHeader(key, e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder={key.charAt(0).toUpperCase() + key.slice(1)}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Custom Columns */}
        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">{t("admin.customColumns")}</h2>
            <p className="text-xs text-muted-foreground">{t("admin.customColumnsDesc")}</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card p-4">
            <CustomColumnManager columns={customColumns} onAdd={addColumn} onDelete={deleteColumn} />
          </div>
        </section>

        {/* Categories */}
        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">{t("admin.categories")}</h2>
            <p className="text-xs text-muted-foreground">{t("admin.categoriesDesc")}</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card p-4">
            <CategoryManager categories={categories} onAdd={addCategory} onDelete={deleteCategory} inline />
          </div>
        </section>

        {/* Project Info */}
        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">{t("admin.projectInfo")}</h2>
            <p className="text-xs text-muted-foreground">{t("admin.projectInfoDesc")}</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card p-4 space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-24">{t("proj.inviteCode")}</span>
              <code className="flex-1 rounded-lg bg-muted px-3 py-2 text-sm font-mono text-foreground">
                {activeProject.invite_code}
              </code>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-24">{t("admin.currency")}</span>
              <Input
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="flex-1 bg-background text-sm uppercase"
                maxLength={5}
                placeholder="USD"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleCurrencyChange}
                disabled={savingCurrency || currency.trim().toUpperCase() === activeProject.currency}
              >
                <Check className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default AdminPage;
