-- Furo achado em teste de consistência: crm_seed_catalogos_padrao (rodada
-- pra TODO tenant novo via provision_tenant) nunca foi atualizada quando a
-- coluna crm_etapas.eh_proposta foi criada (20260812160000). A migration de
-- backfill daquela fase só corrigiu os tenants já existentes na hora --
-- qualquer tenant provisionado depois nasceria com "Proposta Enviada"
-- criada com eh_proposta=false (default da coluna), quebrando o card
-- "Propostas aguardando resposta" da Mesa de Trabalho até um admin entrar
-- em Configurações e marcar o toggle manualmente.
--
-- Corpo idêntico ao da última versão (20260727100000), só com eh_proposta
-- adicionado na etapa "Proposta Enviada".
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
END;
$function$;
