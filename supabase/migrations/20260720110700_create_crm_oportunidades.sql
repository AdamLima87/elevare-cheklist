-- CRM Comercial — Oportunidades (o "negócio" em si, do lead até ganho/perdido).
CREATE TABLE public.crm_oportunidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),

  crm_empresa_id uuid NOT NULL,
  pipeline_id uuid NOT NULL,
  etapa_id uuid NOT NULL,

  nome text NOT NULL,
  valor_estimado numeric(12,2),
  probabilidade smallint CHECK (probabilidade BETWEEN 0 AND 100),
  responsavel_id uuid NOT NULL, -- "oportunidade nunca sem dono"
  data_prevista_fechamento date,
  concorrente text,
  motivo_perda_id uuid,
  motivo_perda_detalhe text, -- livre, só usado quando o motivo escolhido for "Outro"
  observacoes text,

  -- carimbados pelo trigger crm_oportunidades_etapa_change (não editáveis pelo app)
  etapa_alterada_em timestamptz NOT NULL DEFAULT now(),
  fechada_em timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT crm_oportunidades_crm_empresa_fkey
    FOREIGN KEY (crm_empresa_id, empresa_id) REFERENCES public.crm_empresas (id, empresa_id),
  CONSTRAINT crm_oportunidades_pipeline_fkey
    FOREIGN KEY (pipeline_id, empresa_id) REFERENCES public.crm_pipelines (id, empresa_id),
  -- garante que a etapa pertence ao MESMO pipeline informado nesta
  -- oportunidade, não só ao tenant — pedido explícito do usuário.
  CONSTRAINT crm_oportunidades_etapa_fkey
    FOREIGN KEY (etapa_id, pipeline_id, empresa_id) REFERENCES public.crm_etapas (id, pipeline_id, empresa_id),
  CONSTRAINT crm_oportunidades_responsavel_fkey
    FOREIGN KEY (responsavel_id, empresa_id) REFERENCES public.profiles (id, empresa_id),
  CONSTRAINT crm_oportunidades_motivo_perda_fkey
    FOREIGN KEY (motivo_perda_id, empresa_id) REFERENCES public.crm_motivos_perda (id, empresa_id)
);

ALTER TABLE public.crm_oportunidades ADD CONSTRAINT crm_oportunidades_id_empresa_unique UNIQUE (id, empresa_id);

CREATE INDEX crm_oportunidades_pipeline_etapa_idx ON public.crm_oportunidades (pipeline_id, etapa_id);
CREATE INDEX crm_oportunidades_crm_empresa_idx ON public.crm_oportunidades (crm_empresa_id);
CREATE INDEX crm_oportunidades_responsavel_idx ON public.crm_oportunidades (empresa_id, responsavel_id);

CREATE TRIGGER update_crm_oportunidades_updated_at
  BEFORE UPDATE ON public.crm_oportunidades
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_oportunidades TO authenticated;
GRANT ALL ON public.crm_oportunidades TO service_role;
ALTER TABLE public.crm_oportunidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY crm_oportunidades_admin ON public.crm_oportunidades
  FOR ALL USING (
    public.is_super_admin()
    OR (empresa_id = public.get_minha_empresa()
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil = 'admin'))
  );
CREATE POLICY crm_oportunidades_consultor ON public.crm_oportunidades
  FOR ALL USING (
    empresa_id = public.get_minha_empresa()
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil = 'consultor')
  );
