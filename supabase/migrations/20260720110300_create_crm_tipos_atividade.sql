-- CRM Comercial — catálogo de tipos de atividade (Ligação/WhatsApp/Email/
-- Reunião/Visita/Videochamada/Tarefa), editável por tenant (admin).
CREATE TABLE public.crm_tipos_atividade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, nome)
);
ALTER TABLE public.crm_tipos_atividade ADD CONSTRAINT crm_tipos_atividade_id_empresa_unique UNIQUE (id, empresa_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_tipos_atividade TO authenticated;
GRANT ALL ON public.crm_tipos_atividade TO service_role;
ALTER TABLE public.crm_tipos_atividade ENABLE ROW LEVEL SECURITY;

CREATE POLICY crm_tipos_atividade_select ON public.crm_tipos_atividade
  FOR SELECT USING (
    public.is_super_admin()
    OR (empresa_id = public.get_minha_empresa()
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil IN ('admin', 'consultor')))
  );
CREATE POLICY crm_tipos_atividade_admin_write ON public.crm_tipos_atividade
  FOR INSERT WITH CHECK (
    public.is_super_admin()
    OR (empresa_id = public.get_minha_empresa()
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil = 'admin'))
  );
CREATE POLICY crm_tipos_atividade_admin_update ON public.crm_tipos_atividade
  FOR UPDATE USING (
    public.is_super_admin()
    OR (empresa_id = public.get_minha_empresa()
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil = 'admin'))
  );
CREATE POLICY crm_tipos_atividade_admin_delete ON public.crm_tipos_atividade
  FOR DELETE USING (
    public.is_super_admin()
    OR (empresa_id = public.get_minha_empresa()
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil = 'admin'))
  );
