export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      bets: {
        Row: {
          amount: number
          auto_cashout: number | null
          cashout_multiplier: number | null
          created_at: string
          id: string
          is_bot: boolean
          payout: number
          round_id: number
          slot: number
          status: string
          user_id: string | null
          username: string
        }
        Insert: {
          amount: number
          auto_cashout?: number | null
          cashout_multiplier?: number | null
          created_at?: string
          id?: string
          is_bot?: boolean
          payout?: number
          round_id: number
          slot?: number
          status?: string
          user_id?: string | null
          username: string
        }
        Update: {
          amount?: number
          auto_cashout?: number | null
          cashout_multiplier?: number | null
          created_at?: string
          id?: string
          is_bot?: boolean
          payout?: number
          round_id?: number
          slot?: number
          status?: string
          user_id?: string | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "bets_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          body: string
          created_at: string
          hidden: boolean
          id: string
          user_id: string | null
          username: string
        }
        Insert: {
          body: string
          created_at?: string
          hidden?: boolean
          id?: string
          user_id?: string | null
          username: string
        }
        Update: {
          body?: string
          created_at?: string
          hidden?: boolean
          id?: string
          user_id?: string | null
          username?: string
        }
        Relationships: []
      }
      deposits: {
        Row: {
          amount: number
          bonus_amount: number
          checkout_request_id: string | null
          created_at: string
          id: string
          merchant_request_id: string | null
          mpesa_receipt: string | null
          phone: string
          result_desc: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          bonus_amount?: number
          checkout_request_id?: string | null
          created_at?: string
          id?: string
          merchant_request_id?: string | null
          mpesa_receipt?: string | null
          phone: string
          result_desc?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          bonus_amount?: number
          checkout_request_id?: string | null
          created_at?: string
          id?: string
          merchant_request_id?: string | null
          mpesa_receipt?: string | null
          phone?: string
          result_desc?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          phone: string
          status: string
          username: string
        }
        Insert: {
          created_at?: string
          id: string
          phone: string
          status?: string
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          phone?: string
          status?: string
          username?: string
        }
        Relationships: []
      }
      rounds: {
        Row: {
          crash_multiplier: number
          crashed_at: string
          ends_at: string
          id: number
          running_at: string
          settled: boolean
          waiting_at: string
        }
        Insert: {
          crash_multiplier: number
          crashed_at: string
          ends_at: string
          id?: number
          running_at: string
          settled?: boolean
          waiting_at?: string
        }
        Update: {
          crash_multiplier?: number
          crashed_at?: string
          ends_at?: string
          id?: number
          running_at?: string
          settled?: boolean
          waiting_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_ledger: {
        Row: {
          bonus_after: number
          bonus_delta: number
          cash_after: number
          cash_delta: number
          created_at: string
          entry_type: string
          id: string
          reference: string | null
          user_id: string
        }
        Insert: {
          bonus_after: number
          bonus_delta?: number
          cash_after: number
          cash_delta?: number
          created_at?: string
          entry_type: string
          id?: string
          reference?: string | null
          user_id: string
        }
        Update: {
          bonus_after?: number
          bonus_delta?: number
          cash_after?: number
          cash_delta?: number
          created_at?: string
          entry_type?: string
          id?: string
          reference?: string | null
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          bonus_balance: number
          cash_balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          bonus_balance?: number
          cash_balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          bonus_balance?: number
          cash_balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          admin_note: string | null
          amount: number
          created_at: string
          id: string
          phone: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          created_at?: string
          id?: string
          phone: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          created_at?: string
          id?: string
          phone?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_adjust_balance: {
        Args: { _bonus: number; _cash: number; _note: string; _user_id: string }
        Returns: undefined
      }
      admin_review_withdrawal: {
        Args: { _approve: boolean; _id: string; _note: string }
        Returns: undefined
      }
      admin_set_user_status: {
        Args: { _status: string; _user_id: string }
        Returns: undefined
      }
      attach_deposit_refs: {
        Args: { _checkout: string; _deposit_id: string; _merchant: string }
        Returns: undefined
      }
      bootstrap_account: {
        Args: { _phone: string; _username: string }
        Returns: undefined
      }
      cash_out: {
        Args: { _bet_id: string }
        Returns: {
          amount: number
          auto_cashout: number | null
          cashout_multiplier: number | null
          created_at: string
          id: string
          is_bot: boolean
          payout: number
          round_id: number
          slot: number
          status: string
          user_id: string | null
          username: string
        }
        SetofOptions: {
          from: "*"
          to: "bets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_deposit: {
        Args: { _amount: number; _phone: string }
        Returns: {
          amount: number
          bonus_amount: number
          checkout_request_id: string | null
          created_at: string
          id: string
          merchant_request_id: string | null
          mpesa_receipt: string | null
          phone: string
          result_desc: string | null
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "deposits"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      credit_deposit: {
        Args: { _checkout: string; _receipt: string }
        Returns: undefined
      }
      ensure_current_round: {
        Args: never
        Returns: {
          crash_multiplier: number
          crashed_at: string
          ends_at: string
          id: number
          running_at: string
          settled: boolean
          waiting_at: string
        }
        SetofOptions: {
          from: "*"
          to: "rounds"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fail_deposit: {
        Args: { _checkout: string; _reason: string }
        Returns: undefined
      }
      gen_crash: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      place_bet: {
        Args: { _amount: number; _auto_cashout: number; _slot: number }
        Returns: {
          amount: number
          auto_cashout: number | null
          cashout_multiplier: number | null
          created_at: string
          id: string
          is_bot: boolean
          payout: number
          round_id: number
          slot: number
          status: string
          user_id: string | null
          username: string
        }
        SetofOptions: {
          from: "*"
          to: "bets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      request_withdrawal: {
        Args: { _amount: number; _phone: string }
        Returns: {
          admin_note: string | null
          amount: number
          created_at: string
          id: string
          phone: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "withdrawals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      round_multiplier: {
        Args: { _at: string; _running_at: string }
        Returns: number
      }
      server_now: { Args: never; Returns: string }
      settle_round: { Args: { _round_id: number }; Returns: undefined }
      spawn_bot_bets: { Args: { _round_id: number }; Returns: undefined }
      wallet_apply: {
        Args: {
          _bonus: number
          _cash: number
          _ref: string
          _type: string
          _user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
