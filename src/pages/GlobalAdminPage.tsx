import { useState } from "react";
import { useGlobalAdmin } from "@/hooks/useGlobalAdmin";
import { useSystemAdmin } from "@/hooks/useSystemAdmin";
import { useI18n } from "@/hooks/useI18n";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, User, FolderOpen, Trash2, Mail, Calendar, Users, Database, RefreshCw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const GlobalAdminPage = () => {
  const { users, projects, loading, removeUserFromAllProjects, deleteProject, fetchAllData } = useGlobalAdmin();
  const { isSystemAdmin } = useSystemAdmin();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"users" | "projects">("users");

  // Redirect non-admin users
  if (!isSystemAdmin) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <Database className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">{t("admin.ownerOnly")}</p>
        <Button variant="outline" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> {t("admin.backToDashboard")}
        </Button>
      </div>
    );
  }

  const handleRemoveUser = async (userId: string, email: string) => {
    const confirmed = window.confirm(
      t("global.removeUserConfirm").replace("{email}", email)
    );
    if (!confirmed) return;
    await removeUserFromAllProjects(userId);
  };

  const handleDeleteProject = async (projectId: string, projectName: string) => {
    const confirmed = window.confirm(
      t("global.deleteProjectConfirm").replace("{project}", projectName)
    );
    if (!confirmed) return;
    await deleteProject(projectId, projectName);
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return format(date, "yyyy-MM-dd");
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/30 px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-sm font-semibold text-foreground">{t("global.title")}</h1>
            <p className="text-xs text-muted-foreground">{t("global.subtitle")}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAllData}
            disabled={loading}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            {t("global.refresh")}
          </Button>
        </div>
      </header>

      <main className="px-4 pt-6 max-w-6xl mx-auto">
        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab("users")}
            className={cn(
              "flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all",
              activeTab === "users"
                ? "bg-primary text-primary-foreground"
                : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
            )}
          >
            <Users className="h-4 w-4 mr-2" />
            {t("global.usersTab")}
          </button>
          <button
            onClick={() => setActiveTab("projects")}
            className={cn(
              "flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all",
              activeTab === "projects"
                ? "bg-primary text-primary-foreground"
                : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
            )}
          >
            <FolderOpen className="h-4 w-4 mr-2" />
            {t("global.projectsTab")}
          </button>
        </div>

        {loading ? (
          <div className="min-h-screen flex flex-col items-center justify-center py-20 text-center animate-fade-in">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">{t("global.loading")}</p>
          </div>
        ) : activeTab === "users" ? (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-foreground mb-4">{t("global.users")}</h2>
            {users.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">{t("global.noUsers")}</div>
            ) : (
              <div className="space-y-3">
                {users.map((user) => (
                  <div key={user.id} className="rounded-xl border border-border/50 bg-card p-4">
                    <div className="flex flex-col gap-3">
                      {/* Email */}
                      <div className="flex items-start gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <span className="text-sm text-foreground break-all">{user.email}</span>
                      </div>

                      {/* Projects list */}
                      <div>
                        <p className="text-xs text-muted-foreground mb-1.5">
                          {user.project_count} {user.project_count === 1 ? t("global.project") : t("global.projects")}
                        </p>
                        {user.projects && user.projects.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {user.projects.map((proj: { id: string; name: string }) => (
                              <span
                                key={proj.id}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-primary/10 text-primary text-xs"
                              >
                                <FolderOpen className="h-3 w-3" />
                                {proj.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">{t("global.noProjects")}</span>
                        )}
                      </div>

                      {/* Created date and delete button */}
                      <div className="flex items-center justify-between pt-2 border-t border-border/30">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{formatDate(user.created_at)}</span>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRemoveUser(user.id, user.email)}
                          className="h-7 px-3 text-xs"
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          {t("global.removeUser")}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-foreground mb-4">{t("global.projects")}</h2>
            {projects.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">{t("global.noProjects")}</div>
            ) : (
              <div className="space-y-3">
                {projects.map((project) => (
                  <div key={project.id} className="rounded-xl border border-border/50 bg-card p-4">
                    <div className="flex flex-col gap-3">
                      {/* Project name */}
                      <div className="flex items-start gap-2">
                        <FolderOpen className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <span className="text-sm text-foreground">{project.name}</span>
                      </div>

                      {/* Owner */}
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground break-all">{project.owner_email}</span>
                      </div>

                      {/* Stats grid */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-muted/30 px-3 py-2">
                          <p className="text-[10px] text-muted-foreground">{t("global.projectMembers")}</p>
                          <p className="text-sm font-semibold text-foreground">{project.member_count}</p>
                        </div>
                        <div className="rounded-lg bg-muted/30 px-3 py-2">
                          <p className="text-[10px] text-muted-foreground">{t("global.projectTransactions")}</p>
                          <p className="text-sm font-semibold text-foreground">{project.transaction_count}</p>
                        </div>
                      </div>

                      {/* Created date and delete button */}
                      <div className="flex items-center justify-between pt-2 border-t border-border/30">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{formatDate(project.created_at)}</span>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteProject(project.id, project.name)}
                          className="h-7 px-3 text-xs"
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          {t("global.deleteProject")}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default GlobalAdminPage;
