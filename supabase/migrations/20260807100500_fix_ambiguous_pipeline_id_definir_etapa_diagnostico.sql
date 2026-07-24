-- Fase 5 — corrige "column reference pipeline_id is ambiguous", encontrado
-- pelo script de testes em staging. Mesmo gotcha de PL/pgSQL já visto e
-- corrigido em aplicar_cupom_checkout e crm_fechar_oportunidade_ganha
-- nesta sessão: RETURNS TABLE (pipeline_id uuid, ...) cria uma variável
-- implícita chamada pipeline_id no escopo da função, que colide com toda
-- referência não qualificada a crm_etapas.pipeline_id no corpo. Assinatura
-- e retorno idênticos — CREATE OR REPLACE é suficiente, sem precisar de
-- DROP (não muda a lista de argumentos desta vez).

CREATE OR REPLACE FUNCTION public.crm_definir_etapa_diagnostico(p_pipeline_id uuid, p_etapa_id uuid DEFAULT NULL)
RETURNS TABLE (pipeline_id uuid, etapa_diagnostico_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_empresa_id uuid;
  v_perfil text;
  v_pipeline_empresa_id uuid;
  v_etapa record;
  v_etapa_anterior_id uuid;
BEGIN
  IF NOT public.can_access_crm() THEN
    RAISE EXCEPTION 'Sem permissão para acessar o CRM.' USING ERRCODE = '42501';
  END IF;

  SELECT perfil, empresa_id INTO v_perfil, v_empresa_id
  FROM public.profiles WHERE id = auth.uid();

  IF v_perfil IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Apenas administradores do tenant podem configurar a etapa de Diagnóstico.'
      USING ERRCODE = '42501';
  END IF;

  SELECT empresa_id INTO v_pipeline_empresa_id
  FROM public.crm_pipelines WHERE id = p_pipeline_id;

  IF v_pipeline_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Pipeline não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  IF v_pipeline_empresa_id <> v_empresa_id THEN
    RAISE EXCEPTION 'Pipeline não pertence ao seu tenant.' USING ERRCODE = '42501';
  END IF;

  SELECT ce.id INTO v_etapa_anterior_id
  FROM public.crm_etapas ce WHERE ce.pipeline_id = p_pipeline_id AND ce.gera_diagnostico = true;

  IF p_etapa_id IS NULL THEN
    UPDATE public.crm_etapas ce SET gera_diagnostico = false
      WHERE ce.pipeline_id = p_pipeline_id AND ce.gera_diagnostico = true;

    INSERT INTO public.audit_log (empresa_id, actor_id, event_type, metadata)
      VALUES (
        v_empresa_id, auth.uid(), 'crm_etapa_diagnostico_removida',
        jsonb_build_object('pipeline_id', p_pipeline_id, 'etapa_anterior_id', v_etapa_anterior_id)
      );

    RETURN QUERY SELECT p_pipeline_id, NULL::uuid;
    RETURN;
  END IF;

  SELECT ce.* INTO v_etapa FROM public.crm_etapas ce WHERE ce.id = p_etapa_id AND ce.pipeline_id = p_pipeline_id;
  IF v_etapa.id IS NULL THEN
    RAISE EXCEPTION 'Etapa não encontrada neste pipeline.' USING ERRCODE = 'P0002';
  END IF;
  IF v_etapa.tipo <> 'aberta' THEN
    RAISE EXCEPTION 'Apenas etapas do tipo "aberta" podem ser marcadas como etapa de Diagnóstico.'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.crm_etapas ce SET gera_diagnostico = false
    WHERE ce.pipeline_id = p_pipeline_id AND ce.gera_diagnostico = true AND ce.id <> p_etapa_id;
  UPDATE public.crm_etapas ce SET gera_diagnostico = true WHERE ce.id = p_etapa_id;

  INSERT INTO public.audit_log (empresa_id, actor_id, event_type, metadata)
    VALUES (
      v_empresa_id, auth.uid(), 'crm_etapa_diagnostico_definida',
      jsonb_build_object(
        'pipeline_id', p_pipeline_id,
        'etapa_anterior_id', v_etapa_anterior_id,
        'etapa_nova_id', p_etapa_id
      )
    );

  RETURN QUERY SELECT p_pipeline_id, p_etapa_id;
END;
$function$;
