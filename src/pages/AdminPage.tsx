import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProjects } from "@/hooks/useProjects";
import { useCategories } from "@/hooks/useCategories";
import { useColumnHeaders } from "@/hooks/useColumnHeaders";
import { useCustomColumns } from "@/hooks/useCustomColumns";
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
  const { projects, activeProject } = useProjects();
  const { categories, addCategory, deleteCategory } = useCategories(activeProject?.id);
  const { headers, updateHeader, resetHeaders } = useColumnHeaders(activeProject?.id);
  const { columns: customColumns, addColumn, deleteColumn } = useCustomColumns(activeProject?.id);
  const navigate = useNavigate();

  const isOwner = activeProject && user && activeProject.owner_id === user.id;

  if (!activeProject) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">No active project selected.</p>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <ShieldCheck className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">Only the project owner can access this page.</p>
        <Button variant="outline" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
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
            <h1 className="text-sm font-semibold text-foreground">Project Settings</h1>
            <p className="text-xs text-muted-foreground">{activeProject.name}</p>
          </div>
        </div>
      </header>

      <main className="px-4 pt-6 max-w-lg mx-auto space-y-8">
        {/* Column Headers Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Column Headers</h2>
              <p className="text-xs text-muted-foreground">Customize transaction column names for display and exports.</p>
            </div>
            <Button variant="outline" size="sm" onClick={resetHeaders} className="text-xs">
              Reset
            </Button>
          </div>
          <div className="grid gap-3 rounded-xl border border-border/50 bg-card p-4">
            {(["date", "type", "category", "description", "amount"] as const).map((key) => (
              <div key={key} className="flex items-center gap-3">
                <label className="w-24 text-xs text-muted-foreground capitalize">{key}</label>
                <input
                  value={headers[key]}
                  onChange={(e) => updateHeader(key, e.target.value)}
                  className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder={key.charAt(0).toUpperCase() + key.slice(1)}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Custom Numeric Columns */}
        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Custom Numeric Columns</h2>
            <p className="text-xs text-muted-foreground">Add extra numeric fields to transactions (e.g. Tax, Discount, Quantity).</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card p-4">
            <CustomColumnManager columns={customColumns} onAdd={addColumn} onDelete={deleteColumn} />
          </div>
        </section>

        {/* Categories Section */}
        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Categories</h2>
            <p className="text-xs text-muted-foreground">Manage transaction categories for this project.</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card p-4">
            <CategoryManager
              categories={categories}
              onAdd={addCategory}
              onDelete={deleteCategory}
              inline
            />
          </div>
        </section>

        {/* Project Info */}
        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Project Info</h2>
            <p className="text-xs text-muted-foreground">Share the invite code with team members.</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card p-4 space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-24">Invite Code</span>
              <code className="flex-1 rounded-lg bg-muted px-3 py-2 text-sm font-mono text-foreground">
                {activeProject.invite_code}
              </code>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-24">Currency</span>
              <span className="text-sm text-foreground">{activeProject.currency}</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default AdminPage;
