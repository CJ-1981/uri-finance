import { useState, useEffect } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { useProjects } from "@/hooks/useProjects";
import { useCategories } from "@/hooks/useCategories";
import { useColumnHeaders } from "@/hooks/useColumnHeaders";
import { useCustomColumns } from "@/hooks/useCustomColumns";
import { useProjectMembers } from "@/hooks/useProjectMembers";
import { useI18n } from "@/hooks/useI18n";
import CategoryManager from "@/components/CategoryManager";
import CustomColumnManager from "@/components/CustomColumnManager";
import TrashManager from "@/components/TrashManager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ArrowLeft, ShieldCheck, Check, Trash2, Ban, Plus, Copy, UserMinus, Database, Shield, Crown, EyeOff, Archive, CalendarIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parse, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { Transaction } from "@/hooks/useTransactions";
import { ColumnHeaders } from "@/hooks/useColumnHeaders";
import { CustomColumn } from "@/hooks/useCustomColumns";

const AdminPage = () => {
  const { user } = useAuth();
  const { projects, activeProject, fetchProjects } = useProjects();
  const { categories, addCategory, deleteCategory, updateCategoryCode, updateCategoryIcon, reorderCategory, reorderCategories } = useCategories(activeProject?.id);
  const { headers, updateHeader, resetHeaders } = useColumnHeaders(activeProject?.id);
  const { columns: customColumns, addColumn, deleteColumn, toggleMasked, toggleRequired, updateSuggestions, reorderColumn, reorderColumns } = useCustomColumns(activeProject?.id);
  const { members, invites, removeMember, banMember, createInvite, deleteInvite, updateMemberRole, transferOwnership } = useProjectMembers(activeProject?.id);
  const { t } = useI18n();
  const navigate = useNavigate();
  const [currency, setCurrency] = useState(activeProject?.currency || "USD");
  
  // Sync currency when activeProject updates
  useEffect(() => {
    if (activeProject?.currency) setCurrency(activeProject.currency);
  }, [activeProject?.currency]);
  const [savingCurrency, setSavingCurrency] = useState(false);
  const [inviteLabel, setInviteLabel] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [dbStats, setDbStats] = useState<any>(null);
  const [dbLoading, setDbLoading] = useState(false);
  const [archiveFrom, setArchiveFrom] = useState("");
  const [archiveTo, setArchiveTo] = useState("");
  const [archiving, setArchiving] = useState(false);

  const isOwner = activeProject && user && activeProject.owner_id === user.id;
  const { role: userRole } = useUserRole(activeProject?.id);
  const isAdmin = userRole === "admin";
  const canAccess = isOwner || isAdmin;

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

  const handleCycleRole = async (memberId: string, currentRole: string) => {
    const roleOrder = ["member", "viewer", "admin"];
    const currentIdx = roleOrder.indexOf(currentRole);
    const newRole = roleOrder[(currentIdx + 1) % roleOrder.length];
    const ok = await updateMemberRole(memberId, newRole);
    if (ok) toast.success(t("admin.promoted"));
    else toast.error(t("admin.promoteFailed"));
  };

  const handleTransferOwnership = async (newOwnerId: string) => {
    if (!user || !activeProject) return;
    const confirmed = window.confirm(t("admin.transferConfirm"));
    if (!confirmed) return;
    const ok = await transferOwnership(newOwnerId, user.id);
    if (ok) {
      toast.success(t("admin.transferred"));
      await fetchProjects();
      navigate("/");
    } else {
      toast.error(t("admin.transferFailed"));
    }
  };

  const handleCreateInvite = async () => {
    if (!inviteEmail.trim()) {
      toast.error(t("admin.inviteEmailRequired"));
      return;
    }
    setCreatingInvite(true);
    const ok = await createInvite(inviteLabel, inviteEmail, inviteRole);
    setCreatingInvite(false);
    if (ok) {
      toast.success(t("admin.inviteCreated"));
      setInviteLabel("");
      setInviteEmail("");
      setInviteRole("member");
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

  const handleArchive = async () => {
    if (!activeProject || !archiveFrom || !archiveTo) return;
    
    // Fetch transactions in range
    const { data: txs, error: fetchErr } = await supabase
      .from("transactions")
      .select("*")
      .eq("project_id", activeProject.id)
      .is("deleted_at", null)
      .gte("transaction_date", archiveFrom)
      .lte("transaction_date", archiveTo)
      .order("transaction_date", { ascending: true });

    if (fetchErr || !txs || txs.length === 0) {
      toast.info(t("admin.archiveEmpty"));
      return;
    }

    const confirmed = window.confirm(
      t("admin.archiveConfirm").replace("{n}", String(txs.length))
    );
    if (!confirmed) return;

    setArchiving(true);

    // Export as CSV
    const h = headers;
    const cols = customColumns;
    const colHeaders = cols.map((c) => c.name).join(",");
    const csvHeader = `${h.date},${h.type},${h.category},${h.description},${h.amount}${cols.length ? "," + colHeaders : ""}`;
    const csvRows = txs.map((tx: any) => {
      const fmtDate = tx.transaction_date;
      const fmtAmt = `${tx.type === "income" ? "" : "-"}${Number(tx.amount).toFixed(2)}`;
      const base = `${fmtDate},${tx.type},"${tx.category}","${tx.description || ""}",${fmtAmt}`;
      const custom = cols.map((c) => {
        const val = tx.custom_values?.[c.name];
        return `"${val != null ? (c.column_type === "numeric" ? Number(val).toFixed(2) : String(val)) : ""}"`;
      }).join(",");
      return cols.length ? `${base},${custom}` : base;
    });
    const csvContent = [csvHeader, ...csvRows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `archive_${archiveFrom}_${archiveTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    // Soft-delete all archived transactions
    const ids = txs.map((tx: any) => tx.id);
    const batchSize = 50;
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      await supabase
        .from("transactions")
        .update({ deleted_at: new Date().toISOString() })
        .in("id", batch);
    }

    setArchiving(false);
    setArchiveFrom("");
    setArchiveTo("");
    toast.success(t("admin.archiveSuccess").replace("{n}", String(txs.length)));
  };

  if (!activeProject) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">{t("admin.noProject")}</p>
      </div>
    );
  }

  if (!canAccess) {
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
        {/* Deleted Transactions (Trash) - Owner only */}
        {isOwner && (
        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Trash2 className="h-4 w-4" />
              {t("admin.trash")}
            </h2>
            <p className="text-xs text-muted-foreground">{t("admin.trashDesc")}</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card p-4">
            <TrashManager projectId={activeProject.id} currency={activeProject.currency} />
          </div>
        </section>
        )}

        {/* Archive - Owner only */}
        {isOwner && (
        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Archive className="h-4 w-4" />
              {t("admin.archive")}
            </h2>
            <p className="text-xs text-muted-foreground">{t("admin.archiveDesc")}</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card p-3 space-y-2 overflow-hidden max-w-full sm:max-w-[400px]">
            <div className="flex gap-2 items-end">
              <div className="space-y-1 flex-1 min-w-0">
                <label className="text-[10px] text-muted-foreground">{t("admin.archiveFrom")}</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full h-9 justify-start text-left font-normal bg-muted/50 border-border/50 min-w-0 px-2.5",
                        !archiveFrom && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate text-xs">
                        {archiveFrom ? format(parse(archiveFrom, "yyyy-MM-dd", new Date()), "MMM d, yyyy") : "Start date"}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={archiveFrom ? parse(archiveFrom, "yyyy-MM-dd", new Date()) : undefined}
                      onSelect={(d) => d && setArchiveFrom(format(d, "yyyy-MM-dd"))}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <span className="text-xs text-muted-foreground pb-2">~</span>
              <div className="space-y-1 flex-1 min-w-0">
                <label className="text-[10px] text-muted-foreground">{t("admin.archiveTo")}</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full h-9 justify-start text-left font-normal bg-muted/50 border-border/50 min-w-0 px-2.5",
                        !archiveTo && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate text-xs">
                        {archiveTo ? format(parse(archiveTo, "yyyy-MM-dd", new Date()), "MMM d, yyyy") : "End date"}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={archiveTo ? parse(archiveTo, "yyyy-MM-dd", new Date()) : undefined}
                      onSelect={(d) => d && setArchiveTo(format(d, "yyyy-MM-dd"))}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <Button
              size="sm"
              onClick={handleArchive}
              disabled={archiving || !archiveFrom || !archiveTo}
              className="w-full h-7 text-xs"
            >
              <Archive className="h-3.5 w-3.5 mr-1" />
              {archiving ? t("admin.archiving") : t("admin.archiveExportDelete")}
            </Button>
          </div>
        </section>
        )}

        {/* Members - Owner only */}
        {isOwner && (
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
                const isAdmin = m.role === "admin";
                const isViewer = m.role === "viewer";
                const roleLabel = isOwnerMember
                  ? t("admin.owner")
                  : isAdmin
                  ? t("admin.admin")
                  : isViewer
                  ? t("admin.viewer")
                  : t("admin.member");
                return (
                  <div key={m.id} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground truncate font-mono">
                        {m.user_id.slice(0, 8)}…
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        {isOwnerMember && <Crown className="h-3 w-3 text-amber-500" />}
                        {isAdmin && <Shield className="h-3 w-3 text-primary" />}
                        {isViewer && <EyeOff className="h-3 w-3 text-muted-foreground" />}
                        {roleLabel}
                      </p>
                    </div>
                    {!isSelf && !isOwnerMember && (
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-primary"
                          onClick={() => handleCycleRole(m.id, m.role)}
                          title={t("admin.cycleRole")}
                        >
                          <Shield className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-amber-500"
                          onClick={() => handleTransferOwnership(m.user_id)}
                          title={t("admin.transferOwnership")}
                        >
                          <Crown className="h-3.5 w-3.5" />
                        </Button>
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
        )}

        {/* Invite Codes - Owner only */}
        {isOwner && (
        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">{t("admin.invites")}</h2>
            <p className="text-xs text-muted-foreground">{t("admin.invitesDesc")}</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
            <div className="space-y-2">
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder={t("admin.inviteEmailPlaceholder")}
                className="bg-background text-sm"
                required
              />
              <div className="flex gap-2">
                <Input
                  value={inviteLabel}
                  onChange={(e) => setInviteLabel(e.target.value)}
                  placeholder={t("admin.inviteLabelPlaceholder")}
                  className="flex-1 bg-background text-sm"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                >
                  <option value="member">{t("admin.member")}</option>
                  <option value="admin">{t("admin.admin")}</option>
                  <option value="viewer">{t("admin.viewer")}</option>
                </select>
              </div>
              <Button
                size="sm"
                onClick={handleCreateInvite}
                disabled={creatingInvite || !inviteEmail.trim()}
                className="w-full"
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
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {(inv as any).role || "member"}
                        </span>
                      </div>
                      {(inv as any).email && (
                        <p className="text-xs text-primary/70 truncate mt-0.5">{(inv as any).email}</p>
                      )}
                      {inv.label && (
                        <p className="text-xs text-muted-foreground truncate">{inv.label}</p>
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
        )}

        {/* Column Headers - Owner only */}
        {isOwner && (
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
        )}

        {/* Custom Columns */}
        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">{t("admin.customColumns")}</h2>
            <p className="text-xs text-muted-foreground">{t("admin.customColumnsDesc")}</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card p-4">
            <CustomColumnManager columns={customColumns} onAdd={addColumn} onDelete={deleteColumn} onToggleMasked={toggleMasked} onToggleRequired={toggleRequired} onUpdateSuggestions={updateSuggestions} onReorderAll={reorderColumns} />
          </div>
        </section>

        {/* Categories */}
        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">{t("admin.categories")}</h2>
            <p className="text-xs text-muted-foreground">{t("admin.categoriesDesc")}</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card p-4">
            <CategoryManager categories={categories} onAdd={addCategory} onDelete={deleteCategory} onUpdateCode={updateCategoryCode} onUpdateIcon={updateCategoryIcon} onReorderAll={reorderCategories} inline />
          </div>
        </section>

        {/* Project Info - Owner only */}
        {isOwner && (<>
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

        {/* Database Stats */}
        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Database className="h-4 w-4" />
              {t("admin.dbStats")}
            </h2>
            <p className="text-xs text-muted-foreground">{t("admin.dbStatsDesc")}</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card p-4 space-y-4">
            {dbLoading ? (
              <p className="text-xs text-muted-foreground text-center py-4">{t("admin.dbLoading")}</p>
            ) : !dbStats ? (
              <p className="text-xs text-muted-foreground text-center py-4">{t("admin.dbError")}</p>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t("admin.dbSize")}</span>
                    <span className="font-mono text-foreground">{dbStats.db_size_pretty}</span>
                  </div>
                  <Progress
                    value={Math.min((dbStats.db_size / DB_MAX_BYTES) * 100, 100)}
                    className="h-2"
                  />
                  <p className="text-[10px] text-muted-foreground text-right">
                    {t("admin.dbMaxSize")}
                  </p>
                </div>

                {dbStats.tables && dbStats.tables.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">{t("admin.dbTables")}</p>
                    {dbStats.tables.map((tbl: any) => (
                      <div key={tbl.table_name} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
                        <span className="text-sm text-foreground font-mono">{tbl.table_name}</span>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{Math.max(0, tbl.row_count)} {t("admin.dbRows")}</span>
                          <span className="font-mono">{tbl.size}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* Build Info */}
        <section className="rounded-2xl bg-card border border-border p-4">
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            {t("admin.buildInfo") || "Build Info"}
          </h2>
          <div className="space-y-1.5 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>{t("admin.buildTime") || "Build Time"}</span>
              <span className="font-mono">{(() => { try { return format(new Date(__BUILD_TIME__), "yyyy-MM-dd HH:mm:ss"); } catch { return "N/A"; } })()}</span>
            </div>
            <div className="flex justify-between">
              <span>{t("admin.buildMode") || "Mode"}</span>
              <span className="font-mono">{import.meta.env.MODE}</span>
            </div>
            <div className="flex justify-between">
              <span>{t("admin.buildVersion") || "Version"}</span>
              <span className="font-mono">1.0.0</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default AdminPage;
