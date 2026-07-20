-- CRM Comercial — Etapas do pipeline (substitui qualquer ENUM de estágio).
-- UNIQUE(id, pipeline_id, empresa_id) existe especificamente para permitir
-- que crm_oportunidades declare uma FK composta (etapa_id, pipeline_id,
-- empresa_id) — isso garante no nível do banco que uma oportunidade nunca
-- aponte pra uma etapa de outro pipeline (mesmo do mesmo tenant), não só
-- que empresa_id bata.
CREATE TABLE public.crm_etapas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  pipeline_id uuid NOT NULL,
  nome text NOT NULL,
  ordem int NOT NULL,
  -- 'ganho'/'perdido' marcam etapas de fechamento — o código reconhece uma
  -- etapa de fechamento por este campo, não pelo nome (que é editável).
  tipo text NOT NULL DEFAULT 'aberta' CHECK (tipo IN ('aberta', 'ganho', 'perdido')),
  cor text,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT crm_etapas_pipeline_fkey
    FOREIGN KEY (pipeline_id, empresa_id) REFERENCES public.crm_pipelines (id, empresa_id),
  UNIQUE (pipeline_id, ordem)
);

ALTER TABLE public.crm_etapas
  ADD CONSTRAINT crm_etapas_id_pipeline_empresa_unique UNIQUE (id, pipeline_id, empresa_id);

CREATE INDEX crm_etapas_pipeline_idx ON public.crm_etapas (pipeline_id, ordem);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_etapas TO authenticated;
GRANT ALL ON public.crm_etapas TO service_role;
ALTER TABLE public.crm_etapas ENABLE ROW LEVEL SECURITY;

CREATE POLICY crm_etapas_select ON public.crm_etapas
  FOR SELECT USING (
    public.is_super_admin()
    OR (empresa_id = public.get_minha_empresa()
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil IN ('admin', 'consultor')))
  );
CREATE POLICY crm_etapas_admin_write ON public.crm_etapas
  FOR INSERT WITH CHECK (
    public.is_super_admin()
    OR (empresa_id = public.get_minha_empresa()
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil = 'admin'))
  );
CREATE POLICY crm_etapas_admin_update ON public.crm_etapas
  FOR UPDATE USING (
    public.is_super_admin()
    OR (empresa_id = public.get_minha_empresa()
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil = 'admin'))
  );
CREATE POLICY crm_etapas_admin_delete ON public.crm_etapas
  FOR DELETE USING (
    public.is_super_admin()
    OR (empresa_id = public.get_minha_empresa()
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil = 'admin'))
  );
