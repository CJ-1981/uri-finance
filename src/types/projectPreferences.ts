// SPEC-PROJ-001: Shared constants and interfaces for project preferences
export const LOCAL_PROJECT_PREFERENCES_KEY = "project_preferences";

export interface LocalProjectPreference {
  project_id: string;
  display_order?: number; // Optional to handle "no order" state
  is_default: boolean;
}
