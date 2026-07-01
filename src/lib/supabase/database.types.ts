export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5';
  };
  public: {
    Tables: {
      daily_checkins: {
        Row: {
          backfilled: boolean;
          created_at: string;
          date: string;
          id: string;
          readiness: number;
          sleep_hours: number;
          sleep_quality: number;
          soreness: number;
          stress: number;
          subject_id: string;
          updated_at: string;
        };
        Insert: {
          backfilled?: boolean;
          created_at?: string;
          date: string;
          id?: string;
          readiness: number;
          sleep_hours: number;
          sleep_quality: number;
          soreness: number;
          stress: number;
          subject_id: string;
          updated_at?: string;
        };
        Update: {
          backfilled?: boolean;
          created_at?: string;
          date?: string;
          id?: string;
          readiness?: number;
          sleep_hours?: number;
          sleep_quality?: number;
          soreness?: number;
          stress?: number;
          subject_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'daily_checkins_subject_id_fkey';
            columns: ['subject_id'];
            isOneToOne: false;
            referencedRelation: 'subjects';
            referencedColumns: ['id'];
          },
        ];
      };
      insights: {
        Row: {
          confidence: string | null;
          created_at: string;
          evidence: Json;
          id: string;
          kind: string;
          model: string | null;
          statement: string;
          status: string;
          subject_id: string;
          updated_at: string;
          window_end: string | null;
          window_start: string | null;
        };
        Insert: {
          confidence?: string | null;
          created_at?: string;
          evidence?: Json;
          id?: string;
          kind: string;
          model?: string | null;
          statement: string;
          status?: string;
          subject_id: string;
          updated_at?: string;
          window_end?: string | null;
          window_start?: string | null;
        };
        Update: {
          confidence?: string | null;
          created_at?: string;
          evidence?: Json;
          id?: string;
          kind?: string;
          model?: string | null;
          statement?: string;
          status?: string;
          subject_id?: string;
          updated_at?: string;
          window_end?: string | null;
          window_start?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'insights_subject_id_fkey';
            columns: ['subject_id'];
            isOneToOne: false;
            referencedRelation: 'subjects';
            referencedColumns: ['id'];
          },
        ];
      };
      metrics: {
        Row: {
          created_at: string;
          derived: boolean;
          description: string | null;
          direction: string;
          domain: string;
          key: string;
          label: string;
          unit: string;
        };
        Insert: {
          created_at?: string;
          derived?: boolean;
          description?: string | null;
          direction?: string;
          domain: string;
          key: string;
          label: string;
          unit: string;
        };
        Update: {
          created_at?: string;
          derived?: boolean;
          description?: string | null;
          direction?: string;
          domain?: string;
          key?: string;
          label?: string;
          unit?: string;
        };
        Relationships: [];
      };
      observations: {
        Row: {
          backfilled: boolean;
          effective_at: string;
          effective_date: string;
          id: string;
          metric_key: string;
          recorded_at: string;
          source: string;
          source_entity_id: string | null;
          source_entity_type: string | null;
          subject_id: string;
          value: number;
        };
        Insert: {
          backfilled?: boolean;
          effective_at: string;
          effective_date: string;
          id?: string;
          metric_key: string;
          recorded_at?: string;
          source: string;
          source_entity_id?: string | null;
          source_entity_type?: string | null;
          subject_id: string;
          value: number;
        };
        Update: {
          backfilled?: boolean;
          effective_at?: string;
          effective_date?: string;
          id?: string;
          metric_key?: string;
          recorded_at?: string;
          source?: string;
          source_entity_id?: string | null;
          source_entity_type?: string | null;
          subject_id?: string;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'observations_metric_key_fkey';
            columns: ['metric_key'];
            isOneToOne: false;
            referencedRelation: 'metrics';
            referencedColumns: ['key'];
          },
          {
            foreignKeyName: 'observations_subject_id_fkey';
            columns: ['subject_id'];
            isOneToOne: false;
            referencedRelation: 'subjects';
            referencedColumns: ['id'];
          },
        ];
      };
      subjects: {
        Row: {
          created_at: string;
          display_name: string;
          id: string;
          timezone: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          display_name: string;
          id?: string;
          timezone?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          id?: string;
          timezone?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      training_sessions: {
        Row: {
          backfilled: boolean;
          created_at: string;
          date: string;
          duration_min: number;
          id: string;
          load: number | null;
          modality: string;
          notes: string | null;
          srpe: number;
          started_at: string;
          subject_id: string;
          updated_at: string;
        };
        Insert: {
          backfilled?: boolean;
          created_at?: string;
          date: string;
          duration_min: number;
          id?: string;
          load?: number | null;
          modality: string;
          notes?: string | null;
          srpe: number;
          started_at: string;
          subject_id: string;
          updated_at?: string;
        };
        Update: {
          backfilled?: boolean;
          created_at?: string;
          date?: string;
          duration_min?: number;
          id?: string;
          load?: number | null;
          modality?: string;
          notes?: string | null;
          srpe?: number;
          started_at?: string;
          subject_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'training_sessions_subject_id_fkey';
            columns: ['subject_id'];
            isOneToOne: false;
            referencedRelation: 'subjects';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      save_daily_checkin: {
        Args: { checkin: Json; observations: Json };
        Returns: string;
      };
      save_training_session: {
        Args: { observations: Json; session: Json };
        Returns: string;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
