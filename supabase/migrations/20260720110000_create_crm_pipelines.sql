-- CRM Comercial — Pipelines (funis de venda) configuráveis por tenant.
-- Só admin edita (decisão confirmada com o usuário); consultor só usa.
CREATE TABLE public.crm_pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  nome text NOT NULL,
  padrao boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_pipelines ADD CONSTRAINT crm_pipelines_id_empresa_unique UNIQUE (id, empresa_id);

-- No máximo 1 pipeline padrão por tenant.
CREATE UNIQUE INDEX crm_pipelines_empresa_padrao_unique
  ON public.crm_pipelines (empresa_id) WHERE padrao = true;

CREATE TRIGGER update_crm_pipelines_updated_at
  BEFORE UPDATE ON public.crm_pipelines
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_pipelines TO authenticated;
GRANT ALL ON public.crm_pipelines TO service_role;
ALTER TABLE public.crm_pipelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY crm_pipelines_select ON public.crm_pipelines
  FOR SELECT USING (
    public.is_super_admin()
    OR (empresa_id = public.get_minha_empresa()
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil IN ('admin', 'consultor')))
  );
CREATE POLICY crm_pipelines_admin_write ON public.crm_pipelines
  FOR INSERT WITH CHECK (
    public.is_super_admin()
    OR (empresa_id = public.get_minha_empresa()
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil = 'admin'))
  );
CREATE POLICY crm_pipelines_admin_update ON public.crm_pipelines
  FOR UPDATE USING (
    public.is_super_admin()
    OR (empresa_id = public.get_minha_empresa()
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil = 'admin'))
  );
CREATE POLICY crm_pipelines_admin_delete ON public.crm_pipelines
  FOR DELETE USING (
    public.is_super_admin()
    OR (empresa_id = public.get_minha_empresa()
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil = 'admin'))
  );
