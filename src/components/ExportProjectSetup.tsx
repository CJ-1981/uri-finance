import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Download, Upload, Info, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Category } from "@/hooks/useCategories";
import { CustomColumn } from "@/hooks/useCustomColumns";
import { ColumnHeaders } from "@/hooks/useColumnHeaders";
import { useI18n } from "@/hooks/useI18n";
import { useAuth } from "@/hooks/useAuth";
import { Project } from "@/hooks/useProjects";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Props {
  categories: Category[];
  customColumns: CustomColumn[];
  columnHeaders: ColumnHeaders;
  currency: string;
  projectId: string;
  onCategoriesRefresh: () => Promise<void>;
  onColumnsRefresh: () => Promise<void>;
  onProjectRefresh?: () => Promise<void>;
}

interface ProjectSetupExport {
  version: string;
  exportedAt: string;
  currency: string;
  columnHeaders: ColumnHeaders;
  categories: Array<{
    name: string;
    code: string;
    icon: string;
    sort_order: number;
    parent_code?: string;
    parent_name?: string;
  }>;
  customColumns: Array<{
    name: string;
    column_type: "numeric" | "text" | "list";
    masked: boolean;
    required: boolean;
    sort_order: number;
    suggestions: string[];
    suggestion_colors: Record<string, string>;
  }>;
}

const ExportProjectSetup = ({
  categories,
  customColumns,
  columnHeaders,
  currency,
  projectId,
  onCategoriesRefresh,
  onColumnsRefresh,
  onProjectRefresh,
}: Props) => {
  const { t } = useI18n();
  const { isStandalone } = useAuth();
  const [importing, setImporting] = useState(false);
  const [useSample, setUseSample] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getExportTimestamp = () => {
    const now = new Date();
    const date = now.toISOString().split("T")[0];
    const time = now.toTimeString().split(" ")[0].replace(/:/g, "-");
    return `${date}_${time}`;
  };

  const handleExport = () => {
    const exportData: ProjectSetupExport = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      currency,
      columnHeaders,
      categories: categories.map((cat) => {
        const parent = categories.find(c => c.id === cat.parent_id);
        return {
          name: cat.name,
          code: cat.code,
          icon: cat.icon,
          sort_order: cat.sort_order,
          parent_code: parent?.code,
          parent_name: parent?.name,
        };
      }),
      customColumns: customColumns.map((col) => ({
        name: col.name,
        column_type: col.column_type,
        masked: col.masked,
        required: col.required,
        sort_order: col.sort_order,
        suggestions: col.suggestions,
        suggestion_colors: col.suggestion_colors,
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `project_setup_${getExportTimestamp()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t("setup.exported") || "Project setup exported");
  };

  const handleImportClick = async () => {
    if (useSample) {
      setImporting(true);
      try {
        const response = await fetch("/demo-project-setup.json");
        if (!response.ok) {
          throw new Error(`Failed to fetch demo setup: ${response.status} ${response.statusText}`);
        }
        const demoData = await response.json();
        await performImport(demoData);
      } catch (err) {
        toast.error("Failed to import demo project setup: " + (err instanceof Error ? err.message : String(err)));
      } finally {
        setImporting(false);
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleImportChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const importData: ProjectSetupExport = JSON.parse(text);
      await performImport(importData);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(`${t("setup.importError") || "Failed to import project setup"}: ${errorMessage}`);
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const performImport = async (importData: ProjectSetupExport) => {
    // Validate structure
    if (!importData.categories || !importData.customColumns) {
      throw new Error(t("setup.invalidFormat") || "Invalid file format");
    }

    if (isStandalone) {
      // --- Standalone Mode Import ---
      const LOCAL_CATEGORIES_KEY = `local_categories_${projectId}`;
      const LOCAL_COLUMNS_KEY = `local_custom_columns_${projectId}`;
      const LOCAL_PROJECTS_KEY = "local_projects";
      const ACTIVE_PROJECT_CACHE_KEY = "active_project_cache";

      // Import categories
      const categoryMap = new Map<string, string>(); // (code, name) -> id
      const processedCategories: Category[] = [];

      // Pass 1: Create all categories with new IDs
      for (const cat of importData.categories) {
        const id = crypto.randomUUID();
        processedCategories.push({
          id,
          project_id: projectId,
          name: cat.name,
          code: cat.code,
          icon: cat.icon,
          sort_order: cat.sort_order,
          parent_id: null,
          created_at: new Date().toISOString(),
        });
        const key = `${cat.parent_code || ""}-${cat.parent_name || ""}-${cat.code || ""}-${cat.name}`;
        categoryMap.set(key, id);
      }

      // Pass 2: Set parent_id
      for (let i = 0; i < importData.categories.length; i++) {
        const cat = importData.categories[i];
        if (cat.parent_code || cat.parent_name) {
          const parentKey = Array.from(categoryMap.keys()).find(k => k.endsWith(`-${cat.parent_code || ""}-${cat.parent_name || ""}`));
          const parentId = parentKey ? categoryMap.get(parentKey) : null;
          if (parentId) {
            processedCategories[i].parent_id = parentId;
          }
        }
      }
      localStorage.setItem(LOCAL_CATEGORIES_KEY, JSON.stringify(processedCategories));

      // Import custom columns
      const processedColumns: CustomColumn[] = importData.customColumns.map(col => ({
        id: crypto.randomUUID(),
        project_id: projectId,
        name: col.name,
        column_type: col.column_type,
        masked: col.masked,
        required: col.required,
        sort_order: col.sort_order,
        suggestions: col.suggestions,
        suggestion_colors: col.suggestion_colors,
        created_at: new Date().toISOString(),
      }));
      localStorage.setItem(LOCAL_COLUMNS_KEY, JSON.stringify(processedColumns));

      // Update project currency and column headers
      const localProjects: Project[] = JSON.parse(localStorage.getItem(LOCAL_PROJECTS_KEY) || "[]");
      const updatedProjects = localProjects.map((p) => {
        if (p.id === projectId) {
          const updates: Partial<Project> = {};
          if (importData.currency) updates.currency = importData.currency.toUpperCase();
          return { ...p, ...updates };
        }
        return p;
      });
      localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(updatedProjects));

      // Update active project cache if it's the current one
      const activeProj: Project | null = JSON.parse(localStorage.getItem(ACTIVE_PROJECT_CACHE_KEY) || "null");
      if (activeProj && activeProj.id === projectId) {
        if (importData.currency) activeProj.currency = importData.currency.toUpperCase();
        localStorage.setItem(ACTIVE_PROJECT_CACHE_KEY, JSON.stringify(activeProj));
      }
    } else {
      // --- Supabase Mode Import ---
      // Import categories - Pass 1: Insert all categories
      const categoryMap = new Map<string, string>(); // (code, name) -> id
      
      for (const cat of importData.categories) {
        const { data, error } = await supabase
          .from("project_categories")
          .insert({
            project_id: projectId,
            name: cat.name,
            code: cat.code,
            icon: cat.icon,
            sort_order: cat.sort_order,
          })
          .select()
          .single();
          
        if (error) {
          console.error("Failed to import category:", cat.name, error);
        } else if (data) {
          const key = `${cat.parent_code || ""}-${cat.parent_name || ""}-${cat.code || ""}-${cat.name}`;
          categoryMap.set(key, data.id);
        }
      }
      // Import categories - Pass 2: Set parent_id
      for (const cat of importData.categories) {
        if (cat.parent_code || cat.parent_name) {
          const childKey = `${cat.parent_code || ""}-${cat.parent_name || ""}-${cat.code || ""}-${cat.name}`;
          const childId = categoryMap.get(childKey);
          
          const parentKey = Array.from(categoryMap.keys()).find(k => k.endsWith(`-${cat.parent_code || ""}-${cat.parent_name || ""}`));
          const parentId = parentKey ? categoryMap.get(parentKey) : null;
          
          if (childId && parentId) {
            await supabase
              .from("project_categories")
              .update({ parent_id: parentId })
              .eq("id", childId);
          }
        }
      }

      // Import custom columns
      for (const col of importData.customColumns) {
        const { error } = await supabase
          .from("custom_columns")
          .insert({
            project_id: projectId,
            name: col.name,
            column_type: col.column_type,
            masked: col.masked,
            required: col.required,
            sort_order: col.sort_order,
            suggestions: col.suggestions,
            suggestion_colors: col.suggestion_colors,
          });
        if (error) {
          console.error("Failed to import column:", col.name, error);
        }
      }

      // Import currency if provided
      if (importData.currency) {
        const { error: currencyError } = await supabase
          .from("projects")
          .update({ currency: importData.currency.toUpperCase() })
          .eq("id", projectId);
        if (currencyError) {
          console.error("Failed to import currency:", currencyError);
        }
      }

      // Import column headers if provided
      if (importData.columnHeaders) {
        const { error: headersError } = await supabase
          .from("projects")
          .update({ column_headers: importData.columnHeaders } as unknown as Record<string, unknown>)
          .eq("id", projectId);
        if (headersError) {
          console.error("Failed to import column headers:", headersError);
        }
      }
    }

    // Refresh data
    await Promise.all([
      onCategoriesRefresh(), 
      onColumnsRefresh(),
      onProjectRefresh?.()
    ]);

    let summary = (t("setup.imported") || "Project setup imported").replace(
      "{n}",
      String(importData.categories.length + importData.customColumns.length)
    );
    if (importData.currency || importData.columnHeaders) {
      summary += " (" + [
        importData.currency ? t("proj.currency") || "Currency" : null,
        importData.columnHeaders ? t("admin.columnHeaders") || "Headers" : null
      ].filter(Boolean).join(", ") + ")";
    }

    toast.success(summary);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleExport} className="flex-1">
          <Download className="h-4 w-4 mr-2" />
          {t("setup.export") || "Export"}
        </Button>
        <Button
          variant={useSample ? "default" : "outline"}
          size="sm"
          onClick={handleImportClick}
          disabled={importing}
          className="flex-1 transition-all"
        >
          {useSample ? <Sparkles className="h-4 w-4 mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
          {importing 
            ? t("setup.importing") || "Importing..." 
            : useSample 
              ? (t("setup.importDemo") || "Import Demo") 
              : (t("setup.import") || "Import")}
        </Button>
      </div>

      <div className="flex items-center justify-between p-2 px-3 bg-muted/30 rounded-lg border border-border/50">
        <div className="flex items-center gap-2">
          <Switch
            id="sample-setup"
            checked={useSample}
            onCheckedChange={setUseSample}
          />
          <Label htmlFor="sample-setup" className="text-xs font-medium cursor-pointer">
            {t("setup.useSample") || "Use Demo Project Setup"}
          </Label>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-[200px] text-xs">
              <p>{t("setup.useSampleHelp")}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImportChange}
        accept=".json"
        className="hidden"
      />
      <p className="text-[10px] text-muted-foreground text-center px-4 leading-relaxed">
        {t("setup.exportDesc") ||
          "Export categories and custom columns to share with other projects"}
      </p>
    </div>
  );
};

export default ExportProjectSetup;
