-- CRM Comercial — seed padrão dos catálogos configuráveis (pipeline/etapas/
-- motivos de perda/tipos de atividade/origens de lead) para um tenant.
-- Idempotente: cada bloco só insere se o tenant ainda não tiver nenhuma
-- linha naquele catálogo, então pode ser chamada com segurança tanto no
-- backfill de tenants existentes (migration seguinte) quanto dentro de
-- provision_tenant() para tenants futuros.
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
      (p_empresa_id, 'Outro', 0, 6);
  END IF;
END;
$function$;
