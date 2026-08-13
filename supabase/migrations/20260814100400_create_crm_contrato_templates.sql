-- Fase B — template de contrato por tenant. Só 1 ativo por vez nesta versão
-- (índice único parcial), mas a tabela em si permite múltiplas linhas por
-- tenant — arquitetura já pronta pra "vários templates, um ativo" hoje e
-- "vários templates, todos endereçáveis" no futuro, sem migration nova.
-- conteudo é editável direto pelo tenant (não é RPC-only): admin escreve,
-- consultor lê.
CREATE TABLE public.crm_contrato_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  nome text NOT NULL,
  conteudo jsonb NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  versao int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_contrato_templates ADD CONSTRAINT crm_contrato_templates_id_empresa_unique UNIQUE (id, empresa_id);

CREATE UNIQUE INDEX crm_contrato_templates_ativo_idx
  ON public.crm_contrato_templates (empresa_id) WHERE ativo;

CREATE OR REPLACE FUNCTION public.crm_contrato_templates_incrementar_versao()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.conteudo IS DISTINCT FROM OLD.conteudo THEN
    NEW.versao := OLD.versao + 1;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER crm_contrato_templates_versao
  BEFORE UPDATE ON public.crm_contrato_templates
  FOR EACH ROW EXECUTE FUNCTION public.crm_contrato_templates_incrementar_versao();

CREATE TRIGGER update_crm_contrato_templates_updated_at
  BEFORE UPDATE ON public.crm_contrato_templates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_contrato_templates TO authenticated;
GRANT ALL ON public.crm_contrato_templates TO service_role;
ALTER TABLE public.crm_contrato_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY crm_contrato_templates_select ON public.crm_contrato_templates
  FOR SELECT USING (
    public.is_super_admin()
    OR (empresa_id = public.get_minha_empresa()
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil IN ('admin', 'consultor')))
  );
CREATE POLICY crm_contrato_templates_insert ON public.crm_contrato_templates
  FOR INSERT WITH CHECK (
    public.is_super_admin()
    OR (empresa_id = public.get_minha_empresa()
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil = 'admin'))
  );
CREATE POLICY crm_contrato_templates_update ON public.crm_contrato_templates
  FOR UPDATE USING (
    public.is_super_admin()
    OR (empresa_id = public.get_minha_empresa()
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil = 'admin'))
  );
CREATE POLICY crm_contrato_templates_delete ON public.crm_contrato_templates
  FOR DELETE USING (
    public.is_super_admin()
    OR (empresa_id = public.get_minha_empresa()
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil = 'admin'))
  );

-- Extensão do seed padrão de novo (mesmo corpo de 20260814100000 + o bloco
-- de crm_contrato_templates). Template genérico, estruturalmente inspirado
-- num contrato de prestação de serviços comum, mas com linguagem
-- deliberadamente de placeholder — nunca o texto jurídico de um cliente
-- específico copiado como se fosse pronto pra uso. A UI mostra sempre um
-- aviso fixo de revisão jurídica.
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

  IF NOT EXISTS (SELECT 1 FROM public.crm_contrato_templates WHERE empresa_id = p_empresa_id) THEN
    INSERT INTO public.crm_contrato_templates (empresa_id, nome, conteudo, ativo) VALUES (
      p_empresa_id, 'Modelo padrão (genérico)',
      '[
        {"titulo": "Das Partes", "corpo": "CONTRATADA: {{contratada.razao_social}}, inscrita no CNPJ sob o nº {{contratada.cnpj}}.\n\nCONTRATANTE: {{cliente.razao_social}}{{cliente.nome_completo_pf}}, inscrita/inscrito no CNPJ/CPF sob o nº {{cliente.cnpj}}{{cliente.cpf}}, neste ato representada por {{cliente.representante_legal}}."},
        {"titulo": "Do Objeto", "corpo": "O presente contrato tem por objeto a prestação dos seguintes serviços pela CONTRATADA à CONTRATANTE: {{proposta.servicos}}."},
        {"titulo": "Do Prazo", "corpo": "O prazo de vigência deste contrato é de {{contrato.prazo}}, contado a partir da assinatura."},
        {"titulo": "Do Valor e da Forma de Pagamento", "corpo": "Pela prestação dos serviços descritos, a CONTRATANTE pagará à CONTRATADA o valor total de {{proposta.valor_total}}, na forma: {{contrato.forma_pagamento}}."},
        {"titulo": "Das Obrigações das Partes", "corpo": "[Descreva aqui as obrigações específicas da CONTRATADA e da CONTRATANTE — este é um ponto de partida genérico.]"},
        {"titulo": "Da Rescisão", "corpo": "[Descreva aqui as condições de rescisão aplicáveis ao seu negócio.]"},
        {"titulo": "Da Confidencialidade e da LGPD", "corpo": "As partes se comprometem a manter sigilo sobre as informações trocadas durante a vigência deste contrato, observada a Lei Geral de Proteção de Dados (Lei nº 13.709/2018)."},
        {"titulo": "Do Foro", "corpo": "Fica eleito o foro da comarca de [defina a comarca] para dirimir quaisquer controvérsias oriundas deste contrato."}
      ]'::jsonb,
      true
    );
  END IF;
END;
$function$;

-- Backfill pra tenants já existentes.
INSERT INTO public.crm_contrato_templates (empresa_id, nome, conteudo, ativo)
SELECT e.id, 'Modelo padrão (genérico)',
  '[
    {"titulo": "Das Partes", "corpo": "CONTRATADA: {{contratada.razao_social}}, inscrita no CNPJ sob o nº {{contratada.cnpj}}.\n\nCONTRATANTE: {{cliente.razao_social}}{{cliente.nome_completo_pf}}, inscrita/inscrito no CNPJ/CPF sob o nº {{cliente.cnpj}}{{cliente.cpf}}, neste ato representada por {{cliente.representante_legal}}."},
    {"titulo": "Do Objeto", "corpo": "O presente contrato tem por objeto a prestação dos seguintes serviços pela CONTRATADA à CONTRATANTE: {{proposta.servicos}}."},
    {"titulo": "Do Prazo", "corpo": "O prazo de vigência deste contrato é de {{contrato.prazo}}, contado a partir da assinatura."},
    {"titulo": "Do Valor e da Forma de Pagamento", "corpo": "Pela prestação dos serviços descritos, a CONTRATANTE pagará à CONTRATADA o valor total de {{proposta.valor_total}}, na forma: {{contrato.forma_pagamento}}."},
    {"titulo": "Das Obrigações das Partes", "corpo": "[Descreva aqui as obrigações específicas da CONTRATADA e da CONTRATANTE — este é um ponto de partida genérico.]"},
    {"titulo": "Da Rescisão", "corpo": "[Descreva aqui as condições de rescisão aplicáveis ao seu negócio.]"},
    {"titulo": "Da Confidencialidade e da LGPD", "corpo": "As partes se comprometem a manter sigilo sobre as informações trocadas durante a vigência deste contrato, observada a Lei Geral de Proteção de Dados (Lei nº 13.709/2018)."},
    {"titulo": "Do Foro", "corpo": "Fica eleito o foro da comarca de [defina a comarca] para dirimir quaisquer controvérsias oriundas deste contrato."}
  ]'::jsonb,
  true
FROM public.empresas e
WHERE NOT EXISTS (SELECT 1 FROM public.crm_contrato_templates t WHERE t.empresa_id = e.id);
