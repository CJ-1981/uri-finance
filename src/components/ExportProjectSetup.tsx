import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Category } from "@/hooks/useCategories";
import { CustomColumn } from "@/hooks/useCustomColumns";
import { ColumnHeaders } from "@/hooks/useColumnHeaders";
import { useI18n } from "@/hooks/useI18n";

interface Props {
  categories: Category[];
  customColumns: CustomColumn[];
  columnHeaders: ColumnHeaders;
  currency: string;
  projectId: string;
  onCategoriesRefresh: () => Promise<void>;
  onColumnsRefresh: () => Promise<void>;
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
}: Props) => {
  const { t } = useI18n();
  const [importing, setImporting] = useState(false);
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
      categories: categories.map((cat) => ({
        name: cat.name,
        code: cat.code,
        icon: cat.icon,
        sort_order: cat.sort_order,
      })),
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

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const importData: ProjectSetupExport = JSON.parse(text);

      // Validate structure
      if (!importData.categories || !importData.customColumns) {
        throw new Error(t("setup.invalidFormat") || "Invalid file format");
      }

      // Import categories
      for (const cat of importData.categories) {
        const { error } = await supabase
          .from("project_categories")
          .insert({
            project_id: projectId,
            name: cat.name,
            code: cat.code,
            icon: cat.icon,
            sort_order: cat.sort_order,
          });
        if (error) {
          console.error("Failed to import category:", cat.name, error);
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
        } else {
          toast.success(
            (t("setup.currencyUpdated") || "Currency updated to {currency}").replace(
              "{currency}",
              importData.currency.toUpperCase()
            )
          );
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
        } else {
          toast.success(t("setup.headersImported") || "Column headers imported");
        }
      }

      // Refresh data
      await Promise.all([onCategoriesRefresh(), onColumnsRefresh()]);

      toast.success(
        (t("setup.imported") || "Project setup imported").replace(
          "{n}",
          String(importData.categories.length + importData.customColumns.length)
        )
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error((t("setup.importError") || "Failed to import project setup") + errorMessage);
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleExport} className="flex-1">
          <Download className="h-4 w-4 mr-2" />
          {t("setup.export") || "Export"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleImportClick}
          disabled={importing}
          className="flex-1"
        >
          <Upload className="h-4 w-4 mr-2" />
          {importing ? t("setup.importing") || "Importing..." : (t("setup.import") || "Import")}
        </Button>
      </div>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImportChange}
        accept=".json"
        className="hidden"
      />
      <p className="text-[10px] text-muted-foreground text-center">
        {t("setup.exportDesc") ||
          "Export categories and custom columns to share with other projects"}
      </p>
    </div>
  );
};

export default ExportProjectSetup;
