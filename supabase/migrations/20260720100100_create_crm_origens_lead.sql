-- CRM Comercial — catálogo de origens de lead, editável por tenant (admin).
-- Não é ENUM nem texto livre: decisão do produto foi modelar conceitos de
-- negócio configuráveis (origem, motivo de perda, tipo de atividade, etapa
-- de pipeline) como tabelas próprias, referenciadas por FK, para nunca
-- exigir uma migration só para adicionar uma opção nova.
CREATE TABLE public.crm_origens_lead (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  nome text NOT NULL,
  -- peso usado pelo score do lead (crm_lead_score, Etapa 4) — dado, não
  -- código, para poder ajustar a pontuação por origem sem deploy.
  peso_score int NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, nome)
);
ALTER TABLE public.crm_origens_lead ADD CONSTRAINT crm_origens_lead_id_empresa_unique UNIQUE (id, empresa_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_origens_lead TO authenticated;
GRANT ALL ON public.crm_origens_lead TO service_role;
ALTER TABLE public.crm_origens_lead ENABLE ROW LEVEL SECURITY;

CREATE POLICY crm_origens_lead_select ON public.crm_origens_lead
  FOR SELECT USING (
    public.is_super_admin()
    OR (empresa_id = public.get_minha_empresa()
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil IN ('admin', 'consultor')))
  );

-- Escrita (criar/renomear/desativar origem) é decisão gerencial: só admin.
CREATE POLICY crm_origens_lead_admin_write ON public.crm_origens_lead
  FOR INSERT WITH CHECK (
    public.is_super_admin()
    OR (empresa_id = public.get_minha_empresa()
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil = 'admin'))
  );
CREATE POLICY crm_origens_lead_admin_update ON public.crm_origens_lead
  FOR UPDATE USING (
    public.is_super_admin()
    OR (empresa_id = public.get_minha_empresa()
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil = 'admin'))
  );
CREATE POLICY crm_origens_lead_admin_delete ON public.crm_origens_lead
  FOR DELETE USING (
    public.is_super_admin()
    OR (empresa_id = public.get_minha_empresa()
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil = 'admin'))
  );
