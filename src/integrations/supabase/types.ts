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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          actor_id: string | null
          created_at: string
          empresa_id: string | null
          event_type: string
          id: string
          metadata: Json
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          empresa_id?: string | null
          event_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          empresa_id?: string | null
          event_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_itens: {
        Row: {
          critico: boolean
          id: string
          item_key: string
          modelo_versao_id: string
          ordem: number
          secao_id: string
          texto: string
        }
        Insert: {
          critico?: boolean
          id?: string
          item_key: string
          modelo_versao_id: string
          ordem: number
          secao_id: string
          texto: string
        }
        Update: {
          critico?: boolean
          id?: string
          item_key?: string
          modelo_versao_id?: string
          ordem?: number
          secao_id?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_itens_modelo_versao_id_fkey"
            columns: ["modelo_versao_id"]
            isOneToOne: false
            referencedRelation: "checklist_modelo_versoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_itens_secao_id_fkey"
            columns: ["secao_id"]
            isOneToOne: false
            referencedRelation: "checklist_secoes"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_modelo_versoes: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          is_versao_atual: boolean
          modelo_id: string
          numero_versao: number
          publicado_em: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          is_versao_atual?: boolean
          modelo_id: string
          numero_versao: number
          publicado_em?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          is_versao_atual?: boolean
          modelo_id?: string
          numero_versao?: number
          publicado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_modelo_versoes_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "checklist_modelos"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_modelos: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          id: string
          legislacao_versao_id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          id?: string
          legislacao_versao_id: string
          nome: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          id?: string
          legislacao_versao_id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_modelos_legislacao_versao_id_fkey"
            columns: ["legislacao_versao_id"]
            isOneToOne: false
            referencedRelation: "legislacao_versoes"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_secoes: {
        Row: {
          id: string
          modelo_versao_id: string
          ordem: number
          secao_key: string
          titulo: string
        }
        Insert: {
          id?: string
          modelo_versao_id: string
          ordem: number
          secao_key: string
          titulo: string
        }
        Update: {
          id?: string
          modelo_versao_id?: string
          ordem?: number
          secao_key?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_secoes_modelo_versao_id_fkey"
            columns: ["modelo_versao_id"]
            isOneToOne: false
            referencedRelation: "checklist_modelo_versoes"
            referencedColumns: ["id"]
          },
        ]
      }
      client_user_queue: {
        Row: {
          cnpj: string
          created_at: string | null
          email: string
          error_message: string | null
          id: string
          nome: string | null
          processed_at: string | null
          status: string | null
        }
        Insert: {
          cnpj: string
          created_at?: string | null
          email: string
          error_message?: string | null
          id?: string
          nome?: string | null
          processed_at?: string | null
          status?: string | null
        }
        Update: {
          cnpj?: string
          created_at?: string | null
          email?: string
          error_message?: string | null
          id?: string
          nome?: string | null
          processed_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
      cliente_interacoes: {
        Row: {
          autor_id: string | null
          cliente_id: string
          created_at: string
          empresa_id: string
          id: string
          texto: string
          tipo: string
        }
        Insert: {
          autor_id?: string | null
          cliente_id: string
          created_at?: string
          empresa_id: string
          id?: string
          texto: string
          tipo?: string
        }
        Update: {
          autor_id?: string | null
          cliente_id?: string
          created_at?: string
          empresa_id?: string
          id?: string
          texto?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_interacoes_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_interacoes_cliente_id_empresa_fkey"
            columns: ["cliente_id", "empresa_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id", "empresa_id"]
          },
          {
            foreignKeyName: "cliente_interacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          categoria: string | null
          cnpj: string | null
          created_at: string
          empresa_id: string
          etapa_funil: string | null
          foto_url: string | null
          id: string
          nome: string
          origem: string | null
          responsavel_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          categoria?: string | null
          cnpj?: string | null
          created_at?: string
          empresa_id: string
          etapa_funil?: string | null
          foto_url?: string | null
          id?: string
          nome: string
          origem?: string | null
          responsavel_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          categoria?: string | null
          cnpj?: string | null
          created_at?: string
          empresa_id?: string
          etapa_funil?: string | null
          foto_url?: string | null
          id?: string
          nome?: string
          origem?: string | null
          responsavel_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes: {
        Row: {
          created_at: string | null
          email_contato: string
          empresa_id: string
          enviar_email_cliente: boolean | null
          id: string
          logo_base64: string | null
          nome_empresa: string
          notificar_admin: boolean | null
          site: string | null
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email_contato?: string
          empresa_id: string
          enviar_email_cliente?: boolean | null
          id?: string
          logo_base64?: string | null
          nome_empresa?: string
          notificar_admin?: boolean | null
          site?: string | null
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email_contato?: string
          empresa_id?: string
          enviar_email_cliente?: boolean | null
          id?: string
          logo_base64?: string | null
          nome_empresa?: string
          notificar_admin?: boolean | null
          site?: string | null
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "configuracoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_atividades: {
        Row: {
          canal: string | null
          concluida_em: string | null
          created_at: string
          crm_empresa_id: string
          crm_oportunidade_id: string | null
          empresa_id: string
          external_id: string | null
          id: string
          observacoes: string | null
          responsavel_id: string
          resultado: string | null
          status: string
          tipo_id: string
          updated_at: string
          vencimento: string
        }
        Insert: {
          canal?: string | null
          concluida_em?: string | null
          created_at?: string
          crm_empresa_id: string
          crm_oportunidade_id?: string | null
          empresa_id: string
          external_id?: string | null
          id?: string
          observacoes?: string | null
          responsavel_id: string
          resultado?: string | null
          status?: string
          tipo_id: string
          updated_at?: string
          vencimento: string
        }
        Update: {
          canal?: string | null
          concluida_em?: string | null
          created_at?: string
          crm_empresa_id?: string
          crm_oportunidade_id?: string | null
          empresa_id?: string
          external_id?: string | null
          id?: string
          observacoes?: string | null
          responsavel_id?: string
          resultado?: string | null
          status?: string
          tipo_id?: string
          updated_at?: string
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_atividades_crm_empresa_fkey"
            columns: ["crm_empresa_id", "empresa_id"]
            isOneToOne: false
            referencedRelation: "crm_empresas"
            referencedColumns: ["id", "empresa_id"]
          },
          {
            foreignKeyName: "crm_atividades_crm_empresa_fkey"
            columns: ["crm_empresa_id", "empresa_id"]
            isOneToOne: false
            referencedRelation: "crm_empresas_score"
            referencedColumns: ["id", "empresa_id"]
          },
          {
            foreignKeyName: "crm_atividades_crm_oportunidade_fkey"
            columns: ["crm_oportunidade_id", "empresa_id"]
            isOneToOne: false
            referencedRelation: "crm_oportunidades"
            referencedColumns: ["id", "empresa_id"]
          },
          {
            foreignKeyName: "crm_atividades_crm_oportunidade_fkey"
            columns: ["crm_oportunidade_id", "empresa_id"]
            isOneToOne: false
            referencedRelation: "crm_oportunidades_saude"
            referencedColumns: ["id", "empresa_id"]
          },
          {
            foreignKeyName: "crm_atividades_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_atividades_responsavel_fkey"
            columns: ["responsavel_id", "empresa_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "empresa_id"]
          },
          {
            foreignKeyName: "crm_atividades_tipo_fkey"
            columns: ["tipo_id", "empresa_id"]
            isOneToOne: false
            referencedRelation: "crm_tipos_atividade"
            referencedColumns: ["id", "empresa_id"]
          },
        ]
      }
      crm_contatos: {
        Row: {
          cargo: string | null
          created_at: string
          crm_empresa_id: string
          email: string | null
          empresa_id: string
          id: string
          nome: string
          observacoes: string | null
          telefone: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          cargo?: string | null
          created_at?: string
          crm_empresa_id: string
          email?: string | null
          empresa_id: string
          id?: string
          nome: string
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          cargo?: string | null
          created_at?: string
          crm_empresa_id?: string
          email?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_contatos_crm_empresa_fkey"
            columns: ["crm_empresa_id", "empresa_id"]
            isOneToOne: false
            referencedRelation: "crm_empresas"
            referencedColumns: ["id", "empresa_id"]
          },
          {
            foreignKeyName: "crm_contatos_crm_empresa_fkey"
            columns: ["crm_empresa_id", "empresa_id"]
            isOneToOne: false
            referencedRelation: "crm_empresas_score"
            referencedColumns: ["id", "empresa_id"]
          },
          {
            foreignKeyName: "crm_contatos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_empresas: {
        Row: {
          cidade: string | null
          cliente_id: string | null
          cnpj: string | null
          created_at: string
          empresa_id: string
          estado: string | null
          google_place_id: string | null
          id: string
          instagram: string | null
          nome_fantasia: string | null
          numero_unidades: number | null
          observacoes: string | null
          origem_id: string | null
          razao_social: string
          responsavel_id: string
          segmento: string | null
          site: string | null
          status: string
          tags: string[]
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          cidade?: string | null
          cliente_id?: string | null
          cnpj?: string | null
          created_at?: string
          empresa_id: string
          estado?: string | null
          google_place_id?: string | null
          id?: string
          instagram?: string | null
          nome_fantasia?: string | null
          numero_unidades?: number | null
          observacoes?: string | null
          origem_id?: string | null
          razao_social: string
          responsavel_id: string
          segmento?: string | null
          site?: string | null
          status?: string
          tags?: string[]
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          cidade?: string | null
          cliente_id?: string | null
          cnpj?: string | null
          created_at?: string
          empresa_id?: string
          estado?: string | null
          google_place_id?: string | null
          id?: string
          instagram?: string | null
          nome_fantasia?: string | null
          numero_unidades?: number | null
          observacoes?: string | null
          origem_id?: string | null
          razao_social?: string
          responsavel_id?: string
          segmento?: string | null
          site?: string | null
          status?: string
          tags?: string[]
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_empresas_cliente_fkey"
            columns: ["cliente_id", "empresa_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id", "empresa_id"]
          },
          {
            foreignKeyName: "crm_empresas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_empresas_origem_fkey"
            columns: ["origem_id", "empresa_id"]
            isOneToOne: false
            referencedRelation: "crm_origens_lead"
            referencedColumns: ["id", "empresa_id"]
          },
          {
            foreignKeyName: "crm_empresas_responsavel_fkey"
            columns: ["responsavel_id", "empresa_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "empresa_id"]
          },
        ]
      }
      crm_etapas: {
        Row: {
          cor: string | null
          created_at: string
          empresa_id: string
          gera_diagnostico: boolean
          id: string
          nome: string
          ordem: number
          pipeline_id: string
          tipo: string
        }
        Insert: {
          cor?: string | null
          created_at?: string
          empresa_id: string
          gera_diagnostico?: boolean
          id?: string
          nome: string
          ordem: number
          pipeline_id: string
          tipo?: string
        }
        Update: {
          cor?: string | null
          created_at?: string
          empresa_id?: string
          gera_diagnostico?: boolean
          id?: string
          nome?: string
          ordem?: number
          pipeline_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_etapas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_etapas_pipeline_fkey"
            columns: ["pipeline_id", "empresa_id"]
            isOneToOne: false
            referencedRelation: "crm_pipelines"
            referencedColumns: ["id", "empresa_id"]
          },
        ]
      }
      crm_leads_busca_tentativas: {
        Row: {
          created_at: string
          empresa_id: string
          id: number
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: number
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: number
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_busca_tentativas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_leads_config: {
        Row: {
          created_at: string
          empresa_id: string
          trial_leads_limite: number
          trial_leads_usados: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          trial_leads_limite?: number
          trial_leads_usados?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          trial_leads_limite?: number
          trial_leads_usados?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_config_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_leads_credenciais: {
        Row: {
          api_key_ciphertext: string
          api_key_iv: string
          created_at: string
          criado_por: string | null
          empresa_id: string
          status: string
          ultimo_teste_em: string | null
          updated_at: string
        }
        Insert: {
          api_key_ciphertext: string
          api_key_iv: string
          created_at?: string
          criado_por?: string | null
          empresa_id: string
          status?: string
          ultimo_teste_em?: string | null
          updated_at?: string
        }
        Update: {
          api_key_ciphertext?: string
          api_key_iv?: string
          created_at?: string
          criado_por?: string | null
          empresa_id?: string
          status?: string
          ultimo_teste_em?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_credenciais_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_leads_importacoes: {
        Row: {
          created_at: string
          credencial_origem: string
          crm_empresa_id: string | null
          empresa_id: string
          google_place_id: string
          id: string
          importado_por: string | null
        }
        Insert: {
          created_at?: string
          credencial_origem: string
          crm_empresa_id?: string | null
          empresa_id: string
          google_place_id: string
          id?: string
          importado_por?: string | null
        }
        Update: {
          created_at?: string
          credencial_origem?: string
          crm_empresa_id?: string | null
          empresa_id?: string
          google_place_id?: string
          id?: string
          importado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_importacoes_crm_empresa_fkey"
            columns: ["crm_empresa_id", "empresa_id"]
            isOneToOne: false
            referencedRelation: "crm_empresas"
            referencedColumns: ["id", "empresa_id"]
          },
          {
            foreignKeyName: "crm_leads_importacoes_crm_empresa_fkey"
            columns: ["crm_empresa_id", "empresa_id"]
            isOneToOne: false
            referencedRelation: "crm_empresas_score"
            referencedColumns: ["id", "empresa_id"]
          },
          {
            foreignKeyName: "crm_leads_importacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_importacoes_importado_por_fkey"
            columns: ["importado_por", "empresa_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "empresa_id"]
          },
        ]
      }
      crm_leads_nichos: {
        Row: {
          ativo: boolean
          created_at: string
          empresa_id: string
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          empresa_id: string
          id?: string
          nome: string
          ordem?: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_nichos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_leads_usage: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          leads_importados: number
          periodo_fim: string
          periodo_inicio: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          leads_importados?: number
          periodo_fim: string
          periodo_inicio: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          leads_importados?: number
          periodo_fim?: string
          periodo_inicio?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_usage_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_migracao_prospeccao: {
        Row: {
          cliente_id: string
          created_at: string
          crm_empresa_id: string | null
          crm_oportunidade_id: string | null
          empresa_id: string
          id: string
          motivo: string | null
          responsavel_fallback: boolean
          status: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          crm_empresa_id?: string | null
          crm_oportunidade_id?: string | null
          empresa_id: string
          id?: string
          motivo?: string | null
          responsavel_fallback?: boolean
          status: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          crm_empresa_id?: string | null
          crm_oportunidade_id?: string | null
          empresa_id?: string
          id?: string
          motivo?: string | null
          responsavel_fallback?: boolean
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_migracao_prospeccao_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_motivos_perda: {
        Row: {
          ativo: boolean
          created_at: string
          empresa_id: string
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          empresa_id: string
          id?: string
          nome: string
          ordem?: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: [
          {
            foreignKeyName: "crm_motivos_perda_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_oportunidades: {
        Row: {
          concorrente: string | null
          created_at: string
          crm_empresa_id: string
          data_prevista_fechamento: string | null
          empresa_id: string
          etapa_alterada_em: string
          etapa_id: string
          fechada_em: string | null
          id: string
          motivo_perda_detalhe: string | null
          motivo_perda_id: string | null
          nome: string
          observacoes: string | null
          pipeline_id: string
          probabilidade: number | null
          responsavel_id: string
          updated_at: string
          valor_estimado: number | null
        }
        Insert: {
          concorrente?: string | null
          created_at?: string
          crm_empresa_id: string
          data_prevista_fechamento?: string | null
          empresa_id: string
          etapa_alterada_em?: string
          etapa_id: string
          fechada_em?: string | null
          id?: string
          motivo_perda_detalhe?: string | null
          motivo_perda_id?: string | null
          nome: string
          observacoes?: string | null
          pipeline_id: string
          probabilidade?: number | null
          responsavel_id: string
          updated_at?: string
          valor_estimado?: number | null
        }
        Update: {
          concorrente?: string | null
          created_at?: string
          crm_empresa_id?: string
          data_prevista_fechamento?: string | null
          empresa_id?: string
          etapa_alterada_em?: string
          etapa_id?: string
          fechada_em?: string | null
          id?: string
          motivo_perda_detalhe?: string | null
          motivo_perda_id?: string | null
          nome?: string
          observacoes?: string | null
          pipeline_id?: string
          probabilidade?: number | null
          responsavel_id?: string
          updated_at?: string
          valor_estimado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_oportunidades_crm_empresa_fkey"
            columns: ["crm_empresa_id", "empresa_id"]
            isOneToOne: false
            referencedRelation: "crm_empresas"
            referencedColumns: ["id", "empresa_id"]
          },
          {
            foreignKeyName: "crm_oportunidades_crm_empresa_fkey"
            columns: ["crm_empresa_id", "empresa_id"]
            isOneToOne: false
            referencedRelation: "crm_empresas_score"
            referencedColumns: ["id", "empresa_id"]
          },
          {
            foreignKeyName: "crm_oportunidades_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_oportunidades_etapa_fkey"
            columns: ["etapa_id", "pipeline_id", "empresa_id"]
            isOneToOne: false
            referencedRelation: "crm_etapas"
            referencedColumns: ["id", "pipeline_id", "empresa_id"]
          },
          {
            foreignKeyName: "crm_oportunidades_motivo_perda_fkey"
            columns: ["motivo_perda_id", "empresa_id"]
            isOneToOne: false
            referencedRelation: "crm_motivos_perda"
            referencedColumns: ["id", "empresa_id"]
          },
          {
            foreignKeyName: "crm_oportunidades_pipeline_fkey"
            columns: ["pipeline_id", "empresa_id"]
            isOneToOne: false
            referencedRelation: "crm_pipelines"
            referencedColumns: ["id", "empresa_id"]
          },
          {
            foreignKeyName: "crm_oportunidades_responsavel_fkey"
            columns: ["responsavel_id", "empresa_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "empresa_id"]
          },
        ]
      }
      crm_origens_lead: {
        Row: {
          ativo: boolean
          created_at: string
          empresa_id: string
          id: string
          nome: string
          ordem: number
          peso_score: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          empresa_id: string
          id?: string
          nome: string
          ordem?: number
          peso_score?: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string
          id?: string
          nome?: string
          ordem?: number
          peso_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "crm_origens_lead_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_pipelines: {
        Row: {
          ativo: boolean
          created_at: string
          empresa_id: string
          id: string
          nome: string
          padrao: boolean
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          empresa_id: string
          id?: string
          nome: string
          padrao?: boolean
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string
          id?: string
          nome?: string
          padrao?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_pipelines_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_timeline: {
        Row: {
          autor_id: string | null
          created_at: string
          crm_empresa_id: string
          crm_oportunidade_id: string | null
          descricao: string
          empresa_id: string
          evento_tipo: string
          id: string
          metadata: Json
          origem: string
        }
        Insert: {
          autor_id?: string | null
          created_at?: string
          crm_empresa_id: string
          crm_oportunidade_id?: string | null
          descricao: string
          empresa_id: string
          evento_tipo: string
          id?: string
          metadata?: Json
          origem?: string
        }
        Update: {
          autor_id?: string | null
          created_at?: string
          crm_empresa_id?: string
          crm_oportunidade_id?: string | null
          descricao?: string
          empresa_id?: string
          evento_tipo?: string
          id?: string
          metadata?: Json
          origem?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_timeline_autor_fkey"
            columns: ["autor_id", "empresa_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "empresa_id"]
          },
          {
            foreignKeyName: "crm_timeline_crm_empresa_fkey"
            columns: ["crm_empresa_id", "empresa_id"]
            isOneToOne: false
            referencedRelation: "crm_empresas"
            referencedColumns: ["id", "empresa_id"]
          },
          {
            foreignKeyName: "crm_timeline_crm_empresa_fkey"
            columns: ["crm_empresa_id", "empresa_id"]
            isOneToOne: false
            referencedRelation: "crm_empresas_score"
            referencedColumns: ["id", "empresa_id"]
          },
          {
            foreignKeyName: "crm_timeline_crm_oportunidade_fkey"
            columns: ["crm_oportunidade_id", "empresa_id"]
            isOneToOne: false
            referencedRelation: "crm_oportunidades"
            referencedColumns: ["id", "empresa_id"]
          },
          {
            foreignKeyName: "crm_timeline_crm_oportunidade_fkey"
            columns: ["crm_oportunidade_id", "empresa_id"]
            isOneToOne: false
            referencedRelation: "crm_oportunidades_saude"
            referencedColumns: ["id", "empresa_id"]
          },
          {
            foreignKeyName: "crm_timeline_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_tipos_atividade: {
        Row: {
          ativo: boolean
          created_at: string
          empresa_id: string
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          empresa_id: string
          id?: string
          nome: string
          ordem?: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: [
          {
            foreignKeyName: "crm_tipos_atividade_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos: {
        Row: {
          cliente_id: string
          created_at: string
          created_by: string | null
          data_emissao: string | null
          data_vencimento: string | null
          empresa_id: string
          id: string
          numero: string | null
          observacoes: string | null
          orgao_emissor: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          created_by?: string | null
          data_emissao?: string | null
          data_vencimento?: string | null
          empresa_id: string
          id?: string
          numero?: string | null
          observacoes?: string | null
          orgao_emissor?: string | null
          tipo: string
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          created_by?: string | null
          data_emissao?: string | null
          data_vencimento?: string | null
          empresa_id?: string
          id?: string
          numero?: string | null
          observacoes?: string | null
          orgao_emissor?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documentos_cliente_id_empresa_fkey"
            columns: ["cliente_id", "empresa_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id", "empresa_id"]
          },
          {
            foreignKeyName: "documentos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      empresas: {
        Row: {
          cnpj: string | null
          created_at: string
          id: string
          nome: string
          onboarding_completed_at: string | null
          plano: string
          status: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          id?: string
          nome: string
          onboarding_completed_at?: string | null
          plano?: string
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          id?: string
          nome?: string
          onboarding_completed_at?: string | null
          plano?: string
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      inspecoes: {
        Row: {
          checklist_modelo_versao_id: string
          cliente_id: string | null
          cnpj: string | null
          conformidade: number | null
          consultor_id: string | null
          created_at: string
          crm_oportunidade_id: string | null
          dados: Json
          data_conclusao: string | null
          data_inicio: string
          empresa_id: string
          estabelecimento_nome: string | null
          id: string
          inspecao_origem_id: string | null
          numero_sequencial: number
          progresso: number
          respostas: Json
          status: string
          tipo_execucao: string
          updated_at: string
        }
        Insert: {
          checklist_modelo_versao_id: string
          cliente_id?: string | null
          cnpj?: string | null
          conformidade?: number | null
          consultor_id?: string | null
          created_at?: string
          crm_oportunidade_id?: string | null
          dados?: Json
          data_conclusao?: string | null
          data_inicio?: string
          empresa_id: string
          estabelecimento_nome?: string | null
          id?: string
          inspecao_origem_id?: string | null
          numero_sequencial: number
          progresso?: number
          respostas?: Json
          status?: string
          tipo_execucao?: string
          updated_at?: string
        }
        Update: {
          checklist_modelo_versao_id?: string
          cliente_id?: string | null
          cnpj?: string | null
          conformidade?: number | null
          consultor_id?: string | null
          created_at?: string
          crm_oportunidade_id?: string | null
          dados?: Json
          data_conclusao?: string | null
          data_inicio?: string
          empresa_id?: string
          estabelecimento_nome?: string | null
          id?: string
          inspecao_origem_id?: string | null
          numero_sequencial?: number
          progresso?: number
          respostas?: Json
          status?: string
          tipo_execucao?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspecoes_checklist_modelo_versao_id_fkey"
            columns: ["checklist_modelo_versao_id"]
            isOneToOne: false
            referencedRelation: "checklist_modelo_versoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspecoes_cliente_id_empresa_fkey"
            columns: ["cliente_id", "empresa_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id", "empresa_id"]
          },
          {
            foreignKeyName: "inspecoes_crm_oportunidade_empresa_fkey"
            columns: ["crm_oportunidade_id", "empresa_id"]
            isOneToOne: false
            referencedRelation: "crm_oportunidades"
            referencedColumns: ["id", "empresa_id"]
          },
          {
            foreignKeyName: "inspecoes_crm_oportunidade_empresa_fkey"
            columns: ["crm_oportunidade_id", "empresa_id"]
            isOneToOne: false
            referencedRelation: "crm_oportunidades_saude"
            referencedColumns: ["id", "empresa_id"]
          },
          {
            foreignKeyName: "inspecoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspecoes_inspecao_origem_id_fkey"
            columns: ["inspecao_origem_id"]
            isOneToOne: false
            referencedRelation: "inspecoes"
            referencedColumns: ["id"]
          },
        ]
      }
      legislacao_versoes: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          legislacao_id: string
          numero_versao: number
          vigente_desde: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          legislacao_id: string
          numero_versao: number
          vigente_desde?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          legislacao_id?: string
          numero_versao?: number
          vigente_desde?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "legislacao_versoes_legislacao_id_fkey"
            columns: ["legislacao_id"]
            isOneToOne: false
            referencedRelation: "legislacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      legislacoes: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          esfera: string
          id: string
          nome: string
          uf: string | null
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          esfera: string
          id?: string
          nome: string
          uf?: string | null
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          esfera?: string
          id?: string
          nome?: string
          uf?: string | null
        }
        Relationships: []
      }
      numeracao_inspecoes: {
        Row: {
          empresa_id: string
          ultimo_numero: number | null
        }
        Insert: {
          empresa_id: string
          ultimo_numero?: number | null
        }
        Update: {
          empresa_id?: string
          ultimo_numero?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "numeracao_inspecoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ativo: boolean
          cnpj: string | null
          conselho_regional: string | null
          created_at: string
          email: string | null
          empresa_id: string
          force_password_change: boolean | null
          id: string
          nome: string
          numero_registro: string | null
          perfil: string
          telefone: string | null
          ultimo_acesso: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cnpj?: string | null
          conselho_regional?: string | null
          created_at?: string
          email?: string | null
          empresa_id: string
          force_password_change?: boolean | null
          id: string
          nome: string
          numero_registro?: string | null
          perfil: string
          telefone?: string | null
          ultimo_acesso?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cnpj?: string | null
          conselho_regional?: string | null
          created_at?: string
          email?: string | null
          empresa_id?: string
          force_password_change?: boolean | null
          id?: string
          nome?: string
          numero_registro?: string | null
          perfil?: string
          telefone?: string | null
          ultimo_acesso?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      saas_assinaturas: {
        Row: {
          blocked_at: string | null
          cancel_at_period_end: boolean
          canceled_at: string | null
          checkout_intencao_id: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          empresa_id: string | null
          id: string
          owner_id: string | null
          past_due_since: string | null
          periodicidade: string | null
          plano_codigo: string
          provider: string
          provider_customer_id: string | null
          provider_subscription_id: string | null
          status: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          blocked_at?: string | null
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          checkout_intencao_id?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          empresa_id?: string | null
          id?: string
          owner_id?: string | null
          past_due_since?: string | null
          periodicidade?: string | null
          plano_codigo: string
          provider?: string
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          blocked_at?: string | null
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          checkout_intencao_id?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          empresa_id?: string | null
          id?: string
          owner_id?: string | null
          past_due_since?: string | null
          periodicidade?: string | null
          plano_codigo?: string
          provider?: string
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saas_assinaturas_checkout_intencao_id_fkey"
            columns: ["checkout_intencao_id"]
            isOneToOne: false
            referencedRelation: "saas_checkout_intencoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saas_assinaturas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saas_assinaturas_plano_codigo_fkey"
            columns: ["plano_codigo"]
            isOneToOne: false
            referencedRelation: "saas_planos"
            referencedColumns: ["codigo"]
          },
        ]
      }
      saas_checkout_intencoes: {
        Row: {
          auth_user_id: string
          checkout_url: string | null
          created_at: string
          cupom_codigo: string | null
          email: string
          expires_at: string
          id: string
          origem: Json
          parcelas: number
          periodicidade: string
          plano_codigo: string
          provider: string
          provider_checkout_id: string | null
          provider_customer_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          auth_user_id: string
          checkout_url?: string | null
          created_at?: string
          cupom_codigo?: string | null
          email: string
          expires_at?: string
          id?: string
          origem?: Json
          parcelas?: number
          periodicidade: string
          plano_codigo: string
          provider?: string
          provider_checkout_id?: string | null
          provider_customer_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          auth_user_id?: string
          checkout_url?: string | null
          created_at?: string
          cupom_codigo?: string | null
          email?: string
          expires_at?: string
          id?: string
          origem?: Json
          parcelas?: number
          periodicidade?: string
          plano_codigo?: string
          provider?: string
          provider_checkout_id?: string | null
          provider_customer_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saas_checkout_intencoes_plano_codigo_fkey"
            columns: ["plano_codigo"]
            isOneToOne: false
            referencedRelation: "saas_planos"
            referencedColumns: ["codigo"]
          },
        ]
      }
      saas_cupom_utilizacoes: {
        Row: {
          assinatura_id: string | null
          auth_user_id: string | null
          checkout_intencao_id: string | null
          cupom_id: string
          desconto_aplicado: number | null
          empresa_id: string | null
          expires_at: string
          id: string
          reserved_at: string
          status: string
          used_at: string | null
        }
        Insert: {
          assinatura_id?: string | null
          auth_user_id?: string | null
          checkout_intencao_id?: string | null
          cupom_id: string
          desconto_aplicado?: number | null
          empresa_id?: string | null
          expires_at?: string
          id?: string
          reserved_at?: string
          status?: string
          used_at?: string | null
        }
        Update: {
          assinatura_id?: string | null
          auth_user_id?: string | null
          checkout_intencao_id?: string | null
          cupom_id?: string
          desconto_aplicado?: number | null
          empresa_id?: string | null
          expires_at?: string
          id?: string
          reserved_at?: string
          status?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saas_cupom_utilizacoes_assinatura_id_fkey"
            columns: ["assinatura_id"]
            isOneToOne: false
            referencedRelation: "saas_assinaturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saas_cupom_utilizacoes_checkout_intencao_id_fkey"
            columns: ["checkout_intencao_id"]
            isOneToOne: false
            referencedRelation: "saas_checkout_intencoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saas_cupom_utilizacoes_cupom_id_fkey"
            columns: ["cupom_id"]
            isOneToOne: false
            referencedRelation: "saas_cupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saas_cupom_utilizacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      saas_cupons: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          criado_por: string | null
          data_fim: string | null
          data_inicio: string
          descricao: string | null
          id: string
          max_utilizacoes: number | null
          max_utilizacoes_por_empresa: number
          periodicidade: string | null
          plano_codigo: string | null
          somente_novos_clientes: boolean
          tipo_desconto: string
          updated_at: string
          utilizacoes_atual: number
          valor: number
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          criado_por?: string | null
          data_fim?: string | null
          data_inicio?: string
          descricao?: string | null
          id?: string
          max_utilizacoes?: number | null
          max_utilizacoes_por_empresa?: number
          periodicidade?: string | null
          plano_codigo?: string | null
          somente_novos_clientes?: boolean
          tipo_desconto: string
          updated_at?: string
          utilizacoes_atual?: number
          valor?: number
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          criado_por?: string | null
          data_fim?: string | null
          data_inicio?: string
          descricao?: string | null
          id?: string
          max_utilizacoes?: number | null
          max_utilizacoes_por_empresa?: number
          periodicidade?: string | null
          plano_codigo?: string | null
          somente_novos_clientes?: boolean
          tipo_desconto?: string
          updated_at?: string
          utilizacoes_atual?: number
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "saas_cupons_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saas_cupons_plano_codigo_fkey"
            columns: ["plano_codigo"]
            isOneToOne: false
            referencedRelation: "saas_planos"
            referencedColumns: ["codigo"]
          },
        ]
      }
      saas_empresa_features: {
        Row: {
          created_at: string
          empresa_id: string
          enabled: boolean
          feature_id: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          enabled: boolean
          feature_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          enabled?: boolean
          feature_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saas_empresa_features_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saas_empresa_features_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "saas_features"
            referencedColumns: ["id"]
          },
        ]
      }
      saas_empresa_overrides: {
        Row: {
          created_at: string
          criado_por: string | null
          empresa_id: string
          id: string
          limite_key: string
          motivo: string | null
          valor: number
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          empresa_id: string
          id?: string
          limite_key: string
          motivo?: string | null
          valor: number
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          empresa_id?: string
          id?: string
          limite_key?: string
          motivo?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "saas_empresa_overrides_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saas_empresa_overrides_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      saas_features: {
        Row: {
          ativo_por_padrao: boolean
          chave: string
          created_at: string
          descricao: string | null
          id: string
          nome: string
        }
        Insert: {
          ativo_por_padrao?: boolean
          chave: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
        }
        Update: {
          ativo_por_padrao?: boolean
          chave?: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      saas_pagamentos: {
        Row: {
          assinatura_id: string | null
          checkout_intencao_id: string | null
          checkout_url: string | null
          created_at: string
          desconto_aplicado: number
          empresa_id: string | null
          forma_pagamento: string | null
          id: string
          invoice_url: string | null
          paid_at: string | null
          parcela_numero: number | null
          parcelas: number
          provider: string
          provider_installment_id: string | null
          provider_payment_id: string | null
          status: string
          updated_at: string
          valor_base: number
          valor_cobrado: number
          vencimento: string | null
        }
        Insert: {
          assinatura_id?: string | null
          checkout_intencao_id?: string | null
          checkout_url?: string | null
          created_at?: string
          desconto_aplicado?: number
          empresa_id?: string | null
          forma_pagamento?: string | null
          id?: string
          invoice_url?: string | null
          paid_at?: string | null
          parcela_numero?: number | null
          parcelas?: number
          provider?: string
          provider_installment_id?: string | null
          provider_payment_id?: string | null
          status?: string
          updated_at?: string
          valor_base: number
          valor_cobrado: number
          vencimento?: string | null
        }
        Update: {
          assinatura_id?: string | null
          checkout_intencao_id?: string | null
          checkout_url?: string | null
          created_at?: string
          desconto_aplicado?: number
          empresa_id?: string | null
          forma_pagamento?: string | null
          id?: string
          invoice_url?: string | null
          paid_at?: string | null
          parcela_numero?: number | null
          parcelas?: number
          provider?: string
          provider_installment_id?: string | null
          provider_payment_id?: string | null
          status?: string
          updated_at?: string
          valor_base?: number
          valor_cobrado?: number
          vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saas_pagamentos_assinatura_id_fkey"
            columns: ["assinatura_id"]
            isOneToOne: false
            referencedRelation: "saas_assinaturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saas_pagamentos_checkout_intencao_id_fkey"
            columns: ["checkout_intencao_id"]
            isOneToOne: false
            referencedRelation: "saas_checkout_intencoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saas_pagamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      saas_plano_limites: {
        Row: {
          created_at: string
          id: string
          limite_key: string
          plano_id: string
          updated_at: string
          valor: number
        }
        Insert: {
          created_at?: string
          id?: string
          limite_key: string
          plano_id: string
          updated_at?: string
          valor: number
        }
        Update: {
          created_at?: string
          id?: string
          limite_key?: string
          plano_id?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "saas_plano_limites_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "saas_planos"
            referencedColumns: ["id"]
          },
        ]
      }
      saas_planos: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          id: string
          nome: string
          ordem: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: []
      }
      saas_webhook_eventos: {
        Row: {
          created_at: string
          error: string | null
          event_type: string
          id: string
          payload: Json
          payload_hash: string
          processed_at: string | null
          provider: string
          provider_event_id: string | null
          status: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_type: string
          id?: string
          payload: Json
          payload_hash: string
          processed_at?: string | null
          provider?: string
          provider_event_id?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          event_type?: string
          id?: string
          payload?: Json
          payload_hash?: string
          processed_at?: string | null
          provider?: string
          provider_event_id?: string | null
          status?: string
        }
        Relationships: []
      }
      signup_attempts: {
        Row: {
          created_at: string
          email: string | null
          id: number
          ip: unknown
          reason: string | null
          success: boolean
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: number
          ip?: unknown
          reason?: string | null
          success: boolean
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: number
          ip?: unknown
          reason?: string | null
          success?: boolean
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      visitas: {
        Row: {
          cliente_id: string
          consultor_id: string | null
          created_at: string
          data_hora: string
          empresa_id: string
          id: string
          inspecao_id: string | null
          observacoes: string | null
          status: string
          tipo: string
          updated_at: string
        }
        Insert: {
          cliente_id: string
          consultor_id?: string | null
          created_at?: string
          data_hora: string
          empresa_id: string
          id?: string
          inspecao_id?: string | null
          observacoes?: string | null
          status?: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          consultor_id?: string | null
          created_at?: string
          data_hora?: string
          empresa_id?: string
          id?: string
          inspecao_id?: string | null
          observacoes?: string | null
          status?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "visitas_cliente_id_empresa_fkey"
            columns: ["cliente_id", "empresa_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id", "empresa_id"]
          },
          {
            foreignKeyName: "visitas_consultor_id_fkey"
            columns: ["consultor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_inspecao_id_fkey"
            columns: ["inspecao_id"]
            isOneToOne: false
            referencedRelation: "inspecoes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      crm_empresas_score: {
        Row: {
          cidade: string | null
          cliente_id: string | null
          cnpj: string | null
          created_at: string | null
          empresa_id: string | null
          estado: string | null
          id: string | null
          instagram: string | null
          nome_fantasia: string | null
          numero_unidades: number | null
          observacoes: string | null
          origem_id: string | null
          razao_social: string | null
          responsavel_id: string | null
          score: number | null
          segmento: string | null
          site: string | null
          status: string | null
          tags: string[] | null
          updated_at: string | null
          whatsapp: string | null
        }
        Insert: {
          cidade?: string | null
          cliente_id?: string | null
          cnpj?: string | null
          created_at?: string | null
          empresa_id?: string | null
          estado?: string | null
          id?: string | null
          instagram?: string | null
          nome_fantasia?: string | null
          numero_unidades?: number | null
          observacoes?: string | null
          origem_id?: string | null
          razao_social?: string | null
          responsavel_id?: string | null
          score?: never
          segmento?: string | null
          site?: string | null
          status?: string | null
          tags?: string[] | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Update: {
          cidade?: string | null
          cliente_id?: string | null
          cnpj?: string | null
          created_at?: string | null
          empresa_id?: string | null
          estado?: string | null
          id?: string | null
          instagram?: string | null
          nome_fantasia?: string | null
          numero_unidades?: number | null
          observacoes?: string | null
          origem_id?: string | null
          razao_social?: string | null
          responsavel_id?: string | null
          score?: never
          segmento?: string | null
          site?: string | null
          status?: string | null
          tags?: string[] | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_empresas_cliente_fkey"
            columns: ["cliente_id", "empresa_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id", "empresa_id"]
          },
          {
            foreignKeyName: "crm_empresas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_empresas_origem_fkey"
            columns: ["origem_id", "empresa_id"]
            isOneToOne: false
            referencedRelation: "crm_origens_lead"
            referencedColumns: ["id", "empresa_id"]
          },
          {
            foreignKeyName: "crm_empresas_responsavel_fkey"
            columns: ["responsavel_id", "empresa_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "empresa_id"]
          },
        ]
      }
      crm_oportunidades_saude: {
        Row: {
          concorrente: string | null
          created_at: string | null
          crm_empresa_id: string | null
          data_prevista_fechamento: string | null
          empresa_id: string | null
          etapa_alterada_em: string | null
          etapa_id: string | null
          fechada_em: string | null
          id: string | null
          motivo_perda_detalhe: string | null
          motivo_perda_id: string | null
          nome: string | null
          observacoes: string | null
          pipeline_id: string | null
          probabilidade: number | null
          responsavel_id: string | null
          saude: string | null
          tem_atividade_vencida: boolean | null
          ultimo_evento_em: string | null
          updated_at: string | null
          valor_estimado: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_oportunidades_crm_empresa_fkey"
            columns: ["crm_empresa_id", "empresa_id"]
            isOneToOne: false
            referencedRelation: "crm_empresas"
            referencedColumns: ["id", "empresa_id"]
          },
          {
            foreignKeyName: "crm_oportunidades_crm_empresa_fkey"
            columns: ["crm_empresa_id", "empresa_id"]
            isOneToOne: false
            referencedRelation: "crm_empresas_score"
            referencedColumns: ["id", "empresa_id"]
          },
          {
            foreignKeyName: "crm_oportunidades_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_oportunidades_etapa_fkey"
            columns: ["etapa_id", "pipeline_id", "empresa_id"]
            isOneToOne: false
            referencedRelation: "crm_etapas"
            referencedColumns: ["id", "pipeline_id", "empresa_id"]
          },
          {
            foreignKeyName: "crm_oportunidades_motivo_perda_fkey"
            columns: ["motivo_perda_id", "empresa_id"]
            isOneToOne: false
            referencedRelation: "crm_motivos_perda"
            referencedColumns: ["id", "empresa_id"]
          },
          {
            foreignKeyName: "crm_oportunidades_pipeline_fkey"
            columns: ["pipeline_id", "empresa_id"]
            isOneToOne: false
            referencedRelation: "crm_pipelines"
            referencedColumns: ["id", "empresa_id"]
          },
          {
            foreignKeyName: "crm_oportunidades_responsavel_fkey"
            columns: ["responsavel_id", "empresa_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "empresa_id"]
          },
        ]
      }
    }
    Functions: {
      aplicar_cupom_checkout: {
        Args: { p_checkout_intencao_id: string; p_codigo: string }
        Returns: {
          out_cupom_id: string
          out_tipo_desconto: string
          out_valor: number
        }[]
      }
      auth_user_id_by_email: {
        Args: { p_email: string }
        Returns: {
          email_confirmed: boolean
          user_id: string
        }[]
      }
      can_access_crm: { Args: never; Returns: boolean }
      complete_onboarding: { Args: never; Returns: undefined }
      confirmar_cupom_checkout: {
        Args: { p_checkout_intencao_id: string }
        Returns: undefined
      }
      crm_busca_global: {
        Args: { p_query: string }
        Returns: {
          crm_empresa_id: string
          id: string
          subtitulo: string
          tipo: string
          titulo: string
        }[]
      }
      crm_concluir_atividade: {
        Args: {
          p_atividade_id: string
          p_nova_atividade_tipo_id?: string
          p_nova_atividade_vencimento?: string
          p_resultado?: string
        }
        Returns: {
          canal: string | null
          concluida_em: string | null
          created_at: string
          crm_empresa_id: string
          crm_oportunidade_id: string | null
          empresa_id: string
          external_id: string | null
          id: string
          observacoes: string | null
          responsavel_id: string
          resultado: string | null
          status: string
          tipo_id: string
          updated_at: string
          vencimento: string
        }
        SetofOptions: {
          from: "*"
          to: "crm_atividades"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      crm_definir_etapa_diagnostico: {
        Args: { p_etapa_id?: string; p_pipeline_id: string }
        Returns: {
          etapa_diagnostico_id: string
          pipeline_id: string
        }[]
      }
      crm_fechar_oportunidade_ganha: {
        Args: { p_motivo_sem_diagnostico?: string; p_oportunidade_id: string }
        Returns: {
          already_converted: boolean
          cliente_criado: boolean
          cliente_id: string
          diagnosticos_vinculados: number
          oportunidade_id: string
        }[]
      }
      crm_fechar_oportunidade_perdida: {
        Args: {
          p_motivo_perda_detalhe?: string
          p_motivo_perda_id: string
          p_oportunidade_id: string
        }
        Returns: {
          concorrente: string | null
          created_at: string
          crm_empresa_id: string
          data_prevista_fechamento: string | null
          empresa_id: string
          etapa_alterada_em: string
          etapa_id: string
          fechada_em: string | null
          id: string
          motivo_perda_detalhe: string | null
          motivo_perda_id: string | null
          nome: string
          observacoes: string | null
          pipeline_id: string
          probabilidade: number | null
          responsavel_id: string
          updated_at: string
          valor_estimado: number | null
        }
        SetofOptions: {
          from: "*"
          to: "crm_oportunidades"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      crm_importar_lead_google: {
        Args: {
          p_cidade: string
          p_estado: string
          p_etapa_id: string
          p_nome_fantasia: string
          p_pipeline_id: string
          p_place_id: string
          p_razao_social: string
          p_responsavel_id: string
          p_site: string
          p_whatsapp: string
        }
        Returns: {
          crm_empresa_id: string
          crm_oportunidade_id: string
          ja_existia: boolean
        }[]
      }
      crm_lead_score: { Args: { p_crm_empresa_id: string }; Returns: number }
      crm_leads_resolver_limite: {
        Args: never
        Returns: {
          disponivel: number
          limite: number
          limite_tipo: string
          periodo_fim: string
          periodo_inicio: string
          pode_importar: boolean
          tem_credencial_propria: boolean
          usados: number
        }[]
      }
      crm_migrar_prospeccao_tenant: {
        Args: { p_empresa_id: string }
        Returns: {
          erros: number
          migrados: number
          pulados: number
        }[]
      }
      crm_mover_etapa_com_proxima_acao: {
        Args: {
          p_etapa_id: string
          p_nova_atividade_tipo_id?: string
          p_nova_atividade_vencimento?: string
          p_oportunidade_id: string
        }
        Returns: {
          concorrente: string | null
          created_at: string
          crm_empresa_id: string
          data_prevista_fechamento: string | null
          empresa_id: string
          etapa_alterada_em: string
          etapa_id: string
          fechada_em: string | null
          id: string
          motivo_perda_detalhe: string | null
          motivo_perda_id: string | null
          nome: string
          observacoes: string | null
          pipeline_id: string
          probabilidade: number | null
          responsavel_id: string
          updated_at: string
          valor_estimado: number | null
        }
        SetofOptions: {
          from: "*"
          to: "crm_oportunidades"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      crm_obter_ou_criar_diagnostico: {
        Args: { p_oportunidade_id: string }
        Returns: {
          criado: boolean
          inspecao_id: string
        }[]
      }
      crm_registrar_timeline_sistema: {
        Args: {
          p_crm_oportunidade_id: string
          p_descricao: string
          p_evento_tipo: string
          p_metadata: Json
        }
        Returns: undefined
      }
      crm_relatorio_pre_migracao_prospeccao: {
        Args: { p_empresa_id?: string }
        Returns: {
          cnpj_colidindo_com_conta_existente: number
          empresa_id: string
          ja_migrados: number
          sem_admin_para_fallback: boolean
          sem_responsavel: number
          total_prospeccao: number
        }[]
      }
      crm_seed_catalogos_padrao: {
        Args: { p_empresa_id: string }
        Returns: undefined
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_minha_empresa: { Args: never; Returns: string }
      get_next_numero_inspecao: { Args: never; Returns: number }
      get_tenant_access_status: {
        Args: never
        Returns: {
          blocked_at: string
          current_period_end: string
          dias_atraso: number
          dias_para_bloqueio: number
          past_due_since: string
          periodicidade: string
          plano_codigo: string
          status: string
          trial_ends_at: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      platform_assinaturas_lista: {
        Args: never
        Returns: {
          blocked_at: string
          current_period_end: string
          empresa_id: string
          empresa_nome: string
          past_due_since: string
          periodicidade: string
          plano_codigo: string
          status: string
          trial_ends_at: string
        }[]
      }
      platform_atualizar_empresa_plano: {
        Args: { p_empresa_id: string; p_plano: string }
        Returns: undefined
      }
      platform_atualizar_empresa_status: {
        Args: { p_empresa_id: string; p_status: string }
        Returns: undefined
      }
      platform_billing_dashboard: {
        Args: never
        Returns: {
          assinaturas_ativas: number
          bloqueados: number
          cancelados: number
          inadimplentes_1_a_6: number
          inadimplentes_7_a_14: number
          trials_ativos: number
          trials_expirados: number
          trials_expirando_em_breve: number
          ultimos_pagamentos: Json
          webhooks_com_erro: number
        }[]
      }
      platform_bloquear_assinatura: {
        Args: { p_empresa_id: string; p_motivo: string }
        Returns: undefined
      }
      platform_dashboard_metrics: {
        Args: never
        Returns: {
          cadastros_recentes: Json
          clientes_total: number
          crm_contas_total: number
          crm_oportunidades_total: number
          empresas_ativas: number
          empresas_pagas: number
          empresas_total: number
          empresas_trial: number
          inspecoes_total: number
          leads_google_total: number
          usuarios_total: number
        }[]
      }
      platform_definir_override_limite: {
        Args: {
          p_empresa_id: string
          p_limite_key: string
          p_motivo: string
          p_valor: number
        }
        Returns: undefined
      }
      platform_desbloquear_assinatura: {
        Args: { p_empresa_id: string; p_motivo: string }
        Returns: undefined
      }
      platform_empresas_resumo: {
        Args: never
        Returns: {
          clientes: number
          cnpj: string
          created_at: string
          id: string
          inspecoes: number
          leads_importados: number
          nome: string
          oportunidades: number
          plano: string
          status: string
          trial_ends_at: string
          ultimo_acesso: string
          usuarios: number
        }[]
      }
      platform_estender_trial: {
        Args: { p_empresa_id: string; p_novo_trial_ends_at: string }
        Returns: undefined
      }
      platform_google_places_consumo: {
        Args: never
        Returns: {
          buscas_ultima_hora: number
          credencial_origem: string
          credencial_status: string
          empresa_id: string
          empresa_nome: string
          mes_atual_leads_importados: number
          plano: string
          total_leads_importados: number
          trial_leads_limite: number
          trial_leads_usados: number
        }[]
      }
      platform_marcar_evento_para_reprocessar: {
        Args: { p_evento_id: string }
        Returns: undefined
      }
      provision_tenant: {
        Args: {
          p_empresa_nome: string
          p_origem?: Json
          p_owner_email: string
          p_owner_id: string
          p_owner_nome: string
          p_plano?: string
          p_status?: string
          p_trial_ends_at?: string
          p_whatsapp: string
        }
        Returns: Database["public"]["CompositeTypes"]["provision_tenant_result"]
        SetofOptions: {
          from: "*"
          to: "provision_tenant_result"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      publicar_checklist_modelo_versao: {
        Args: { p_modelo_versao_id: string }
        Returns: undefined
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      remover_cupom_checkout: {
        Args: { p_checkout_intencao_id: string }
        Returns: undefined
      }
      resolver_checklist_modelo_padrao: { Args: never; Returns: string }
      resolver_preco_plano: {
        Args: { p_periodicidade: string; p_plano_codigo: string }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      provision_tenant_result: {
        status: string | null
        empresa_id: string | null
      }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
