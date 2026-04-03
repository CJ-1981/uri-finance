import { useState, useImperativeHandle, forwardRef } from "react";
import { Project } from "@/hooks/useProjects";
import { UserRole } from "@/hooks/useUserRole";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FolderOpen, Plus, UserPlus, Pencil, Check, X } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { toast } from "sonner";

import { useAuth } from "@/hooks/useAuth";

export interface ProjectSwitcherHandle {
  openJoinTab: () => void;
  openCreateTab: () => void;
}

interface Props {
  projects: Project[];
  active: Project | null;
  onSelect: (p: Project) => void;
  onCreate: (name: string, desc?: string) => Promise<void>;
  onUpdate: (id: string, updates: { name?: string; description?: string | null; currency?: string }) => Promise<boolean>;
  onJoin: (code: string) => Promise<void>;
  isSystemAdmin?: boolean;
  isSimulating?: boolean;
  simulatedRole?: UserRole | null;
}

const ProjectSwitcher = forwardRef<ProjectSwitcherHandle, Props>(({ 
  projects, 
  active, 
  onSelect, 
  onCreate, 
  onUpdate, 
  onJoin, 
  isSystemAdmin = false,
  isSimulating = false,
  simulatedRole = null
}, ref) => {
  const { isStandalone, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"list" | "create" | "join">("list");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [code, setCode] = useState("");
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const { t } = useI18n();
  const isOnline = useOnlineStatus();

  const blockWhenOffline = (actionKey: string): boolean => {
    if (isStandalone) return false;
    if (!isOnline) {
      const actionMap: Record<string, string> = {
        "switch": t("proj.offlineSwitch") || "Cannot switch projects while offline",
        "create": t("proj.offlineCreate") || "Cannot create projects while offline",
        "join": t("proj.offlineJoin") || "Cannot join projects while offline",
        "delete": t("proj.offlineDelete") || "Cannot delete projects while offline",
      };
      toast.error(actionMap[actionKey] || t("proj.offlineError") || "Action cannot be performed while offline");
      return true;
    }
    return false;
  };

  useImperativeHandle(ref, () => ({
    openJoinTab: () => {
      if (isStandalone || blockWhenOffline("join")) return;
      setTab("join");
      setOpen(true);
    },
    openCreateTab: () => {
      if (blockWhenOffline("create")) return;
      setTab("create");
      setOpen(true);
    },
  }));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (blockWhenOffline("create")) return;
    if (!name.trim()) return;
    await onCreate(name.trim(), desc.trim() || undefined);
    setName("");
    setDesc("");
    setTab("list");
    setOpen(false);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isStandalone || blockWhenOffline("join")) return;
    if (!code.trim()) return;
    await onJoin(code.trim());
    setCode("");
    setTab("list");
    setOpen(false);
  };

  const handleSelect = (p: Project) => {
    if (active?.id !== p.id && blockWhenOffline("switch")) return;
    onSelect(p);
    setOpen(false);
  };

  const startEditing = (e: React.MouseEvent, p: Project) => {
    e.stopPropagation();
    setEditingProjectId(p.id);
    setEditName(p.name);
    setEditDesc(p.description || "");
  };

  const cancelEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProjectId(null);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProjectId) return;
    if (!editName.trim()) return;
    
    const success = await onUpdate(editingProjectId, { 
      name: editName.trim(), 
      description: editDesc.trim() || null 
    });
    
    if (success) {
      setEditingProjectId(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-muted-foreground hover:text-foreground" 
          title={active?.name || t("proj.selectProject")}
          data-testid="project-switcher-trigger"
        >
          <FolderOpen className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent 
        side="bottom" 
        className="rounded-t-3xl bg-card border-border/50 px-6 pb-8 max-h-[80vh] overflow-y-auto"
        data-testid="project-switcher-content"
      >
        <SheetHeader>
          <SheetTitle className="text-foreground">{t("proj.projects")}</SheetTitle>
          <SheetDescription className="sr-only">{t("proj.projectsDesc")}</SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex gap-2">
          {([
            { key: "list" as const, label: t("proj.myProjects") },
            ...(isSystemAdmin ? [{ key: "create" as const, label: t("proj.createNew") }] : []),
            ...(!isStandalone ? [{ key: "join" as const, label: t("proj.join") }] : []),
          ]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 rounded-lg py-2 text-xs font-medium transition-all ${
                tab === key ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {tab === "list" && (
            <div className="space-y-2">
              {projects.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {t(isStandalone ? "proj.noProjectsStandalone" : "proj.noProjects")}
                </p>
              ) : (
                projects.map((p) => {
                  const realOwner = isStandalone || (user && p.owner_id === user.id);
                  const isOwner = isSimulating ? simulatedRole === "owner" : realOwner;
                  const isEditing = editingProjectId === p.id;

                  if (isEditing) {
                    return (
                      <div key={p.id} className="w-full rounded-xl px-4 py-3 bg-primary/5 ring-1 ring-primary/30 space-y-3">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] text-muted-foreground uppercase">{t("proj.projectName")}</Label>
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder={t("proj.projectNamePlaceholder")}
                            className="h-8 text-sm"
                            autoFocus
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] text-muted-foreground uppercase">{t("proj.descriptionOptional")}</Label>
                          <Input
                            value={editDesc}
                            onChange={(e) => setEditDesc(e.target.value)}
                            placeholder={t("proj.descriptionPlaceholder")}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="flex gap-2 pt-1">
                          <Button size="sm" className="flex-1 h-8" onClick={handleUpdate}>
                            <Check className="h-3.5 w-3.5 mr-1" /> {t("admin.save")}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8" onClick={cancelEditing}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={p.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleSelect(p)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleSelect(p);
                        }
                      }}
                      className={`w-full text-left rounded-xl px-4 py-3 transition-all group relative cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        active?.id === p.id
                          ? "bg-primary/10 ring-1 ring-primary/30"
                          : "bg-muted/30 hover:bg-muted/50"
                      }`}
                    >
                      <div className="pr-8">
                        <p className="font-medium text-sm text-foreground">{p.name}</p>
                        {p.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{p.description}</p>
                        )}
                      </div>
                      {isOwner && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={(e) => startEditing(e, p)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  );
                }))}
            </div>
          )}

          {tab === "create" && isSystemAdmin && (
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">{t("proj.projectName")}</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("proj.projectNamePlaceholder")}
                  required
                  className="bg-muted/50 border-border/50"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">{t("proj.descriptionOptional")}</Label>
                <Input
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder={t("proj.descriptionPlaceholder")}
                  className="bg-muted/50 border-border/50"
                />
              </div>
              <Button type="submit" className="w-full gradient-primary font-semibold text-primary-foreground">
                <Plus className="mr-2 h-4 w-4" /> {t("proj.createProject")}
              </Button>
            </form>
          )}

          {tab === "join" && !isStandalone && (
            <form onSubmit={handleJoin} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">{t("proj.inviteCode")}</Label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder={t("proj.enterInviteCode")}
                  required
                  className="bg-muted/50 border-border/50 font-mono"
                />
              </div>
              <Button type="submit" className="w-full gradient-primary font-semibold text-primary-foreground">
                <UserPlus className="mr-2 h-4 w-4" /> {t("proj.joinProject")}
              </Button>
            </form>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
});

ProjectSwitcher.displayName = "ProjectSwitcher";

export default ProjectSwitcher;

