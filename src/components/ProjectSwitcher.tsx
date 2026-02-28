import { useState } from "react";
import { Project } from "@/hooks/useProjects";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronDown, Plus, UserPlus, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface Props {
  projects: Project[];
  active: Project | null;
  onSelect: (p: Project) => void;
  onCreate: (name: string, desc?: string) => Promise<void>;
  onJoin: (code: string) => Promise<void>;
}

const ProjectSwitcher = ({ projects, active, onSelect, onCreate, onJoin }: Props) => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"list" | "create" | "join">("list");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await onCreate(name.trim(), desc.trim() || undefined);
    setName("");
    setDesc("");
    setTab("list");
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    await onJoin(code.trim());
    setCode("");
    setTab("list");
  };

  const copyInviteCode = () => {
    if (!active) return;
    navigator.clipboard.writeText(active.invite_code);
    setCopied(true);
    toast.success("Invite code copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="flex items-center gap-2 rounded-xl bg-muted/50 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors">
          {active?.name || "Select Project"}
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl bg-card border-border/50 px-6 pb-8 max-h-[80vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-foreground">Projects</SheetTitle>
        </SheetHeader>

        {/* Tab buttons */}
        <div className="mt-4 flex gap-2">
          {(["list", "create", "join"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-lg py-2 text-xs font-medium transition-all ${
                tab === t ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
              }`}
            >
              {t === "list" ? "My Projects" : t === "create" ? "Create New" : "Join"}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {tab === "list" && (
            <div className="space-y-2">
              {projects.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No projects yet. Create one or join with an invite code.
                </p>
              ) : (
                projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { onSelect(p); setOpen(false); }}
                    className={`w-full text-left rounded-xl px-4 py-3 transition-all ${
                      active?.id === p.id
                        ? "bg-primary/10 ring-1 ring-primary/30"
                        : "bg-muted/30 hover:bg-muted/50"
                    }`}
                  >
                    <p className="font-medium text-sm text-foreground">{p.name}</p>
                    {p.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{p.description}</p>
                    )}
                  </button>
                ))
              )}

              {/* Invite code display */}
              {active && (
                <div className="mt-4 rounded-xl bg-muted/30 p-4">
                  <p className="text-xs text-muted-foreground mb-2">
                    Share this invite code so others can join:
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded-lg bg-muted px-3 py-2 text-sm font-mono text-primary">
                      {active.invite_code}
                    </code>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={copyInviteCode}
                      className="h-9 w-9 text-muted-foreground hover:text-primary"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "create" && (
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">Project Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Household Budget"
                  required
                  className="bg-muted/50 border-border/50"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">Description (optional)</Label>
                <Input
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="What is this project for?"
                  className="bg-muted/50 border-border/50"
                />
              </div>
              <Button type="submit" className="w-full gradient-primary font-semibold text-primary-foreground">
                <Plus className="mr-2 h-4 w-4" /> Create Project
              </Button>
            </form>
          )}

          {tab === "join" && (
            <form onSubmit={handleJoin} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">Invite Code</Label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Enter invite code"
                  required
                  className="bg-muted/50 border-border/50 font-mono"
                />
              </div>
              <Button type="submit" className="w-full gradient-primary font-semibold text-primary-foreground">
                <UserPlus className="mr-2 h-4 w-4" /> Join Project
              </Button>
            </form>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ProjectSwitcher;
