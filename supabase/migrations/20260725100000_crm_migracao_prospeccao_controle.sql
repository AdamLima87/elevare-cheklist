-- CRM Comercial — Etapa 8: infraestrutura de migração dos prospects
-- legados (clientes.status='prospeccao') pro CRM novo. Esta migration só
-- cria schema (tabela de controle) — não move nenhum dado. A migração de
-- fato roda via crm_migrar_prospeccao_tenant(), chamada explicitamente
-- (ver migrations seguintes), nunca automaticamente.
--
-- Tabela de controle: cumpre dois papéis exigidos pelo ajuste do usuário —
-- (1) idempotência: UNIQUE(empresa_id, cliente_id) garante que rodar a
-- migração de novo não duplica nada, só pula o que já foi migrado;
-- (2) auditoria: registra o que aconteceu com cada cliente legado
-- (migrado, pulado, erro), inclusive quando o responsável caiu no
-- fallback (linha antiga sem responsavel_id).
CREATE TABLE public.crm_migracao_prospeccao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  cliente_id uuid NOT NULL, -- referência ao registro legado (clientes.id) que originou a migração
  crm_empresa_id uuid,
  crm_oportunidade_id uuid,
  status text NOT NULL CHECK (status IN ('migrado', 'pulado', 'erro')),
  motivo text,
  responsavel_fallback boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, cliente_id)
);

CREATE INDEX crm_migracao_prospeccao_empresa_idx ON public.crm_migracao_prospeccao (empresa_id);

GRANT SELECT ON public.crm_migracao_prospeccao TO authenticated;
GRANT ALL ON public.crm_migracao_prospeccao TO service_role;
ALTER TABLE public.crm_migracao_prospeccao ENABLE ROW LEVEL SECURITY;

CREATE POLICY crm_migracao_prospeccao_select ON public.crm_migracao_prospeccao
  FOR SELECT USING (
    public.is_super_admin()
    OR (empresa_id = public.get_minha_empresa()
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil = 'admin'))
  );
