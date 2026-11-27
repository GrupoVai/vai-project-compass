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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admins_fixos: {
        Row: {
          email: string
        }
        Insert: {
          email: string
        }
        Update: {
          email?: string
        }
        Relationships: []
      }
      cobrancas: {
        Row: {
          criado_em: string
          criado_por: string | null
          dados: Json
          id: number
        }
        Insert: {
          criado_em?: string
          criado_por?: string | null
          dados: Json
          id: number
        }
        Update: {
          criado_em?: string
          criado_por?: string | null
          dados?: Json
          id?: number
        }
        Relationships: []
      }
      perfis: {
        Row: {
          cargo: string | null
          cliente: string | null
          criado_em: string
          email: string
          extra: string | null
          funcoes: string[]
          id: string
          nivel: string | null
          nome: string
          papel: string
          setor: string | null
          status: string
          verticais: string[]
          whatsapp: string | null
        }
        Insert: {
          cargo?: string | null
          cliente?: string | null
          criado_em?: string
          email: string
          extra?: string | null
          funcoes?: string[]
          id: string
          nivel?: string | null
          nome: string
          papel?: string
          setor?: string | null
          status?: string
          verticais?: string[]
          whatsapp?: string | null
        }
        Update: {
          cargo?: string | null
          cliente?: string | null
          criado_em?: string
          email?: string
          extra?: string | null
          funcoes?: string[]
          id?: string
          nivel?: string | null
          nome?: string
          papel?: string
          setor?: string | null
          status?: string
          verticais?: string[]
          whatsapp?: string | null
        }
        Relationships: []
      }
      registros: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          cliente_id: number
          colecao: string
          dados: Json
          id: number
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          cliente_id: number
          colecao: string
          dados: Json
          id: number
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          cliente_id?: number
          colecao?: string
          dados?: Json
          id?: number
        }
        Relationships: []
      }
      responsaveis: {
        Row: {
          contato: string | null
          criado_em: string
          funcao: string | null
          id: number
          nome: string
        }
        Insert: {
          contato?: string | null
          criado_em?: string
          funcao?: string | null
          id: number
          nome: string
        }
        Update: {
          contato?: string | null
          criado_em?: string
          funcao?: string | null
          id?: number
          nome?: string
        }
        Relationships: []
      }
      v2_avulsas: {
        Row: {
          criado_em: string
          criado_por: string | null
          dados: Json
          id: string
          resp: string
        }
        Insert: {
          criado_em?: string
          criado_por?: string | null
          dados?: Json
          id?: string
          resp: string
        }
        Update: {
          criado_em?: string
          criado_por?: string | null
          dados?: Json
          id?: string
          resp?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_avulsas_resp_fkey"
            columns: ["resp"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_cultura: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          dados: Json
          icone: string | null
          id: string
          ordem: number
          pai: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          dados?: Json
          icone?: string | null
          id: string
          ordem?: number
          pai?: string | null
          tipo: string
          titulo?: string
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          dados?: Json
          icone?: string | null
          id?: string
          ordem?: number
          pai?: string | null
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_cultura_pai_fkey"
            columns: ["pai"]
            isOneToOne: false
            referencedRelation: "v2_cultura"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_indicadores: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          faturamento: number | null
          id: string
          mes: string
          meta: number | null
          obs: string | null
          projeto_id: string
          ticket_medio: number | null
          vendas: number | null
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          faturamento?: number | null
          id?: string
          mes: string
          meta?: number | null
          obs?: string | null
          projeto_id: string
          ticket_medio?: number | null
          vendas?: number | null
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          faturamento?: number | null
          id?: string
          mes?: string
          meta?: number | null
          obs?: string | null
          projeto_id?: string
          ticket_medio?: number | null
          vendas?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "v2_indicadores_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "v2_projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_modelos: {
        Row: {
          criado_em: string
          criado_por: string | null
          dados: Json
          id: string
        }
        Insert: {
          criado_em?: string
          criado_por?: string | null
          dados: Json
          id: string
        }
        Update: {
          criado_em?: string
          criado_por?: string | null
          dados?: Json
          id?: string
        }
        Relationships: []
      }
      v2_projetos: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          cliente: string
          criado_em: string
          criado_por: string | null
          dados: Json
          gestor: string | null
          id: string
          membros: string[]
          status: string
          versao: number
          vertical: string
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          cliente: string
          criado_em?: string
          criado_por?: string | null
          dados?: Json
          gestor?: string | null
          id?: string
          membros?: string[]
          status?: string
          versao?: number
          vertical: string
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          cliente?: string
          criado_em?: string
          criado_por?: string | null
          dados?: Json
          gestor?: string | null
          id?: string
          membros?: string[]
          status?: string
          versao?: number
          vertical?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_projetos_gestor_fkey"
            columns: ["gestor"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_rotinas: {
        Row: {
          chave: string
          em: string
          feito: boolean
          por: string | null
        }
        Insert: {
          chave: string
          em?: string
          feito?: boolean
          por?: string | null
        }
        Update: {
          chave?: string
          em?: string
          feito?: boolean
          por?: string | null
        }
        Relationships: []
      }
      v2_vendas: {
        Row: {
          atualizado_em: string
          cliente: string
          criado_em: string
          criado_por: string | null
          dados: Json
          id: string
        }
        Insert: {
          atualizado_em?: string
          cliente: string
          criado_em?: string
          criado_por?: string | null
          dados?: Json
          id?: string
        }
        Update: {
          atualizado_em?: string
          cliente?: string
          criado_em?: string
          criado_por?: string | null
          dados?: Json
          id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      eh_admin: { Args: never; Returns: boolean }
      eh_membro: { Args: never; Returns: boolean }
      meu_nome: { Args: never; Returns: string }
      meu_status: { Args: never; Returns: string }
      pode_ver_cliente: { Args: { cid: number }; Returns: boolean }
      portal_cliente: { Args: { tok: string }; Returns: Json }
      sou_responsavel_no_projeto: { Args: { pid: number }; Returns: boolean }
      v2_acao: {
        Args: { p_acao: string; p_ativ?: string; p_dados?: Json; p_id: string }
        Returns: Json
      }
      v2_admin: { Args: never; Returns: boolean }
      v2_arr: { Args: { j: Json }; Returns: Json }
      v2_comercial: { Args: never; Returns: boolean }
      v2_edita: { Args: { pg: string; pv: string }; Returns: boolean }
      v2_eu_cliente: { Args: never; Returns: string }
      v2_eu_nivel: { Args: never; Returns: string }
      v2_eu_verticais: { Args: never; Returns: string[] }
      v2_garantir_perfil: { Args: never; Returns: string }
      v2_lidera_projeto: { Args: { pid: string }; Returns: boolean }
      v2_portal: { Args: never; Returns: Json }
      v2_sincronizar_cadastros: { Args: never; Returns: number }
      v2_time: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
