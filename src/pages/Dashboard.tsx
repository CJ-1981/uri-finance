import { useState, useMemo, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProjects } from "@/hooks/useProjects";
import { useTransactions, Transaction } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { useColumnHeaders } from "@/hooks/useColumnHeaders";
import { useCustomColumns } from "@/hooks/useCustomColumns";
import { useUserRole } from "@/hooks/useUserRole";
import { useI18n } from "@/hooks/useI18n";
import ProjectSwitcher from "@/components/ProjectSwitcher";
import AddTransactionSheet from "@/components/AddTransactionSheet";
import TransactionList from "@/components/TransactionList";
import TransactionDetailSheet from "@/components/TransactionDetailSheet";
import FinanceCharts from "@/components/FinanceCharts";
import ExportTransactions from "@/components/ExportTransactions";
import PeriodSelector, { PeriodKey, DateRange, filterByPeriod } from "@/components/PeriodSelector";
import PinSetupDialog from "@/components/PinSetupDialog";
import { Button } from "@/components/ui/button";
import { LogOut, BarChart3, List, Sun, Moon, Settings, Globe, Lock, LockOpen, Eye } from "lucide-react";
import ShortcutSettings from "@/components/ShortcutSettings";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import { UserRole } from "@/hooks/useUserRole";
import { useTheme } from "next-themes";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
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
  const { user, signOut } = useAuth();
  const { projects, activeProject, setActiveProject, createProject, joinProject } = useProjects();
  const { transactions, addTransaction, updateTransaction, deleteTransaction, bulkAddTransactions } = useTransactions(activeProject?.id);
  const { categories } = useCategories(activeProject?.id);
  const { headers } = useColumnHeaders(activeProject?.id);
  const { columns: customColumns } = useCustomColumns(activeProject?.id);
  const { isViewer, effectiveRole, isSimulating, simulatedRole, setSimulatedRole } = useUserRole(activeProject?.id);
  const { t, locale, setLocale } = useI18n();
  const [view, setView] = useState<"list" | "charts">("list");
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [period, setPeriod] = useState<PeriodKey>("all");
  const [customRange, setCustomRange] = useState<DateRange>({ from: undefined, to: undefined });
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const realOwner = activeProject && user && activeProject.owner_id === user.id;
  const isOwner = !isSimulating && realOwner;
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [hasPin, setHasPin] = useState(!!localStorage.getItem("app_lock_pin"));
  const [addTxOpen, setAddTxOpen] = useState(false);

  const openAddTx = useCallback(() => {
    if (activeProject && !isViewer) setAddTxOpen(true);
  }, [activeProject, isViewer]);

  useKeyboardShortcut("addTransaction", openAddTx, !!activeProject && !isViewer);


  const handleRemovePin = () => {
    localStorage.removeItem("app_lock_pin");
    setHasPin(false);
    toast.success(t("lock.pinRemoved"));
  };

  // Filter transactions by selected period
  const filtered = useMemo(
    () => filterByPeriod(transactions, period, customRange),
    [transactions, period, customRange]
  );

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
  const visibleTxs = filtered.slice(0, 20);

  const goNextTx = useCallback(() => {
    if (view !== "list" || !activeProject || detailOpen) return;
    const currentIdx = selectedTx ? visibleTxs.findIndex(tx => tx.id === selectedTx.id) : -1;
    const nextIdx = Math.min(currentIdx + 1, visibleTxs.length - 1);
    if (visibleTxs[nextIdx]) {
      setSelectedTx(visibleTxs[nextIdx]);
      setDetailOpen(true);
    }
  }, [view, activeProject, detailOpen, visibleTxs, selectedTx]);

  const goPrevTx = useCallback(() => {
    if (view !== "list" || !activeProject || detailOpen) return;
    const currentIdx = selectedTx ? visibleTxs.findIndex(tx => tx.id === selectedTx.id) : visibleTxs.length;
    const prevIdx = Math.max(currentIdx - 1, 0);
    if (visibleTxs[prevIdx]) {
      setSelectedTx(visibleTxs[prevIdx]);
      setDetailOpen(true);
    }
  }, [view, activeProject, detailOpen, visibleTxs, selectedTx]);

  useKeyboardShortcut("nextTransaction", goNextTx, !!activeProject && view === "list" && !detailOpen);
  useKeyboardShortcut("prevTransaction", goPrevTx, !!activeProject && view === "list" && !detailOpen);

  const [bulkEditTxs, setBulkEditTxs] = useState<Transaction[]>([]);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);

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

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/30 px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <ProjectSwitcher
              projects={projects}
              active={activeProject}
              onSelect={setActiveProject}
              onCreate={createProject}
              onJoin={joinProject}
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
              {isOwner && (
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
              onClick={() => hasPin ? handleRemovePin() : setPinDialogOpen(true)}
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
            <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="text-muted-foreground hover:text-foreground">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut} className="text-muted-foreground hover:text-foreground">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {activeProject && (
          <div className="flex items-center gap-2 mt-1">
            <p className="text-[10px] text-muted-foreground truncate flex-1">{activeProject.name}</p>
            {realOwner && (
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
          </div>
        ) : (
          <div className="animate-fade-in space-y-4">
            {/* Period selector */}
            <PeriodSelector
              period={period}
              onPeriodChange={setPeriod}
              customRange={customRange}
              onCustomRangeChange={setCustomRange}
            />

            {/* Balance cards - project currency */}
            <div className="grid grid-cols-3 gap-2">
              <div className="glass-card p-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("dash.balance")}</p>
                <p className={`mt-1 text-lg font-bold ${balance >= 0 ? "text-income" : "text-expense"}`}>
                  {projectCurrency} {Math.abs(balance).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="glass-card p-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("dash.income")}</p>
                <p className="mt-1 text-lg font-bold text-income">
                  {projectCurrency} {totalIncome.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="glass-card p-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("dash.expenses")}</p>
                <p className="mt-1 text-lg font-bold text-expense">
                  {projectCurrency} {totalExpense.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
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
                      <p className={`mt-0.5 text-sm font-bold ${bal >= 0 ? "text-income" : "text-expense"}`}>
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
            </div>

            {/* Content */}
            {view === "list" ? (
              <TransactionList transactions={filtered} categories={categories} onSelect={handleSelectTx} onBulkDelete={handleBulkDelete} onBulkEditOpen={handleBulkEditOpen} headers={headers} customColumns={customColumns} isViewer={isViewer} />
            ) : (
              <FinanceCharts transactions={chartTransactions} customColumns={customColumns} period={period} customRange={customRange} isViewer={isViewer} projectCurrency={projectCurrency} />
            )}

            {/* FAB - hidden for viewers */}
            {!isViewer && <AddTransactionSheet categories={categories} onAdd={addTransaction} customColumns={customColumns} transactions={transactions} projectCurrency={projectCurrency} externalOpen={addTxOpen} onExternalOpenChange={setAddTxOpen} />}

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
              transactionList={bulkEditTxs.length > 0 ? bulkEditTxs : undefined}
              onNavigate={handleNavigateTx}
              allTransactions={transactions}
            />
          </div>
        )}
      </main>
      <PinSetupDialog open={pinDialogOpen} onOpenChange={setPinDialogOpen} onComplete={() => setHasPin(true)} />
    </div>
  );
};

export default Dashboard;
