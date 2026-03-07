import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProjects } from "@/hooks/useProjects";
import { useTransactions, Transaction } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import ProjectSwitcher from "@/components/ProjectSwitcher";
import AddTransactionSheet from "@/components/AddTransactionSheet";
import TransactionList from "@/components/TransactionList";
import TransactionDetailSheet from "@/components/TransactionDetailSheet";
import CategoryManager from "@/components/CategoryManager";
import FinanceCharts from "@/components/FinanceCharts";
import { Button } from "@/components/ui/button";
import { LogOut, BarChart3, List, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const { projects, activeProject, setActiveProject, createProject, joinProject } = useProjects();
  const { transactions, addTransaction, updateTransaction, deleteTransaction, totalIncome, totalExpense, balance } = useTransactions(activeProject?.id);
  const { categories, addCategory, deleteCategory } = useCategories(activeProject?.id);
  const [view, setView] = useState<"list" | "charts">("list");
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const handleSelectTx = (tx: Transaction) => {
    setSelectedTx(tx);
    setDetailOpen(true);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/30 px-4 py-3">
        <div className="flex items-center justify-between">
          <ProjectSwitcher
            projects={projects}
            active={activeProject}
            onSelect={setActiveProject}
            onCreate={createProject}
            onJoin={joinProject}
          />
          <div className="flex items-center gap-1">
            {activeProject && (
              <CategoryManager
                categories={categories}
                onAdd={addCategory}
                onDelete={deleteCategory}
              />
            )}
            <Button variant="ghost" size="icon" onClick={signOut} className="text-muted-foreground hover:text-foreground">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="px-4 pt-4">
        {!activeProject ? (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
              <BarChart3 className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Get Started</h2>
            <p className="mt-1 text-sm text-muted-foreground max-w-xs">
              Create a project or join one with an invite code to start tracking finances together.
            </p>
          </div>
        ) : (
          <div className="animate-fade-in space-y-4">
            {/* Balance cards */}
            <div className="grid grid-cols-3 gap-2">
              <div className="glass-card p-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Balance</p>
                <p className={`mt-1 text-lg font-bold ${balance >= 0 ? "text-income" : "text-expense"}`}>
                  ${Math.abs(balance).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="glass-card p-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Income</p>
                <p className="mt-1 text-lg font-bold text-income">
                  ${totalIncome.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="glass-card p-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Expenses</p>
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
                <List className="h-3.5 w-3.5" /> Transactions
              </button>
              <button
                onClick={() => setView("charts")}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-all ${
                  view === "charts" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                <BarChart3 className="h-3.5 w-3.5" /> Charts
              </button>
            </div>

            {/* Content */}
            {view === "list" ? (
              <TransactionList transactions={transactions} onSelect={handleSelectTx} />
            ) : (
              <FinanceCharts transactions={transactions} />
            )}

            {/* FAB */}
            <AddTransactionSheet categories={categories} onAdd={addTransaction} />

            {/* Detail sheet */}
            <TransactionDetailSheet
              transaction={selectedTx}
              categories={categories}
              open={detailOpen}
              onOpenChange={setDetailOpen}
              onUpdate={updateTransaction}
              onDelete={deleteTransaction}
            />
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
