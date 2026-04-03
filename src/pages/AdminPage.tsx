import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { useProjects } from "@/hooks/useProjects";
import { useCategories } from "@/hooks/useCategories";
import { useColumnHeaders } from "@/hooks/useColumnHeaders";
import { useCustomColumns } from "@/hooks/useCustomColumns";
import { useProjectMembers } from "@/hooks/useProjectMembers";
import { useI18n } from "@/hooks/useI18n";
import { useSimulationVisibility } from "@/hooks/useSimulationVisibility";
import CategoryManager from "@/components/CategoryManager";
import CustomColumnManager from "@/components/CustomColumnManager";
import TrashManager from "@/components/TrashManager";
import ExportProjectSetup from "@/components/ExportProjectSetup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ArrowLeft, ShieldCheck, Check, Trash2, Ban, Plus, Copy, UserMinus, Database, Shield, Crown, EyeOff, Archive, CalendarIcon, Eye, Loader2, HardDrive, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parse } from "date-fns";
import { cn, formatBytes } from "@/lib/utils";
import { UserRole } from "@/hooks/useUserRole";
import { get } from "idb-keyval";

const AdminPage = () => {
  const { user, isStandalone } = useAuth();
  const { projects, activeProject, fetchProjects, deleteProject, updateProject, loading } = useProjects();
  const { categories, addCategory, addSubCategory, deleteCategory, renameCategory, updateCategoryCode, updateCategoryIcon, reorderCategory, reorderCategories, bulkUpdateCategories, fetchCategories } = useCategories(activeProject?.id);
  const { headers, draft, dirty, saving, updateDraft, saveHeaders, resetHeaders } = useColumnHeaders(activeProject?.id);
  const { columns: customColumns, addColumn, deleteColumn, toggleMasked, toggleRequired, updateSuggestions, reorderColumn, reorderColumns, renameColumn, fetchColumns } = useCustomColumns(activeProject?.id);
  const { members, invites, removeMember, banMember, createInvite, deleteInvite, updateMemberRole, transferOwnership } = useProjectMembers(activeProject?.id);
  const { t } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currency, setCurrency] = useState(activeProject?.currency || "EUR");
  
  // Sync currency when activeProject updates
  useEffect(() => {
    if (activeProject?.currency) setCurrency(activeProject.currency);
  }, [activeProject?.currency]);
  const [savingCurrency, setSavingCurrency] = useState(false);
  const [inviteLabel, setInviteLabel] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [dbStats, setDbStats] = useState<{
    db_size_pretty: string;
    db_size: number;
    tables: Array<{ table_name: string; row_count: number; size: string }>;
  } | null>(null);
  const [dbLoading, setDbLoading] = useState(false);
  const [storageStats, setStorageStats] = useState<{
    total_files: number;
    total_size: number;
    total_size_pretty: string;
    by_type: Array<{ file_type: string; count: number; size: number; size_pretty: string }>;
    largest_file: { file_name: string; file_size: number; file_size_pretty: string; file_type: string } | null;
    recent_files: Array<{ id: string; file_name: string; file_size: number; file_type: string; uploaded_at: string }>;
  } | null>(null);
  const [localStorageStats, setLocalStorageStats] = useState<{
    usage: number;
    quota: number;
    usagePretty: string;
    quotaPretty: string;
    percent: number;
  } | null>(null);
  const [standaloneStats, setStandaloneStats] = useState<{
    projects: number;
    transactions: number;
    categories: number;
    files: number;
    filesSize: number;
    columns: number;
  } | null>(null);
  const [standaloneQuota, setStandaloneQuota] = useState<number>(() => {
    const stored = localStorage.getItem("standalone-quota-gb");
    const parsed = stored ? parseFloat(stored) : NaN;
    const defaultQuota = 5 * 1024 * 1024 * 1024;
    return isFinite(parsed) && parsed > 0 ? parsed * 1024 * 1024 * 1024 : defaultQuota;
  });
  const [quotaInput, setQuotaInput] = useState<string>((standaloneQuota / (1024 * 1024 * 1024)).toString());
  const [storageLoading, setStorageLoading] = useState(false);
  const [archiveFrom, setArchiveFrom] = useState("");
  const [archiveTo, setArchiveTo] = useState("");
  const [archiving, setArchiving] = useState(false);

  const realOwner = activeProject && user && activeProject.owner_id === user.id;
  const { role: userRole, effectiveRole, isSimulating, simulatedRole, setSimulatedRole } = useUserRole(activeProject?.id);
  const { isVisible, toggleVisibility } = useSimulationVisibility();
  const isAdmin = effectiveRole === "admin";
  const isOwner = (!isSimulating && realOwner) || false;
  const canAccess = isOwner || isAdmin;

  const DB_MAX_BYTES = 500 * 1024 * 1024; // 500 MB
  const STORAGE_MAX_BYTES = 1024 * 1024 * 1024; // 1 GB for Supabase Storage free tier

  useEffect(() => {
    if (!isOwner || isStandalone) return;
    const fetchStats = async () => {
      setDbLoading(true);
      const { data, error } = await supabase.rpc("get_db_stats");
      setDbLoading(false);
      if (!error && data) setDbStats(data);
    };
    fetchStats();
  }, [isOwner, isStandalone]);

  useEffect(() => {
    if (!isStandalone || !activeProject?.id) return;

    const controller = new AbortController();

    const calculateStandaloneStats = async () => {
      try {
        const localProjects = JSON.parse(localStorage.getItem("local_projects") || "[]");
        const localTransactions = JSON.parse(localStorage.getItem(`local_transactions_${activeProject.id}`) || "[]");
        const localCategories = JSON.parse(localStorage.getItem(`local_categories_${activeProject.id}`) || "[]");
        const localColumns = JSON.parse(localStorage.getItem(`local_custom_columns_${activeProject.id}`) || "[]");
        const localFiles: any[] = await get(`files-metadata-${activeProject.id}`) || [];

        if (controller.signal.aborted) return;

        setStandaloneStats({
          projects: localProjects.length,
          transactions: localTransactions.length,
          categories: localCategories.length,
          files: localFiles.length,
          filesSize: localFiles.reduce((sum, f) => sum + (f.file_size || 0), 0),
          columns: localColumns.length
        });
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error("Failed to calculate standalone stats:", err);
        }
      }
    };

    calculateStandaloneStats();
    return () => controller.abort();
  }, [isStandalone, activeProject?.id]);

  useEffect(() => {
    if (!isStandalone) return;
    
    const fetchLocalEstimate = async () => {
      if (navigator.storage && navigator.storage.estimate) {
        try {
          const estimate = await navigator.storage.estimate();
          const usage = estimate.usage || 0;
          const quota = estimate.quota || 0;
          
          // Use user-defined quota if smaller than browser quota, otherwise use browser quota
          const effectiveQuota = Math.min(quota, standaloneQuota);
          
          setLocalStorageStats({
            usage,
            quota: effectiveQuota,
            usagePretty: formatBytes(usage),
            quotaPretty: formatBytes(effectiveQuota),
            percent: effectiveQuota > 0 ? (usage / effectiveQuota) * 100 : 0
          });
        } catch (err) {
          console.error("Failed to fetch storage estimate:", err);
        }
      }
    };
    
    fetchLocalEstimate();
  }, [isStandalone, standaloneQuota]);

  useEffect(() => {
    if (!activeProject?.id || isStandalone) return;
    const fetchStorageStats = async () => {
      setStorageLoading(true);

      const { data, error } = await supabase.rpc("get_storage_stats", { p_project_id: activeProject.id });

      setStorageLoading(false);

      if (error) {
        console.error('[AdminPage] Storage stats error:', error);
      } else {
        setStorageStats(data);
      }
    };
    fetchStorageStats();
  }, [activeProject?.id, isStandalone]);

  const handleCurrencyChange = async () => {
    if (!activeProject || !currency.trim()) return;
    setSavingCurrency(true);
    await updateProject(activeProject.id, { currency: currency.trim().toUpperCase() });
    setSavingCurrency(false);
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

  const handleQuotaChange = () => {
    const val = parseFloat(quotaInput);
    const MAX_GB = 100;

    if (isNaN(val) || val <= 0) {
      toast.error(t("admin.invalidQuota"));
      return;
    }
    
    if (val > MAX_GB) {
      toast.error(t("admin.invalidQuota")); // Or a more specific message if available
      return;
    }

    const bytes = val * 1024 * 1024 * 1024;
    setStandaloneQuota(bytes);
    localStorage.setItem("standalone-quota-gb", val.toString());
    toast.success(t("admin.quotaUpdated").replace("{val}", val.toString()));
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
    const csvRows = txs.map((tx: { transaction_date: string; type: string; amount: number; category: string; description?: string; custom_values?: Record<string, number | string> }) => {
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
    const ids = txs.map((tx: { id: string }) => tx.id);
    const batchSize = 50;
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      await supabase
        .from("transactions")
        .update({ deleted_at: new Date().toISOString() })
        .in("id", batch);
    }

    // Unlink all files associated with archived transactions
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      const { error: unlinkError } = await supabase
        .from("project_files")
        .update({ transaction_id: null })
        .in("transaction_id", batch);

      if (unlinkError) {
        console.error("Failed to unlink files from archived transactions:", unlinkError);
      }
    }

    // Invalidate file list cache to refresh UI with unlinked files
    queryClient.invalidateQueries({ queryKey: ["project-files", activeProject.id] });

    setArchiving(false);
    setArchiveFrom("");
    setArchiveTo("");
    toast.success(t("admin.archiveSuccess").replace("{n}", String(txs.length)));
  };

  const handleDeleteProject = async () => {
    if (!activeProject) return;
    const confirmed = window.confirm(
      t("admin.deleteConfirm").replace("{project}", activeProject.name)
    );
    if (!confirmed) return;
    await deleteProject(activeProject.id);
    navigate("/");
  };

  if (loading && !activeProject) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center py-20 text-center animate-fade-in" data-testid="admin-page">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">{t("global.loading")}</p>
      </div>
    );
  }

  if (!activeProject) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" data-testid="admin-page">
        <p className="text-muted-foreground">{t("admin.noProject")}</p>
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4" data-testid="admin-page">
        <ShieldCheck className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">{t("admin.ownerOnly")}</p>
        <Button variant="outline" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> {t("admin.backToDashboard")}
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-12" data-testid="admin-page">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/30 px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-sm font-semibold text-foreground">{t("admin.title")}</h1>
            <p className="text-xs text-muted-foreground">{activeProject.name}</p>
          </div>
          {realOwner && (
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleVisibility}
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                title={isVisible ? "Hide simulation buttons" : "Show simulation buttons"}
              >
                {isVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              </Button>
              {isVisible && (
                <div className="flex items-center gap-0.5 shrink-0">
                  <Eye className="h-3 w-3 text-muted-foreground mr-0.5" />
                  {(["owner", "admin", "member", "viewer"] as UserRole[]).map((r) => {
                    const active = isSimulating ? simulatedRole === r : (r === "owner");
                    return (
                      <button
                        key={r}
                        onClick={() => setSimulatedRole(r === "owner" ? null : r)}
                        className={`rounded px-1.5 py-0.5 text-[9px] font-medium transition-all ${
                          active
                            ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {t(`admin.${r}`)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
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

        {/* Archive - Owner only and NOT in standalone mode */}
        {isOwner && !isStandalone && (
        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Archive className="h-4 w-4" />
              {t("admin.archive")}
            </h2>
            <p className="text-xs text-muted-foreground">{t("admin.archiveDesc")}</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card p-3 space-y-2 overflow-hidden max-w-full">
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

        {/* Members - Owner only and NOT in standalone mode */}
        {isOwner && !isStandalone && (
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

                // Look up invite info for this member (email and label)
                const memberInvite = invites.find(inv => inv.used_by === m.user_id);
                const memberEmail = memberInvite?.email;
                const memberLabel = memberInvite?.label;

                return (
                  <div key={m.id} className="rounded-lg bg-muted/30 px-3 py-3">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-foreground break-all">
                            {memberEmail || (isSelf ? user?.email : null) || m.user_id.slice(0, 8) + "..."}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                              {isOwnerMember && <Crown className="h-3 w-3 text-amber-500" />}
                              {isAdmin && <Shield className="h-3 w-3 text-primary" />}
                              {isViewer && <EyeOff className="h-3 w-3 text-muted-foreground" />}
                              {roleLabel}
                            </p>
                            {memberLabel && (
                              <p className="text-xs text-primary/70 break-all ml-2">{memberLabel}</p>
                            )}
                          </div>
                        </div>
                      </div>
                      {!isSelf && !isOwnerMember && (
                        <div className="flex justify-end gap-1 pt-1">
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
                  </div>
                );
              })
            )}
          </div>
        </section>
        )}

        {/* Invite Codes - Owner only and NOT in standalone mode */}
        {isOwner && !isStandalone && (
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
                  <div key={inv.id} className="flex items-center gap-3 rounded-lg bg-muted/30 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <code className="text-sm font-mono text-primary">{inv.code}</code>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          inv.used_by
                            ? "bg-muted text-muted-foreground"
                            : "bg-primary/10 text-primary"
                        }`}>
                          {inv.used_by ? t("admin.inviteUsed") : t("admin.inviteUnused")}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {(inv as { role?: string }).role || "member"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {(inv as { email?: string }).email && (
                          <div className="flex items-center gap-1">
                            <p className="text-xs text-primary truncate">{(inv as { email?: string }).email}</p>
                          </div>
                        )}
                        {inv.label && (
                          <div className="flex items-center gap-1">
                            <p className="text-xs text-muted-foreground truncate">{inv.label}</p>
                          </div>
                        )}
                        {!inv.label && !(inv as { email?: string }).email && (
                          <p className="text-xs text-muted-foreground italic">{t("admin.noInviteDesc")}</p>
                        )}
                      </div>
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
                  value={draft[key]}
                  onChange={(e) => updateDraft(key, e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder={key.charAt(0).toUpperCase() + key.slice(1)}
                />
              </div>
            ))}
            {dirty && (
              <Button size="sm" onClick={saveHeaders} disabled={saving} className="mt-1 w-fit">
                {saving ? t("admin.saving") || "Saving..." : t("admin.save") || "Save"}
              </Button>
            )}
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
            <CustomColumnManager columns={customColumns} onAdd={addColumn} onDelete={deleteColumn} onToggleMasked={toggleMasked} onToggleRequired={toggleRequired} onUpdateSuggestions={updateSuggestions} onReorderAll={reorderColumns} onRename={renameColumn} />
          </div>
        </section>

        {/* Project Setup Export/Import - Owner only */}
        {isOwner && (
        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">{t("setup.title")}</h2>
            <p className="text-xs text-muted-foreground">{t("setup.desc")}</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card p-4">
            <ExportProjectSetup
              categories={categories}
              customColumns={customColumns}
              columnHeaders={headers}
              currency={activeProject.currency}
              projectId={activeProject.id}
              onCategoriesRefresh={fetchCategories}
              onColumnsRefresh={fetchColumns}
              onProjectRefresh={fetchProjects}
            />
          </div>
        </section>
        )}

        {/* Categories */}
        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">{t("admin.categories")}</h2>
            <p className="text-xs text-muted-foreground">{t("admin.categoriesDesc")}</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card p-4">
            <CategoryManager categories={categories} onAdd={addCategory} onAddSubCategory={addSubCategory} onDelete={deleteCategory} onUpdateName={renameCategory} onUpdateCode={updateCategoryCode} onUpdateIcon={updateCategoryIcon} onReorderAll={reorderCategories} onBulkUpdate={bulkUpdateCategories} inline />
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
                placeholder="EUR"
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
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteProject}
              className="w-full"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {t("admin.deleteProject")}
            </Button>
          </div>
        </section>

        {/* Local Storage Stats - Only in standalone mode */}
        {isStandalone && localStorageStats && (
        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Database className="h-4 w-4" />
              {t("admin.storageStats")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("admin.localStorageDesc")}
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card p-4 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  {t("admin.storageUsed")}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[200px] text-[10px]">
                        <p>{t("admin.originStorageNote") || "This represents the total storage used by the entire application on your device, including all projects and browser overhead."}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </span>
                <span className="font-mono text-foreground">{localStorageStats.usagePretty}</span>
              </div>
              <Progress
                value={Math.min(localStorageStats.percent, 100)}
                className="h-2"
              />
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{localStorageStats.percent.toFixed(2)}%</span>
                <span>{t("admin.storageQuota")}: {localStorageStats.quotaPretty}</span>
              </div>
            </div>

            {standaloneStats && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-border/30">
                <div className="p-2 bg-muted/20 rounded-lg space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">{t("admin.dbTransactions")}</span>
                  <span className="text-sm font-semibold flex items-center gap-1.5">
                    <Archive className="h-3 w-3 text-primary" />
                    {standaloneStats.transactions}
                  </span>
                </div>
                <div className="p-2 bg-muted/20 rounded-lg space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">{t("admin.storageTotalFiles")}</span>
                  <span className="text-sm font-semibold flex items-center gap-1.5">
                    <Database className="h-3 w-3 text-primary" />
                    {standaloneStats.files}
                  </span>
                </div>
                <div className="p-2 bg-muted/20 rounded-lg space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">{t("files.size")}</span>
                  <span className="text-sm font-semibold flex items-center gap-1.5 font-mono text-[11px]">
                    <HardDrive className="h-3 w-3 text-primary" />
                    {formatBytes(standaloneStats.filesSize, 1)}
                  </span>
                </div>
                <div className="p-2 bg-muted/20 rounded-lg space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">{t("admin.categories")}</span>
                  <span className="text-sm font-semibold flex items-center gap-1.5">
                    <Plus className="h-3 w-3 text-primary" />
                    {standaloneStats.categories}
                  </span>
                </div>
                <div className="p-2 bg-muted/20 rounded-lg space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">{t("admin.customColumns")}</span>
                  <span className="text-sm font-semibold flex items-center gap-1.5">
                    <Shield className="h-3 w-3 text-primary" />
                    {standaloneStats.columns}
                  </span>
                </div>
                <div className="p-2 bg-muted/20 rounded-lg space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">{t("admin.projects")}</span>
                  <span className="text-sm font-semibold flex items-center gap-1.5">
                    <Crown className="h-3 w-3 text-primary" />
                    {standaloneStats.projects}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-2 pt-2 border-t border-border/30">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                {t("admin.changeQuota") || "Change Quota (GB)"}
              </label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={quotaInput}
                  onChange={(e) => setQuotaInput(e.target.value)}
                  className="h-8 text-xs"
                />
                <Button size="sm" variant="outline" className="h-8" onClick={handleQuotaChange}>
                  <Check className="h-3.5 w-3.5 mr-1.5" />
                  {t("admin.save") || "Save"}
                </Button>
              </div>
            </div>
            
            <div className="p-3 bg-muted/30 rounded-lg">
              <p className="text-xs text-muted-foreground leading-relaxed italic">
                {t("admin.standaloneStorageNote")}
              </p>
            </div>
          </div>
        </section>
        )}

        {/* Database Stats - NOT in standalone mode */}
        {!isStandalone && (
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
                    {dbStats.tables.map((tbl: { table_name: string; row_count: number; size: string }) => (
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
        )}

        {/* Storage Stats - SPEC-STORAGE-001 - NOT in standalone mode */}
        {!isStandalone && (
        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <HardDrive className="h-4 w-4" />
              {t("admin.storageStats")}
            </h2>
            <p className="text-xs text-muted-foreground">{t("admin.storageStatsDesc")}</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card p-4 space-y-4">
            {storageLoading ? (
              <p className="text-xs text-muted-foreground text-center py-4">{t("admin.storageLoading")}</p>
            ) : !storageStats ? (
              <p className="text-xs text-muted-foreground text-center py-4">{t("admin.storageError")}</p>
            ) : storageStats.total_files === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">{t("admin.storageEmpty")}</p>
            ) : (
              <>
                {/* Summary Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-muted/30 px-3 py-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{t("admin.storageTotalFiles")}</p>
                    <p className="text-2xl font-semibold text-foreground mt-1">{storageStats.total_files}</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 px-3 py-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{t("admin.storageTotalSize")}</p>
                    <p className="text-lg font-semibold text-foreground mt-1 truncate">{storageStats.total_size_pretty}</p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-2">
                  <Progress
                    value={Math.min((storageStats.total_size / STORAGE_MAX_BYTES) * 100, 100)}
                    className="h-2"
                  />
                  <p className="text-[10px] text-muted-foreground text-right">
                    {t("admin.storageMaxSize")}
                  </p>
                </div>

                {/* By File Type */}
                {storageStats.by_type && storageStats.by_type.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">{t("admin.storageByType")}</p>
                    <div className="space-y-1">
                      {storageStats.by_type.map((type) => (
                        <div key={type.file_type} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-sm text-foreground truncate">{type.file_type}</span>
                            <span className="text-xs text-muted-foreground">({type.count})</span>
                          </div>
                          <span className="text-xs font-mono text-muted-foreground">{type.size_pretty}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Largest File */}
                {storageStats.largest_file && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">{t("admin.storageLargestFile")}</p>
                    <div className="rounded-lg bg-muted/30 px-3 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground truncate" title={storageStats.largest_file.file_name}>
                            {storageStats.largest_file.file_name}
                          </p>
                          <p className="text-xs text-muted-foreground">{storageStats.largest_file.file_type}</p>
                        </div>
                        <span className="text-xs font-mono text-muted-foreground">{storageStats.largest_file.file_size_pretty}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Recent Files */}
                {storageStats.recent_files && storageStats.recent_files.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">{t("admin.storageRecentFiles")}</p>
                    <div className="space-y-1">
                      {storageStats.recent_files.map((file) => (
                        <div key={file.id} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground truncate" title={file.file_name}>
                              {file.file_name}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(file.uploaded_at).toLocaleDateString()} • {file.file_type}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
        )}

        {/* Build Info */}
        <section className="rounded-2xl bg-card border border-border p-4">
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            {t("admin.buildInfo")}
          </h2>
          <div className="space-y-1.5 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>{t("admin.buildTime")}</span>
              <span className="font-mono">{(() => { try { return format(new Date(__BUILD_TIME__), "yyyy-MM-dd HH:mm:ss"); } catch { return "N/A"; } })()}</span>
            </div>
            <div className="flex justify-between">
              <span>{t("admin.buildMode")}</span>
              <span className="font-mono">{import.meta.env.MODE}</span>
            </div>
            <div className="flex justify-between">
              <span>{t("admin.buildVersion")}</span>
              <span className="font-mono">{__APP_VERSION__}</span>
            </div>
          </div>
        </section>

        {/* System Administration - Owner only and NOT in standalone mode */}
        {realOwner && !isStandalone && (
        <section className="rounded-2xl bg-card border border-border p-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/global-admin")}
            className="w-full"
          >
            <Database className="h-4 w-4 mr-2" />
            {t("global.title")}
          </Button>
        </section>
        )}
        </>)}
      </main>
    </div>
  );
};

export default AdminPage;
