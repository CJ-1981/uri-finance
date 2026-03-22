import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProjects } from "@/hooks/useProjects";
import { useTransactions, Transaction } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { useColumnHeaders } from "@/hooks/useColumnHeaders";
import { useCustomColumns } from "@/hooks/useCustomColumns";
import { useUserRole } from "@/hooks/useUserRole";
import { useI18n } from "@/hooks/useI18n";
import { useSimulationVisibility } from "@/hooks/useSimulationVisibility";
import { useFiles } from "@/hooks/useFiles";
import ProjectSwitcher, { ProjectSwitcherHandle } from "@/components/ProjectSwitcher";
import AddTransactionSheet from "@/components/AddTransactionSheet";
import TransactionList, { TransactionListHandle } from "@/components/TransactionList";
import TransactionDetailSheet from "@/components/TransactionDetailSheet";
import FinanceCharts from "@/components/FinanceCharts";
import ExportTransactions from "@/components/ExportTransactions";
import PeriodSelector, { PeriodKey, DateRange, filterByPeriod, PeriodSelectorHandle } from "@/components/PeriodSelector";
import CategorySelector, { CategorySelectorHandle } from "@/components/CategorySelector";
import PinSetupDialog from "@/components/PinSetupDialog";
import PinDisableDialog from "@/components/PinDisableDialog";
import { UserMenu } from "@/components/UserMenu";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BarChart3, List, Sun, Moon, Settings, Globe, Lock, LockOpen, Eye, Calculator, UserPlus, Loader2, FileText } from "lucide-react";
import CashCalculator from "@/components/CashCalculator";
import ShortcutSettings from "@/components/ShortcutSettings";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import { UserRole } from "@/hooks/useUserRole";
import { useTheme } from "next-themes";
import { useNavigate } from "react-router-dom";
import { isPinSet } from "@/lib/securePinStorage";
import { FileManager } from "@/components/files";
const getAmountFontSize = (text: string) => {
  const len = text.length;
  if (len <= 10) return "text-lg";
  if (len <= 13) return "text-base";
  if (len <= 16) return "text-sm";
  return "text-xs";
};

const AmountText = ({ value, currency, className }: { value: number; currency: string; className?: string }) => {
  const formatted = `${currency} ${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  return (
    <p className={`mt-1 font-bold ${getAmountFontSize(formatted)} ${className || ""}`}>
      {formatted}
    </p>
  );
};

const Dashboard = () => {
  const { user } = useAuth();
  const { projects, activeProject, setActiveProject, createProject, joinProject, loading, isSystemAdmin } = useProjects();
  const { transactions, addTransaction, updateTransaction, deleteTransaction, bulkAddTransactions, fetchTransactions } = useTransactions(activeProject?.id);
  const { categories } = useCategories(activeProject?.id);
  const { headers } = useColumnHeaders(activeProject?.id);
  const { columns: customColumns } = useCustomColumns(activeProject?.id);
  const { isViewer, effectiveRole, isSimulating, simulatedRole, setSimulatedRole } = useUserRole(activeProject?.id);
  const { t, locale, setLocale } = useI18n();
  // SPEC-TRANSACTION-FILES: File upload functionality for transactions
  const { uploadFile } = useFiles(activeProject?.id || "");
  const { isVisible } = useSimulationVisibility();
  const [view, setView] = useState<"list" | "charts" | "cash" | "files">("list");
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [period, setPeriod] = useState<PeriodKey>("all");
  const [customRange, setCustomRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const realOwner = activeProject && user && activeProject.owner_id === user.id;
  const isOwner = !isSimulating && realOwner;
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [pinDisableDialogOpen, setPinDisableDialogOpen] = useState(false);
  const [hasPin, setHasPin] = useState(isPinSet());
  const [addTxOpen, setAddTxOpen] = useState(false);
  const [bulkEditTxs, setBulkEditTxs] = useState<Transaction[]>([]);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const txListRef = useRef<TransactionListHandle>(null);
  const periodSelectorRef = useRef<PeriodSelectorHandle>(null);
  const categorySelectorRef = useRef<CategorySelectorHandle>(null);
  const projectSwitcherRef = useRef<ProjectSwitcherHandle>(null);
  
  useEffect(() => {
    setSelectedCategoryId(null);
  }, [activeProject?.id]);

  // Handle pending invite code from signup
  useEffect(() => {
    const pendingCode = localStorage.getItem("pending_invite_code");
    if (pendingCode && user) {
      // Small delay to ensure authentication is complete
      setTimeout(() => {
        joinProject(pendingCode);
        localStorage.removeItem("pending_invite_code");
      }, 500);
    }
  }, [user]);

  const openAddTx = useCallback(() => {
    if (activeProject && !isViewer) setAddTxOpen(true);
  }, [activeProject, isViewer]);

  const noModalOpen = !addTxOpen && !detailOpen && !bulkEditOpen && !pinDialogOpen && !pinDisableDialogOpen;

  // "/" shortcut to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey && noModalOpen) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        if ((e.target as HTMLElement)?.isContentEditable) return;

        // Extra safety check for any open dialogs - only block if a combobox is expanded
        if (document.querySelector('[role="dialog"], [role="menu"], [role="listbox"], [role="combobox"][aria-expanded="true"]')) return;

        e.preventDefault();
        txListRef.current?.focusSearch();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [noModalOpen]);

  const handleRemovePin = () => {
    setHasPin(false);
  };

  // Filter transactions by selected period and category
  const filtered = useMemo(() => {
    let result = filterByPeriod(transactions, period, customRange);
    if (selectedCategoryId) {
      const category = categories.find(c => c.id === selectedCategoryId);
      if (category) {
        result = result.filter(tx => tx.category === category.name);
      }
    }
    return result;
  }, [transactions, period, customRange, selectedCategoryId, categories]);

  const projectCurrency = activeProject?.currency || "USD";

  // Group filtered transactions by currency
  const currencyTotals = useMemo(() => {
    const map: Record<string, { income: number; expense: number }> = {};
    filtered.forEach((tx) => {
      const cur = tx.currency || projectCurrency;
      if (!map[cur]) map[cur] = { income: 0, expense: 0 };
      if (tx.type === "income") map[cur].income += Number(tx.amount);
      else map[cur].expense += Number(tx.amount);
    });
    return map;
  }, [filtered, projectCurrency]);

  // Primary currency totals for the main balance card
  const totalIncome = currencyTotals[projectCurrency]?.income || 0;
  const totalExpense = currencyTotals[projectCurrency]?.expense || 0;
  const balance = totalIncome - totalExpense;

  // Other currencies
  const otherCurrencies = useMemo(
    () => Object.keys(currencyTotals).filter((c) => c !== projectCurrency).sort(),
    [currencyTotals, projectCurrency]
  );

  // Filter chart transactions to project currency only
  const chartTransactions = useMemo(
    () => filtered.filter((tx) => (tx.currency || projectCurrency) === projectCurrency),
    [filtered, projectCurrency]
  );

  // j/k to navigate and open transactions in list view
  const navigableTxs = filtered;

  const goNextTx = useCallback(() => {
    if (view !== "list" || !activeProject) return;
    const currentIdx = selectedTx ? navigableTxs.findIndex(tx => tx.id === selectedTx.id) : -1;
    const nextIdx = Math.min(currentIdx + 1, navigableTxs.length - 1);
    if (navigableTxs[nextIdx]) {
      setSelectedTx(navigableTxs[nextIdx]);
      setDetailOpen(true);
    }
  }, [view, activeProject, navigableTxs, selectedTx]);
  const goPrevTx = useCallback(() => {
    if (view !== "list" || !activeProject) return;
    const currentIdx = selectedTx ? navigableTxs.findIndex(tx => tx.id === selectedTx.id) : navigableTxs.length;
    const prevIdx = Math.max(currentIdx - 1, 0);
    if (navigableTxs[prevIdx]) {
      setSelectedTx(navigableTxs[prevIdx]);
      setDetailOpen(true);
    }
  }, [view, activeProject, navigableTxs, selectedTx]);



  const handleSelectTx = (tx: Transaction) => {
    setSelectedTx(tx);
    setDetailOpen(true);
  };

  const handleBulkDelete = async (ids: string[]) => {
    for (const id of ids) {
      await deleteTransaction(id);
    }
  };

  const handleBulkEditOpen = (txs: Transaction[]) => {
    setBulkEditTxs(txs);
    if (txs.length > 0) {
      setSelectedTx(txs[0]);
      setDetailOpen(true);
    }
  };

  const handleNavigateTx = (tx: Transaction) => {
    setSelectedTx(tx);
  };

  // SPEC-TRANSACTION-FILES: Handle file upload for transaction attachments
  const handleUploadFileForTransaction = async (file: File, remark?: string, transactionId?: string) => {
    if (!activeProject?.id) {
      throw new Error("No active project");
    }
    await uploadFile({ file, remark, transactionId });
  };

  // SPEC-TRANSACTION-FILES: Handle clicking transaction link from file list
  const handleTransactionClickFromFile = (transactionId: string) => {
    const transaction = transactions.find(tx => tx.id === transactionId);
    if (transaction) {
      setSelectedTx(transaction);
      setDetailOpen(true);
    }
  };

  // SPEC-TRANSACTION-FILES: Handle viewing file in file manager from transaction detail
  const handleViewInFiles = (fileId?: string) => {
    setView("files");
    // TODO: Could add file highlighting functionality in the future
    // For now, just navigate to the files view
  };

  const goToList = useCallback(() => setView("list"), []);
  const goToCharts = useCallback(() => setView("charts"), []);
  const goToCash = useCallback(() => setView("cash"), []);
  const goToFile = useCallback(() => setView("files"), []);

  // Open period dropdown with '4'
  const openPeriodSelector = useCallback(() => {
    periodSelectorRef.current?.open();
  }, []);

  // Open category dropdown with '5'
  const openCategorySelector = useCallback(() => {
    categorySelectorRef.current?.open();
  }, []);

  useKeyboardShortcut("addTransaction", openAddTx, !!activeProject && !isViewer && noModalOpen, "addTransactionAlt");
  useKeyboardShortcut("tabList", goToList, !!activeProject && noModalOpen);
  useKeyboardShortcut("tabCharts", goToCharts, !!activeProject && noModalOpen);
  useKeyboardShortcut("tabCash", goToCash, !!activeProject && noModalOpen);
  useKeyboardShortcut("openPeriod", openPeriodSelector, !!activeProject && noModalOpen);
  useKeyboardShortcut("openCategory", openCategorySelector, !!activeProject && noModalOpen);
  useKeyboardShortcut("tabFiles", goToFile, !!activeProject && noModalOpen);
  
  // Allow navigation shortcuts even if detail sheet is open
  const canNavigate = !!activeProject && (noModalOpen || detailOpen);
  useKeyboardShortcut("nextTx", goNextTx, canNavigate, undefined, true);
  useKeyboardShortcut("prevTx", goPrevTx, canNavigate, undefined, true);

  // Show loading screen when loading and no project
  if (loading && !activeProject) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center py-20 text-center animate-fade-in">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">{t("global.loading")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/30 px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <ProjectSwitcher
              ref={projectSwitcherRef}
              projects={projects}
              active={activeProject}
              onSelect={setActiveProject}
              onCreate={createProject}
              onJoin={joinProject}
              isSystemAdmin={isSystemAdmin}
            />
            {activeProject && (
              <>
              <ExportTransactions
                transactions={filtered}
                headers={headers}
                customColumns={customColumns}
                isViewer={isViewer}
                categories={categories}
                projectCurrency={projectCurrency}
                onImport={!isViewer ? bulkAddTransactions : undefined}
              />
              {(isOwner || effectiveRole === "admin") && (
                <Button variant="ghost" size="icon" onClick={() => navigate("/admin")} className="text-muted-foreground hover:text-foreground">
                  <Settings className="h-4 w-4" />
                </Button>
              )}
              </>
            )}
          </div>
          <div className="flex items-center gap-1">
            <ShortcutSettings />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => hasPin ? setPinDisableDialogOpen(true) : setPinDialogOpen(true)}
              className="text-muted-foreground hover:text-foreground"
              title={hasPin ? t("lock.disable") : t("lock.enable")}
            >
              {hasPin ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocale(locale === "en" ? "ko" : "en")}
              className="text-muted-foreground hover:text-foreground"
            >
              <Globe className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
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
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <UserMenu />
          </div>
        </div>
        {activeProject && (
          <div className="flex items-center gap-2 mt-1">
            <p className="text-[10px] text-muted-foreground truncate flex-1">{activeProject.name}</p>
            {realOwner && isVisible && (
              <div className="flex items-center gap-0.5 shrink-0">
                <Eye className="h-3 w-3 text-muted-foreground" />
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
      </header>

      <main className="px-4 pt-4">
        {!activeProject ? (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
              <BarChart3 className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">{t("dash.getStarted")}</h2>
            <p className="mt-1 text-sm text-muted-foreground max-w-xs">
              {t("dash.getStartedDesc")}
            </p>
            <Button
              variant="default"
              size="lg"
              onClick={() => projectSwitcherRef.current?.openJoinTab()}
              className="mt-6 gradient-primary font-semibold"
            >
              <UserPlus className="mr-2 h-4 w-4" /> {t("dash.joinProject")}
            </Button>
          </div>
        ) : (
          <div className="animate-fade-in space-y-4">
            {/* Filters */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
              <PeriodSelector
                ref={periodSelectorRef}
                period={period}
                onPeriodChange={setPeriod}
                customRange={customRange}
                onCustomRangeChange={setCustomRange}
              />
              <CategorySelector
                ref={categorySelectorRef}
                categories={categories}
                selectedCategoryId={selectedCategoryId}
                onCategoryChange={setSelectedCategoryId}
              />
            </div>

            {/* Balance cards - project currency */}
            <div className="grid grid-cols-3 gap-2">
              <div className="glass-card p-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("dash.balance")}</p>
                <AmountText value={Math.abs(balance)} currency={projectCurrency} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div className="glass-card p-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("dash.income")}</p>
                <AmountText value={totalIncome} currency={projectCurrency} className="text-income" />
              </div>
              <div className="glass-card p-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("dash.expenses")}</p>
                <AmountText value={totalExpense} currency={projectCurrency} className="text-expense" />
              </div>
            </div>

            {/* Other currency totals */}
            {otherCurrencies.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {otherCurrencies.map((cur) => {
                  const t2 = currencyTotals[cur];
                  const bal = t2.income - t2.expense;
                  return (
                    <div key={cur} className="glass-card p-2.5 text-center">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{cur}</p>
                      <p className={`mt-0.5 text-sm font-bold text-purple-600 dark:text-purple-400`}>
                        {bal >= 0 ? "+" : "-"}{Math.abs(bal).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-[9px] text-muted-foreground">
                        +{t2.income.toLocaleString()} / -{t2.expense.toLocaleString()}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* View toggle */}
            <div className="flex gap-1 rounded-xl bg-muted/30 p-1">
              <button
                onClick={() => setView("list")}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-all ${
                  view === "list" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                <List className="h-3.5 w-3.5" /> {t("dash.transactions")}
              </button>
              <button
                onClick={() => setView("charts")}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-all ${
                  view === "charts" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                <BarChart3 className="h-3.5 w-3.5" /> {t("dash.charts")}
              </button>
              <button
                onClick={() => setView("cash")}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-all ${
                  view === "cash" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                <Calculator className="h-3.5 w-3.5" /> {t("cash.title")}
              </button>
              <button
                onClick={() => setView("files")}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-all ${
                  view === "files" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                <FileText className="h-3.5 w-3.5" /> {t("files.title")}
              </button>
            </div>

            {/* Content */}
            {view === "list" ? (
              <TransactionList ref={txListRef} transactions={filtered} categories={categories} onSelect={handleSelectTx} onBulkDelete={handleBulkDelete} onBulkEditOpen={handleBulkEditOpen} onTransactionDeleted={fetchTransactions} headers={headers} customColumns={customColumns} isViewer={isViewer} />
            ) : view === "charts" ? (
              <FinanceCharts transactions={chartTransactions} customColumns={customColumns} period={period} customRange={customRange} isViewer={isViewer} projectCurrency={projectCurrency} />
            ) : view === "cash" ? (
              <CashCalculator currency={projectCurrency} targetAmount={totalIncome} />
            ) : (
              <FileManager
                projectId={activeProject.id}
                canDelete={!isViewer && (isOwner || effectiveRole === "admin")}
                onTransactionClick={handleTransactionClickFromFile}
              />
            )}

            {/* FAB - hidden for viewers */}
            {!isViewer && <AddTransactionSheet categories={categories} onAdd={addTransaction} customColumns={customColumns} transactions={transactions} projectCurrency={projectCurrency} externalOpen={addTxOpen} onExternalOpenChange={setAddTxOpen} onUploadFile={handleUploadFileForTransaction} currentProjectId={activeProject?.id} />}

            {/* Detail sheet (also used for multi-edit with prev/next) */}
            <TransactionDetailSheet
              transaction={selectedTx}
              categories={categories}
              open={detailOpen}
              onOpenChange={(v) => {
                setDetailOpen(v);
                if (!v) setBulkEditTxs([]);
              }}
              onUpdate={updateTransaction}
              onDelete={deleteTransaction}
              customColumns={customColumns}
              isViewer={isViewer}
              transactionList={bulkEditTxs.length > 0 ? bulkEditTxs : navigableTxs}
              onNavigate={handleNavigateTx}
              allTransactions={transactions}
              projectId={activeProject?.id}
              onViewInFiles={handleViewInFiles}
            />
          </div>
        )}
      </main>
      <PinSetupDialog open={pinDialogOpen} onOpenChange={setPinDialogOpen} onComplete={() => setHasPin(true)} />
      <PinDisableDialog open={pinDisableDialogOpen} onOpenChange={setPinDisableDialogOpen} onDisableSuccess={handleRemovePin} />
    </div>
  );
};

export default Dashboard;
