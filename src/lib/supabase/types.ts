// Auto-generated Supabase types will go here.
// Run `npx supabase gen types typescript` to generate types from your database schema.

export type Database = {
  public: {
    Tables: {
      contacts: {
        Row: {
          id: string;
          name: string;
          email: string | null;
          phone: string | null;
          company: string | null;
          status: string;
          created_at: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          name: string;
          email?: string | null;
          phone?: string | null;
          company?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string | null;
          phone?: string | null;
          company?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
          user_id?: string;
        };
      };
      projects: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          client: string | null;
          status: string;
          start_date: string | null;
          due_date: string | null;
          created_at: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          client?: string | null;
          status?: string;
          start_date?: string | null;
          due_date?: string | null;
          created_at?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          client?: string | null;
          status?: string;
          start_date?: string | null;
          due_date?: string | null;
          created_at?: string;
          updated_at?: string;
          user_id?: string;
        };
      };
      tasks: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          project_id: string | null;
          assignee_id: string | null;
          priority: string;
          status: string;
          due_date: string | null;
          created_at: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          project_id?: string | null;
          assignee_id?: string | null;
          priority?: string;
          status?: string;
          due_date?: string | null;
          created_at?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          project_id?: string | null;
          assignee_id?: string | null;
          priority?: string;
          status?: string;
          due_date?: string | null;
          created_at?: string;
          updated_at?: string;
          user_id?: string;
        };
      };
      employees: {
        Row: {
          id: string;
          name: string;
          email: string;
          role: string | null;
          department: string | null;
          status: string;
          created_at: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          role?: string | null;
          department?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          role?: string | null;
          department?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
          user_id?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
