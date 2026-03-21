export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      user_preferences: {
        Row: {
          id: string
          user_id: string
          default_project_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          default_project_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          default_project_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      // Other tables remain unchanged...
      projects: {
        Row: {
          id: string
          name: string
          description: string | null
          owner_id: string
          invite_code: string
          currency: string
          column_headers: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          owner_id: string
          invite_code?: string
          currency?: string
          column_headers?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          owner_id?: string
          invite_code?: string
          currency?: string
          column_headers?: Json
          created_at?: string
          updated_at?: string
        }
      }
      project_members: {
        Row: {
          id: string
          project_id: string
          user_id: string
          role: string
          joined_at: string
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
          role?: string
          joined_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string
          role?: string
          joined_at?: string
        }
      }
      project_bans: {
        Row: {
          id: string
          project_id: string
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string
          created_at?: string
        }
      }
      project_categories: {
        Row: {
          id: string
          project_id: string
          name: string
          code: string
          icon: string
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          name: string
          code?: string
          icon?: string
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          name?: string
          code?: string
          icon?: string
          sort_order?: number
          created_at?: string
        }
      }
      custom_columns: {
        Row: {
          id: string
          project_id: string
          name: string
          column_type: string
          masked: boolean
          suggestions: string[]
          required: boolean
          suggestion_colors: Json
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          name: string
          column_type?: string
          masked?: boolean
          suggestions?: string[]
          required?: boolean
          suggestion_colors?: Json
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          name?: string
          column_type?: string
          masked?: boolean
          suggestions?: string[]
          required?: boolean
          suggestion_colors?: Json
          sort_order?: number
          created_at?: string
        }
      }
      transactions: {
        Row: {
          id: string
          project_id: string
          user_id: string
          type: 'income' | 'expense'
          amount: number
          currency: string
          category: string
          description: string | null
          transaction_date: string
          custom_values: Json
          deleted_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
          type: 'income' | 'expense'
          amount: number
          currency?: string
          category?: string
          description?: string | null
          transaction_date?: string
          custom_values?: Json
          deleted_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string
          type?: 'income' | 'expense'
          amount?: number
          currency?: string
          category?: string
          description?: string | null
          transaction_date?: string
          custom_values?: Json
          deleted_at?: string | null
          created_at?: string
        }
      }
      project_invites: {
        Row: {
          id: string
          project_id: string
          code: string
          label: string | null
          email: string | null
          role: string
          created_by: string
          used_by: string | null
          used_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          code?: string
          label?: string | null
          email?: string | null
          role?: string
          created_by: string
          used_by?: string | null
          used_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          code?: string
          label?: string | null
          email?: string | null
          role?: string
          created_by?: string
          used_by?: string | null
          used_at?: string | null
          created_at?: string
        }
      }
      project_files: {
        Row: {
          id: string
          project_id: string
          uploaded_by: string
          file_name: string
          file_type: string
          file_size: number
          storage_path: string
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          uploaded_by: string
          file_name: string
          file_type: string
          file_size: number
          storage_path: string
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          uploaded_by?: string
          file_name?: string
          file_type?: string
          file_size?: string
          storage_path?: string
          created_at?: string
        }
      }
    }
  }
}
