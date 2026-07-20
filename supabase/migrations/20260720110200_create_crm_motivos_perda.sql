-- CRM Comercial — catálogo de motivos de perda, editável por tenant (admin).
-- Mesmo racional de crm_origens_lead: tabela própria, não ENUM, não texto livre.
CREATE TABLE public.crm_motivos_perda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, nome)
);
ALTER TABLE public.crm_motivos_perda ADD CONSTRAINT crm_motivos_perda_id_empresa_unique UNIQUE (id, empresa_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_motivos_perda TO authenticated;
GRANT ALL ON public.crm_motivos_perda TO service_role;
ALTER TABLE public.crm_motivos_perda ENABLE ROW LEVEL SECURITY;

CREATE POLICY crm_motivos_perda_select ON public.crm_motivos_perda
  FOR SELECT USING (
    public.is_super_admin()
    OR (empresa_id = public.get_minha_empresa()
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil IN ('admin', 'consultor')))
  );
CREATE POLICY crm_motivos_perda_admin_write ON public.crm_motivos_perda
  FOR INSERT WITH CHECK (
    public.is_super_admin()
    OR (empresa_id = public.get_minha_empresa()
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil = 'admin'))
  );
CREATE POLICY crm_motivos_perda_admin_update ON public.crm_motivos_perda
  FOR UPDATE USING (
    public.is_super_admin()
    OR (empresa_id = public.get_minha_empresa()
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil = 'admin'))
  );
CREATE POLICY crm_motivos_perda_admin_delete ON public.crm_motivos_perda
  FOR DELETE USING (
    public.is_super_admin()
    OR (empresa_id = public.get_minha_empresa()
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil = 'admin'))
  );
