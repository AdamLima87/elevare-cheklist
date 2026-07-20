-- CRM Comercial — Atividades (Ligação/WhatsApp/Email/Reunião/Visita/
-- Videochamada/Tarefa). Podem estar ligadas só a uma Conta (crm_empresa_id)
-- ou também a uma Oportunidade específica (crm_oportunidade_id, nullable).
CREATE TABLE public.crm_atividades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),

  crm_empresa_id uuid NOT NULL,
  crm_oportunidade_id uuid,
  tipo_id uuid NOT NULL,
  responsavel_id uuid NOT NULL,

  vencimento timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'concluida', 'cancelada')),
  resultado text,
  observacoes text,

  -- stubs para integração futura (WhatsApp/E-mail); sem UI de gestão ainda.
  canal text,
  external_id text,

  concluida_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT crm_atividades_crm_empresa_fkey
    FOREIGN KEY (crm_empresa_id, empresa_id) REFERENCES public.crm_empresas (id, empresa_id),
  CONSTRAINT crm_atividades_crm_oportunidade_fkey
    FOREIGN KEY (crm_oportunidade_id, empresa_id) REFERENCES public.crm_oportunidades (id, empresa_id),
  CONSTRAINT crm_atividades_tipo_fkey
    FOREIGN KEY (tipo_id, empresa_id) REFERENCES public.crm_tipos_atividade (id, empresa_id),
  CONSTRAINT crm_atividades_responsavel_fkey
    FOREIGN KEY (responsavel_id, empresa_id) REFERENCES public.profiles (id, empresa_id)
);

ALTER TABLE public.crm_atividades ADD CONSTRAINT crm_atividades_id_empresa_unique UNIQUE (id, empresa_id);

CREATE INDEX crm_atividades_oportunidade_idx ON public.crm_atividades (crm_oportunidade_id, status);
CREATE INDEX crm_atividades_crm_empresa_idx ON public.crm_atividades (crm_empresa_id, status);
CREATE INDEX crm_atividades_responsavel_vencimento_idx ON public.crm_atividades (empresa_id, responsavel_id, vencimento) WHERE status = 'pendente';

CREATE TRIGGER update_crm_atividades_updated_at
  BEFORE UPDATE ON public.crm_atividades
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_atividades TO authenticated;
GRANT ALL ON public.crm_atividades TO service_role;
ALTER TABLE public.crm_atividades ENABLE ROW LEVEL SECURITY;

CREATE POLICY crm_atividades_admin ON public.crm_atividades
  FOR ALL USING (
    public.is_super_admin()
    OR (empresa_id = public.get_minha_empresa()
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil = 'admin'))
  );
CREATE POLICY crm_atividades_consultor ON public.crm_atividades
  FOR ALL USING (
    empresa_id = public.get_minha_empresa()
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil = 'consultor')
  );
