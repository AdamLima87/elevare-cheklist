-- Fase B — links públicos seguros pra proposta/contrato. Regra de segurança
-- inegociável: o token bruto NUNCA é persistido em lugar nenhum do banco —
-- só o hash (SHA-256). token_hash tem GRANT de coluna revogado pra
-- `authenticated` (abaixo), então nem um SELECT * de um client autenticado
-- normal consegue lê-lo — só a RPC, que roda SECURITY DEFINER como dono da
-- tabela (contorna GRANT de coluna, não RLS).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.crm_documentos_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  tipo text NOT NULL CHECK (tipo IN ('proposta', 'contrato')),
  proposta_id uuid,
  contrato_id uuid,
  token_hash text NOT NULL UNIQUE,
  expira_em timestamptz NOT NULL,
  revogado_em timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT crm_documentos_links_proposta_fkey
    FOREIGN KEY (proposta_id, empresa_id) REFERENCES public.crm_propostas (id, empresa_id),
  CONSTRAINT crm_documentos_links_contrato_fkey
    FOREIGN KEY (contrato_id, empresa_id) REFERENCES public.crm_contratos (id, empresa_id),
  CONSTRAINT crm_documentos_links_created_by_fkey
    FOREIGN KEY (created_by, empresa_id) REFERENCES public.profiles (id, empresa_id),
  CONSTRAINT crm_documentos_links_alvo_check CHECK (
    (tipo = 'proposta' AND proposta_id IS NOT NULL AND contrato_id IS NULL)
    OR (tipo = 'contrato' AND contrato_id IS NOT NULL AND proposta_id IS NULL)
  )
);

CREATE INDEX crm_documentos_links_empresa_idx ON public.crm_documentos_links (empresa_id);

ALTER TABLE public.crm_documentos_links ENABLE ROW LEVEL SECURITY;

-- REVOKE primeiro: GRANT nunca remove privilégio, só adiciona — e este
-- projeto já concede SELECT amplo pra "authenticated" via privilégio padrão
-- do schema, então sem o REVOKE explícito o GRANT de coluna abaixo não
-- restringiria nada (token_hash continuaria visível num SELECT * comum).
REVOKE SELECT ON public.crm_documentos_links FROM authenticated;
GRANT SELECT (id, empresa_id, tipo, proposta_id, contrato_id, expira_em, revogado_em, created_by, created_at)
  ON public.crm_documentos_links TO authenticated;
GRANT ALL ON public.crm_documentos_links TO service_role;

CREATE POLICY crm_documentos_links_select ON public.crm_documentos_links
  FOR SELECT USING (
    public.is_super_admin()
    OR (empresa_id = public.get_minha_empresa()
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil IN ('admin', 'consultor')))
  );
