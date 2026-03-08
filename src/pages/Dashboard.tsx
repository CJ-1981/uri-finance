import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProjects } from "@/hooks/useProjects";
import { useTransactions, Transaction } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { useColumnHeaders } from "@/hooks/useColumnHeaders";
import { useCustomColumns } from "@/hooks/useCustomColumns";
import { useI18n } from "@/hooks/useI18n";
import ProjectSwitcher from "@/components/ProjectSwitcher";
import AddTransactionSheet from "@/components/AddTransactionSheet";
import TransactionList from "@/components/TransactionList";
import TransactionDetailSheet from "@/components/TransactionDetailSheet";
import BulkEditSheet from "@/components/BulkEditSheet";
import FinanceCharts from "@/components/FinanceCharts";
import ExportTransactions from "@/components/ExportTransactions";
import PeriodSelector, { PeriodKey, DateRange, filterByPeriod } from "@/components/PeriodSelector";
import PinSetupDialog from "@/components/PinSetupDialog";
import { Button } from "@/components/ui/button";
import { LogOut, BarChart3, List, Sun, Moon, Settings, Globe, Lock, LockOpen } from "lucide-react";
import { useTheme } from "next-themes";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const { projects, activeProject, setActiveProject, createProject, joinProject } = useProjects();
  const { transactions, addTransaction, updateTransaction, deleteTransaction } = useTransactions(activeProject?.id);
  const { categories } = useCategories(activeProject?.id);
  const { headers } = useColumnHeaders(activeProject?.id);
  const { columns: customColumns } = useCustomColumns(activeProject?.id);
  const { t, locale, setLocale } = useI18n();
  const [view, setView] = useState<"list" | "charts">("list");
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [period, setPeriod] = useState<PeriodKey>("all");
  const [customRange, setCustomRange] = useState<DateRange>({ from: undefined, to: undefined });
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const isOwner = activeProject && user && activeProject.owner_id === user.id;
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [hasPin, setHasPin] = useState(!!localStorage.getItem("app_lock_pin"));

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

  const totalIncome = useMemo(
    () => filtered.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0),
    [filtered]
  );
  const totalExpense = useMemo(
    () => filtered.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0),
    [filtered]
  );
  const balance = totalIncome - totalExpense;

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
    setBulkEditOpen(true);
  };

  const handleBulkUpdate = async (ids: string[], updates: Partial<Pick<Transaction, "type" | "category">>) => {
    for (const id of ids) {
      await updateTransaction(id, updates);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/30 px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {activeProject && (
              <>
              <ExportTransactions transactions={filtered} headers={headers} customColumns={customColumns} />
              {isOwner && (
                <Button variant="ghost" size="icon" onClick={() => navigate("/admin")} className="text-muted-foreground hover:text-foreground">
                  <Settings className="h-4 w-4" />
                </Button>
              )}
              </>
            )}
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
          <ProjectSwitcher
            projects={projects}
            active={activeProject}
            onSelect={setActiveProject}
            onCreate={createProject}
            onJoin={joinProject}
          />
        </div>
        {activeProject && (
          <p className="text-[10px] text-muted-foreground truncate mt-1">{activeProject.name}</p>
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

            {/* Balance cards */}
            <div className="grid grid-cols-3 gap-2">
              <div className="glass-card p-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("dash.balance")}</p>
                <p className={`mt-1 text-lg font-bold ${balance >= 0 ? "text-income" : "text-expense"}`}>
                  ${Math.abs(balance).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="glass-card p-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("dash.income")}</p>
                <p className="mt-1 text-lg font-bold text-income">
                  ${totalIncome.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="glass-card p-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("dash.expenses")}</p>
                <p className="mt-1 text-lg font-bold text-expense">
                  ${totalExpense.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

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
              <TransactionList transactions={filtered} onSelect={handleSelectTx} onBulkDelete={handleBulkDelete} onBulkEditOpen={handleBulkEditOpen} headers={headers} customColumns={customColumns} />
            ) : (
              <FinanceCharts transactions={filtered} customColumns={customColumns} />
            )}

            {/* FAB */}
            <AddTransactionSheet categories={categories} onAdd={addTransaction} customColumns={customColumns} />

            {/* Detail sheet */}
            <TransactionDetailSheet
              transaction={selectedTx}
              categories={categories}
              open={detailOpen}
              onOpenChange={setDetailOpen}
              onUpdate={updateTransaction}
              onDelete={deleteTransaction}
              customColumns={customColumns}
            />

            {/* Bulk edit sheet */}
            <BulkEditSheet
              transactions={bulkEditTxs}
              categories={categories}
              open={bulkEditOpen}
              onOpenChange={setBulkEditOpen}
              onBulkUpdate={handleBulkUpdate}
            />
          </div>
        )}
      </main>
      <PinSetupDialog open={pinDialogOpen} onOpenChange={setPinDialogOpen} onComplete={() => setHasPin(true)} />
    </div>
  );
};

export default Dashboard;
