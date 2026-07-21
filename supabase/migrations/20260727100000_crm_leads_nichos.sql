-- CRM Comercial — Buscar Leads: catálogo de "nichos" (categoria de
-- estabelecimento), pra trocar a busca de texto livre por um formulário
-- estruturado (Estado/Cidade/Bairro/Nicho). Mesmo padrão das outras
-- tabelas de catálogo (crm_motivos_perda, crm_tipos_atividade,
-- crm_origens_lead): editável por tenant, sem migration toda vez que
-- alguém quiser adicionar um nicho novo. "Outro" (busca por termo livre)
-- continua existindo, mas só na UI — não é uma linha desta tabela.
CREATE TABLE public.crm_leads_nichos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, nome)
);
ALTER TABLE public.crm_leads_nichos ADD CONSTRAINT crm_leads_nichos_id_empresa_unique UNIQUE (id, empresa_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_leads_nichos TO authenticated;
GRANT ALL ON public.crm_leads_nichos TO service_role;
ALTER TABLE public.crm_leads_nichos ENABLE ROW LEVEL SECURITY;

CREATE POLICY crm_leads_nichos_select ON public.crm_leads_nichos
  FOR SELECT USING (
    public.is_super_admin()
    OR (empresa_id = public.get_minha_empresa()
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil IN ('admin', 'consultor')))
  );

CREATE POLICY crm_leads_nichos_admin_write ON public.crm_leads_nichos
  FOR INSERT WITH CHECK (
    public.is_super_admin()
    OR (empresa_id = public.get_minha_empresa()
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil = 'admin'))
  );
CREATE POLICY crm_leads_nichos_admin_update ON public.crm_leads_nichos
  FOR UPDATE USING (
    public.is_super_admin()
    OR (empresa_id = public.get_minha_empresa()
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil = 'admin'))
  );
CREATE POLICY crm_leads_nichos_admin_delete ON public.crm_leads_nichos
  FOR DELETE USING (
    public.is_super_admin()
    OR (empresa_id = public.get_minha_empresa()
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil = 'admin'))
  );

-- Seed idempotente pros tenants existentes + inclusão no seed padrão de
-- tenants futuros (mesmo mecanismo usado pra "Google Maps" em
-- crm_origens_lead).
DO $$
DECLARE
  v_empresa record;
  v_nichos text[] := ARRAY[
    'Restaurante', 'Padaria', 'Confeitaria', 'Pizzaria', 'Lanchonete', 'Hamburgueria',
    'Café', 'Açougue', 'Mercado', 'Supermercado', 'Hotel', 'Hospital', 'Clínica',
    'Escola', 'Creche', 'Cozinha Industrial', 'Indústria de Alimentos', 'Sorveteria'
  ];
  v_nome text;
  v_ordem int;
BEGIN
  FOR v_empresa IN SELECT id FROM public.empresas LOOP
    v_ordem := 1;
    FOREACH v_nome IN ARRAY v_nichos LOOP
      INSERT INTO public.crm_leads_nichos (empresa_id, nome, ordem)
        VALUES (v_empresa.id, v_nome, v_ordem)
        ON CONFLICT (empresa_id, nome) DO NOTHING;
      v_ordem := v_ordem + 1;
    END LOOP;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.crm_seed_catalogos_padrao(p_empresa_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
  v_pipeline_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.crm_pipelines WHERE empresa_id = p_empresa_id) THEN
    INSERT INTO public.crm_pipelines (empresa_id, nome, padrao)
      VALUES (p_empresa_id, 'Pipeline Padrão', true)
      RETURNING id INTO v_pipeline_id;

    INSERT INTO public.crm_etapas (empresa_id, pipeline_id, nome, ordem, tipo) VALUES
      (p_empresa_id, v_pipeline_id, 'Novo Lead', 1, 'aberta'),
      (p_empresa_id, v_pipeline_id, 'Qualificação', 2, 'aberta'),
      (p_empresa_id, v_pipeline_id, 'Proposta Enviada', 3, 'aberta'),
      (p_empresa_id, v_pipeline_id, 'Negociação', 4, 'aberta'),
      (p_empresa_id, v_pipeline_id, 'Ganho', 5, 'ganho'),
      (p_empresa_id, v_pipeline_id, 'Perdido', 6, 'perdido');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.crm_motivos_perda WHERE empresa_id = p_empresa_id) THEN
    INSERT INTO public.crm_motivos_perda (empresa_id, nome, ordem) VALUES
      (p_empresa_id, 'Preço', 1),
      (p_empresa_id, 'Concorrência', 2),
      (p_empresa_id, 'Sem orçamento', 3),
      (p_empresa_id, 'Não respondeu', 4),
      (p_empresa_id, 'Projeto cancelado', 5),
      (p_empresa_id, 'Decisão interna', 6),
      (p_empresa_id, 'Outro', 7);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.crm_tipos_atividade WHERE empresa_id = p_empresa_id) THEN
    INSERT INTO public.crm_tipos_atividade (empresa_id, nome, ordem) VALUES
      (p_empresa_id, 'Ligação', 1),
      (p_empresa_id, 'WhatsApp', 2),
      (p_empresa_id, 'Email', 3),
      (p_empresa_id, 'Reunião', 4),
      (p_empresa_id, 'Visita', 5),
      (p_empresa_id, 'Videochamada', 6),
      (p_empresa_id, 'Tarefa', 7);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.crm_origens_lead WHERE empresa_id = p_empresa_id) THEN
    INSERT INTO public.crm_origens_lead (empresa_id, nome, peso_score, ordem) VALUES
      (p_empresa_id, 'Indicação', 20, 1),
      (p_empresa_id, 'Site', 10, 2),
      (p_empresa_id, 'Redes Sociais', 10, 3),
      (p_empresa_id, 'Evento', 15, 4),
      (p_empresa_id, 'Prospecção Ativa', 5, 5),
      (p_empresa_id, 'Outro', 0, 6),
      (p_empresa_id, 'Google Maps', 5, 7);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.crm_leads_config WHERE empresa_id = p_empresa_id) THEN
    INSERT INTO public.crm_leads_config (empresa_id) VALUES (p_empresa_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.crm_leads_nichos WHERE empresa_id = p_empresa_id) THEN
    INSERT INTO public.crm_leads_nichos (empresa_id, nome, ordem) VALUES
      (p_empresa_id, 'Restaurante', 1),
      (p_empresa_id, 'Padaria', 2),
      (p_empresa_id, 'Confeitaria', 3),
      (p_empresa_id, 'Pizzaria', 4),
      (p_empresa_id, 'Lanchonete', 5),
      (p_empresa_id, 'Hamburgueria', 6),
      (p_empresa_id, 'Café', 7),
      (p_empresa_id, 'Açougue', 8),
      (p_empresa_id, 'Mercado', 9),
      (p_empresa_id, 'Supermercado', 10),
      (p_empresa_id, 'Hotel', 11),
      (p_empresa_id, 'Hospital', 12),
      (p_empresa_id, 'Clínica', 13),
      (p_empresa_id, 'Escola', 14),
      (p_empresa_id, 'Creche', 15),
      (p_empresa_id, 'Cozinha Industrial', 16),
      (p_empresa_id, 'Indústria de Alimentos', 17),
      (p_empresa_id, 'Sorveteria', 18);
  END IF;
END;
$function$;
