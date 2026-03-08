import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProjects } from "@/hooks/useProjects";
import { useCategories } from "@/hooks/useCategories";
import { useColumnHeaders } from "@/hooks/useColumnHeaders";
import { useCustomColumns } from "@/hooks/useCustomColumns";
import { useProjectMembers } from "@/hooks/useProjectMembers";
import { useI18n } from "@/hooks/useI18n";
import CategoryManager from "@/components/CategoryManager";
import CustomColumnManager from "@/components/CustomColumnManager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ShieldCheck, Check, Trash2, Ban, Plus, Copy, UserMinus, Database } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const AdminPage = () => {
  const { user } = useAuth();
  const { projects, activeProject, fetchProjects } = useProjects();
  const { categories, addCategory, deleteCategory } = useCategories(activeProject?.id);
  const { headers, updateHeader, resetHeaders } = useColumnHeaders(activeProject?.id);
  const { columns: customColumns, addColumn, deleteColumn } = useCustomColumns(activeProject?.id);
  const { members, invites, removeMember, banMember, createInvite, deleteInvite } = useProjectMembers(activeProject?.id);
  const { t } = useI18n();
  const navigate = useNavigate();
  const [currency, setCurrency] = useState(activeProject?.currency || "USD");
  const [savingCurrency, setSavingCurrency] = useState(false);
  const [inviteLabel, setInviteLabel] = useState("");
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [dbStats, setDbStats] = useState<any>(null);
  const [dbLoading, setDbLoading] = useState(false);

  const DB_MAX_BYTES = 500 * 1024 * 1024; // 500 MB

  useEffect(() => {
    if (!isOwner) return;
    const fetchStats = async () => {
      setDbLoading(true);
      const { data, error } = await supabase.rpc("get_db_stats");
      setDbLoading(false);
      if (!error && data) setDbStats(data);
    };
    fetchStats();
  }, [isOwner]);

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

  const handleRemoveMember = async (memberId: string) => {
    const ok = await removeMember(memberId);
    if (ok) toast.success(t("admin.memberRemoved"));
    else toast.error(t("admin.removeFailed"));
  };

  const handleBanMember = async (userId: string, memberId: string) => {
    const ok = await banMember(userId, memberId);
    if (ok) toast.success(t("admin.memberBanned"));
    else toast.error(t("admin.removeFailed"));
  };

  const handleCreateInvite = async () => {
    setCreatingInvite(true);
    const ok = await createInvite(inviteLabel);
    setCreatingInvite(false);
    if (ok) {
      toast.success(t("admin.inviteCreated"));
      setInviteLabel("");
    } else {
      toast.error(t("admin.inviteCreateFailed"));
    }
  };

  const handleDeleteInvite = async (inviteId: string) => {
    const ok = await deleteInvite(inviteId);
    if (ok) toast.success(t("admin.inviteDeleted"));
    else toast.error(t("admin.inviteDeleteFailed"));
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(t("proj.inviteCopied"));
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
        {/* Members */}
        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">{t("admin.members")}</h2>
            <p className="text-xs text-muted-foreground">{t("admin.membersDesc")}</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card p-4 space-y-2">
            {members.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">{t("admin.noMembers")}</p>
            ) : (
              members.map((m) => {
                const isSelf = m.user_id === user?.id;
                const isOwnerMember = m.user_id === activeProject.owner_id;
                return (
                  <div key={m.id} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground truncate font-mono">
                        {m.user_id.slice(0, 8)}…
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {isOwnerMember ? t("admin.owner") : t("admin.member")}
                      </p>
                    </div>
                    {!isSelf && !isOwnerMember && (
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemoveMember(m.id)}
                          title={t("admin.removeMember")}
                        >
                          <UserMinus className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleBanMember(m.user_id, m.id)}
                          title={t("admin.banMember")}
                        >
                          <Ban className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Invite Codes */}
        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">{t("admin.invites")}</h2>
            <p className="text-xs text-muted-foreground">{t("admin.invitesDesc")}</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
            <div className="flex gap-2">
              <Input
                value={inviteLabel}
                onChange={(e) => setInviteLabel(e.target.value)}
                placeholder={t("admin.inviteLabelPlaceholder")}
                className="flex-1 bg-background text-sm"
              />
              <Button
                size="sm"
                onClick={handleCreateInvite}
                disabled={creatingInvite}
              >
                <Plus className="h-4 w-4 mr-1" /> {t("admin.createInvite")}
              </Button>
            </div>

            {invites.length > 0 && (
              <div className="space-y-2 mt-2">
                {invites.map((inv) => (
                  <div key={inv.id} className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono text-primary">{inv.code}</code>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          inv.used_by
                            ? "bg-muted text-muted-foreground"
                            : "bg-primary/10 text-primary"
                        }`}>
                          {inv.used_by ? t("admin.inviteUsed") : t("admin.inviteUnused")}
                        </span>
                      </div>
                      {inv.label && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{inv.label}</p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {!inv.used_by && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-primary"
                          onClick={() => copyCode(inv.code)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteInvite(inv.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

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
