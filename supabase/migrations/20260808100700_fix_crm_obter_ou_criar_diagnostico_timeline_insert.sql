-- Fase 7.11 — corrige bug encontrado pela suíte de testes: a migration
-- 20260808100300 (que adicionou p_checklist_modelo_versao_id) recriou
-- crm_obter_ou_criar_diagnostico com um INSERT direto em crm_timeline
-- (origem='sistema'), reintroduzindo exatamente o bug já corrigido na
-- Fase 4 (20260806100100_crm_obter_ou_criar_diagnostico_fix_timeline.sql) —
-- a única policy de INSERT de crm_timeline pro client exige origem='usuario'.
-- Volta a delegar para crm_registrar_timeline_sistema (SECURITY DEFINER).
CREATE OR REPLACE FUNCTION public.crm_obter_ou_criar_diagnostico(
  p_oportunidade_id uuid,
  p_checklist_modelo_versao_id uuid DEFAULT NULL
)
RETURNS TABLE (inspecao_id uuid, criado boolean)
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
DECLARE
  v_oportunidade public.crm_oportunidades;
  v_empresa_id uuid;
  v_inspecao_id uuid;
  v_numero integer;
  v_modelo_versao_id uuid;
BEGIN
  SELECT * INTO v_oportunidade FROM public.crm_oportunidades
    WHERE id = p_oportunidade_id FOR UPDATE;
  IF v_oportunidade.id IS NULL THEN
    RAISE EXCEPTION 'Oportunidade não encontrada ou sem permissão.';
  END IF;
  v_empresa_id := v_oportunidade.empresa_id;

  SELECT id INTO v_inspecao_id FROM public.inspecoes
    WHERE crm_oportunidade_id = p_oportunidade_id AND tipo_execucao = 'diagnostico'
    ORDER BY data_inicio ASC LIMIT 1;

  IF v_inspecao_id IS NOT NULL THEN
    RETURN QUERY SELECT v_inspecao_id, false;
    RETURN;
  END IF;

  v_modelo_versao_id := COALESCE(p_checklist_modelo_versao_id, public.resolver_checklist_modelo_padrao());
  IF v_modelo_versao_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum modelo de checklist padrão disponível.' USING ERRCODE = 'P0002';
  END IF;

  SELECT public.get_next_numero_inspecao() INTO v_numero;

  INSERT INTO public.inspecoes (
    empresa_id, cliente_id, crm_oportunidade_id, tipo_execucao,
    consultor_id, numero_sequencial, status, estabelecimento_nome,
    data_inicio, progresso, dados, respostas, checklist_modelo_versao_id
  ) VALUES (
    v_empresa_id, NULL, p_oportunidade_id, 'diagnostico',
    auth.uid(), v_numero, 'em_andamento', '',
    now(), 0, '{}'::jsonb, '{}'::jsonb, v_modelo_versao_id
  )
  RETURNING id INTO v_inspecao_id;

  PERFORM public.crm_registrar_timeline_sistema(
    p_oportunidade_id, 'diagnostico_iniciado', 'Diagnóstico inicial iniciado.',
    jsonb_build_object('inspecao_id', v_inspecao_id)
  );

  RETURN QUERY SELECT v_inspecao_id, true;
END;
$function$;

REVOKE ALL ON FUNCTION public.crm_obter_ou_criar_diagnostico(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_obter_ou_criar_diagnostico(uuid, uuid) TO authenticated;
