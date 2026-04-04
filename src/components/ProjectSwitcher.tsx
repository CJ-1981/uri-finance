import { useState, useImperativeHandle, forwardRef } from "react";
import { Project } from "@/hooks/useProjects";
import { UserRole } from "@/hooks/useUserRole";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FolderOpen, Plus, UserPlus, Pencil, Check, X, GripVertical, Star } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { toast } from "sonner";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { useAuth } from "@/hooks/useAuth";

export interface ProjectSwitcherHandle {
  openJoinTab: () => void;
  openCreateTab: () => void;
}

// SPEC-PROJ-001: Sortable project item component with drag-and-drop
interface SortableProjectItemProps {
  project: Project;
  isActive: boolean;
  isOwner: boolean;
  isDefault: boolean;
  onSelect: (p: Project) => void;
  onSetDefault: (p: Project) => void;
  onEdit: (e: React.MouseEvent, p: Project) => void;
}

const SortableProjectItem = ({ project, isActive, isOwner, isDefault, onSelect, onSetDefault, onEdit }: SortableProjectItemProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: project.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`w-full text-left rounded-xl px-4 py-3 transition-all group relative outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        isActive ? "bg-primary/10 ring-1 ring-primary/30" : "bg-muted/30 hover:bg-muted/50"
      } ${isDragging ? "opacity-50" : ""}`}
    >
      {/* Drag Handle (owners only) */}
      {isOwner && (
        <div
          className="absolute left-2 top-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing p-2 touch-manipulation"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      )}

      {/* Project Info */}
      <div className={`pr-20 ${isOwner ? "pl-8" : ""}`}>
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm text-foreground">{project.name}</p>
          {isDefault && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary">Default</span>
          )}
        </div>
        {project.description && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{project.description}</p>
        )}
      </div>

      {/* Actions */}
      {isOwner && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => onSetDefault(project)}
            aria-label={isDefault ? "Remove default" : "Set as default"}
          >
            <Star className={`h-3.5 w-3.5 ${isDefault ? "fill-primary text-primary" : ""}`} />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={(e) => onEdit(e, project)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
};

interface Props {
  projects: Project[];
  active: Project | null;
  onSelect: (p: Project) => void;
  onCreate: (name: string, desc?: string) => Promise<void>;
  onUpdate: (id: string, updates: { name?: string; description?: string | null; currency?: string }) => Promise<boolean>;
  onJoin: (code: string) => Promise<void>;
  // SPEC-PROJ-001: New props for project preferences
  onUpdateProjectOrder?: (updates: Array<{project_id: string, display_order: number}>) => Promise<void>;
  onSetDefaultProject?: (projectId: string) => Promise<void>;
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
  onUpdateProjectOrder,
  onSetDefaultProject,
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

  // SPEC-PROJ-001: DnD sensors configuration
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required to start drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  // SPEC-PROJ-001: Handle drag end for project reordering
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = projects.findIndex((p) => p.id === active.id);
      const newIndex = projects.findIndex((p) => p.id === over.id);

      const newProjects = arrayMove(projects, oldIndex, newIndex);

      // Update display_order for affected projects
      const updates = newProjects.map((p, index) => ({
        project_id: p.id,
        display_order: index,
      }));

      // Persist to backend via the passed callback
      if (onUpdateProjectOrder && user) {
        try {
          await onUpdateProjectOrder(updates);
          toast.success(t("proj.orderUpdated"));
        } catch (error) {
          console.error('Failed to update project order:', error);
          toast.error(t("proj.onlyOwnerCanReorder"));
        }
      }

      // Note: The parent component will invalidate the query and refresh the project list
    }
  };

  // SPEC-PROJ-001: Handle set default project
  const handleSetDefault = async (project: Project) => {
    if (!onSetDefaultProject || !user) return;

    const isCurrentlyDefault = project.id === active?.id;

    try {
      await onSetDefaultProject(isCurrentlyDefault ? "" : project.id);
      if (isCurrentlyDefault) {
        toast.success(t("proj.removeDefault"));
      } else {
        toast.success(t("proj.defaultSet").replace("{name}", project.name));
      }
    } catch (error) {
      console.error('Failed to set default project:', error);
      toast.error(t("proj.onlyOwnerCanSetDefault"));
    }
  };

  // Handle Sheet open/close with proper focus management to prevent aria-hidden violations
  const handleSheetOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Blur the currently focused element before closing to prevent aria-hidden violation
      // This ensures Radix UI can properly hide the content without accessibility issues
      (document.activeElement as HTMLElement)?.blur();
    }
    setOpen(newOpen);
  };

  return (
    <Sheet open={open} onOpenChange={handleSheetOpenChange}>
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
            // SPEC-PROJ-001: Wrap in DndContext for drag-and-drop
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={projects.map(p => p.id)}
                strategy={verticalListSortingStrategy}
              >
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
                      // SPEC-PROJ-001: Check if this is the default project
                      const isDefault = active?.id === p.id;

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

                      // SPEC-PROJ-001: Use SortableProjectItem for non-editing items
                      return (
                        <SortableProjectItem
                          key={p.id}
                          project={p}
                          isActive={active?.id === p.id}
                          isOwner={isOwner}
                          isDefault={isDefault}
                          onSelect={handleSelect}
                          onSetDefault={handleSetDefault}
                          onEdit={startEditing}
                        />
                      );
                    })
                  )}
                </div>
              </SortableContext>
            </DndContext>
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
