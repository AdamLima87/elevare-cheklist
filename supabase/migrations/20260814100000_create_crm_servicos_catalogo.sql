-- Fase B do módulo comercial — catálogo de serviços por tenant. Cada Conta
-- monta propostas escolhendo linhas daqui (com valor editável por linha na
-- hora de montar a proposta). valor_padrao nasce NULL — cada consultoria
-- define seu próprio preço, não impomos nenhum.
CREATE TABLE public.crm_servicos_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  nome text NOT NULL,
  descricao text,
  valor_padrao numeric(12,2),
  ativo boolean NOT NULL DEFAULT true,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, nome)
);
ALTER TABLE public.crm_servicos_catalogo ADD CONSTRAINT crm_servicos_catalogo_id_empresa_unique UNIQUE (id, empresa_id);

CREATE INDEX crm_servicos_catalogo_empresa_idx ON public.crm_servicos_catalogo (empresa_id, ativo, ordem);

CREATE TRIGGER update_crm_servicos_catalogo_updated_at
  BEFORE UPDATE ON public.crm_servicos_catalogo
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_servicos_catalogo TO authenticated;
GRANT ALL ON public.crm_servicos_catalogo TO service_role;
ALTER TABLE public.crm_servicos_catalogo ENABLE ROW LEVEL SECURITY;

-- Mesmo padrão de crm_leads_nichos: select admin+consultor, write admin-only
-- (catálogo/preço é decisão de gestão do tenant, não operação do dia a dia).
CREATE POLICY crm_servicos_catalogo_select ON public.crm_servicos_catalogo
  FOR SELECT USING (
    public.is_super_admin()
    OR (empresa_id = public.get_minha_empresa()
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil IN ('admin', 'consultor')))
  );
CREATE POLICY crm_servicos_catalogo_write ON public.crm_servicos_catalogo
  FOR INSERT WITH CHECK (
    public.is_super_admin()
    OR (empresa_id = public.get_minha_empresa()
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil = 'admin'))
  );
CREATE POLICY crm_servicos_catalogo_update ON public.crm_servicos_catalogo
  FOR UPDATE USING (
    public.is_super_admin()
    OR (empresa_id = public.get_minha_empresa()
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil = 'admin'))
  );
CREATE POLICY crm_servicos_catalogo_delete ON public.crm_servicos_catalogo
  FOR DELETE USING (
    public.is_super_admin()
    OR (empresa_id = public.get_minha_empresa()
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil = 'admin'))
  );

-- Estende o seed padrão (mesma função, CREATE OR REPLACE, corpo idêntico ao
-- de 20260813150200 + o bloco novo de crm_servicos_catalogo — lição já
-- aplicada nas fases anteriores: nunca deixar o seed de tenants novos
-- dessincronizado de uma tabela nova). valor_padrao fica NULL — cada tenant
-- define o seu preço.
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

    INSERT INTO public.crm_etapas (empresa_id, pipeline_id, nome, ordem, tipo, eh_proposta) VALUES
      (p_empresa_id, v_pipeline_id, 'Novo Lead', 1, 'aberta', false),
      (p_empresa_id, v_pipeline_id, 'Qualificação', 2, 'aberta', false),
      (p_empresa_id, v_pipeline_id, 'Proposta Enviada', 3, 'aberta', true),
      (p_empresa_id, v_pipeline_id, 'Negociação', 4, 'aberta', false),
      (p_empresa_id, v_pipeline_id, 'Ganho', 5, 'ganho', false),
      (p_empresa_id, v_pipeline_id, 'Perdido', 6, 'perdido', false);
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

  IF NOT EXISTS (SELECT 1 FROM public.crm_comercial_config WHERE empresa_id = p_empresa_id) THEN
    INSERT INTO public.crm_comercial_config (empresa_id) VALUES (p_empresa_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.crm_servicos_catalogo WHERE empresa_id = p_empresa_id) THEN
    INSERT INTO public.crm_servicos_catalogo (empresa_id, nome, ordem) VALUES
      (p_empresa_id, 'Consultoria de Impacto', 1),
      (p_empresa_id, 'Tabela Nutricional', 2),
      (p_empresa_id, 'Rotulagem', 3),
      (p_empresa_id, 'Ficha Técnica', 4),
      (p_empresa_id, 'Avaliação de BPF / Diagnóstico Inicial', 5),
      (p_empresa_id, 'Implementação de Boas Práticas', 6),
      (p_empresa_id, 'Treinamentos', 7);
  END IF;
END;
$function$;

-- Backfill: tenants já existentes ganham o catálogo padrão agora.
INSERT INTO public.crm_servicos_catalogo (empresa_id, nome, ordem)
SELECT e.id, v.nome, v.ordem
FROM public.empresas e
CROSS JOIN (VALUES
  ('Consultoria de Impacto', 1),
  ('Tabela Nutricional', 2),
  ('Rotulagem', 3),
  ('Ficha Técnica', 4),
  ('Avaliação de BPF / Diagnóstico Inicial', 5),
  ('Implementação de Boas Práticas', 6),
  ('Treinamentos', 7)
) AS v(nome, ordem)
WHERE NOT EXISTS (SELECT 1 FROM public.crm_servicos_catalogo s WHERE s.empresa_id = e.id);
