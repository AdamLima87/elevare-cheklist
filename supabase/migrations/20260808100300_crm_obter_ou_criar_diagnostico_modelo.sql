-- Fase 7.6 — crm_obter_ou_criar_diagnostico passa a aceitar qual modelo de
-- checklist usar, com resolver_checklist_modelo_padrao() como default.
-- Assinatura muda (novo parâmetro) — mesmo gotcha já documentado e sofrido
-- nas Fases 4/5: CREATE OR REPLACE com lista de argumentos diferente cria
-- um overload novo em vez de substituir. DROP explícito primeiro.
DROP FUNCTION IF EXISTS public.crm_obter_ou_criar_diagnostico(uuid);

CREATE FUNCTION public.crm_obter_ou_criar_diagnostico(
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

  -- Idempotente: chamada repetida retorna a linha existente sem alterar o
  -- modelo já escolhido, mesmo que um p_checklist_modelo_versao_id diferente
  -- seja passado na segunda chamada — a escolha do modelo é fixada na
  -- criação, não é mutável via esta RPC.
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

  INSERT INTO public.crm_timeline (
    empresa_id, crm_empresa_id, crm_oportunidade_id, autor_id,
    origem, evento_tipo, descricao, metadata
  ) VALUES (
    v_empresa_id, v_oportunidade.crm_empresa_id, p_oportunidade_id, auth.uid(),
    'sistema', 'diagnostico_iniciado', 'Diagnóstico inicial iniciado.',
    jsonb_build_object('inspecao_id', v_inspecao_id)
  );

  RETURN QUERY SELECT v_inspecao_id, true;
END;
$function$;

REVOKE ALL ON FUNCTION public.crm_obter_ou_criar_diagnostico(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_obter_ou_criar_diagnostico(uuid, uuid) TO authenticated;
