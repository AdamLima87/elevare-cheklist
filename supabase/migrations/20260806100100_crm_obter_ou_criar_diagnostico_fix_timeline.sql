-- Fase 4 (Diagnóstico no CRM) — corrige bug encontrado em staging pelo
-- script de testes: crm_obter_ou_criar_diagnostico é SECURITY INVOKER (por
-- desenho, mesmo padrão de crm_fechar_oportunidade_ganha — não precisa de
-- privilégio elevado pras operações em crm_oportunidades/inspecoes, que já
-- são cobertas pela RLS dessas tabelas). Mas o INSERT direto em
-- crm_timeline com origem='sistema' viola a RLS: a única policy de INSERT
-- de crm_timeline pro client (crm_timeline_insert_usuario) exige
-- origem='usuario' — eventos origem='sistema' hoje só são gravados por
-- triggers SECURITY DEFINER (crm_oportunidades_log_etapa_timeline), nunca
-- por INSERT direto de uma função SECURITY INVOKER.
--
-- Correção: delega o INSERT de timeline a uma função auxiliar SECURITY
-- DEFINER dedicada, que revalida acesso à oportunidade antes de gravar —
-- em vez de tornar a RPC inteira SECURITY DEFINER (o que bypassaria RLS
-- também nas operações em crm_oportunidades/inspecoes, perdendo a garantia
-- de isolamento por tenant que hoje vem só da RLS dessas tabelas).

CREATE FUNCTION public.crm_registrar_timeline_sistema(
  p_crm_oportunidade_id uuid,
  p_evento_tipo text,
  p_descricao text,
  p_metadata jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_oportunidade public.crm_oportunidades;
BEGIN
  SELECT * INTO v_oportunidade FROM public.crm_oportunidades WHERE id = p_crm_oportunidade_id;
  IF v_oportunidade.id IS NULL THEN
    RAISE EXCEPTION 'Oportunidade não encontrada.';
  END IF;

  -- Revalida explicitamente: SECURITY DEFINER bypassa RLS, então a
  -- checagem de tenant/permissão precisa ser feita aqui manualmente, não
  -- herdada da tabela.
  IF NOT public.can_access_crm()
     OR (NOT public.is_super_admin() AND v_oportunidade.empresa_id <> public.get_minha_empresa())
  THEN
    RAISE EXCEPTION 'Sem permissão para registrar evento nesta oportunidade.';
  END IF;

  INSERT INTO public.crm_timeline (
    empresa_id, crm_empresa_id, crm_oportunidade_id, autor_id,
    origem, evento_tipo, descricao, metadata
  ) VALUES (
    v_oportunidade.empresa_id, v_oportunidade.crm_empresa_id, p_crm_oportunidade_id, auth.uid(),
    'sistema', p_evento_tipo, p_descricao, p_metadata
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.crm_registrar_timeline_sistema(uuid, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_registrar_timeline_sistema(uuid, text, text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.crm_obter_ou_criar_diagnostico(p_oportunidade_id uuid)
RETURNS TABLE (inspecao_id uuid, criado boolean)
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
DECLARE
  v_oportunidade public.crm_oportunidades;
  v_empresa_id uuid;
  v_inspecao_id uuid;
  v_numero integer;
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

  SELECT public.get_next_numero_inspecao() INTO v_numero;

  INSERT INTO public.inspecoes (
    empresa_id, cliente_id, crm_oportunidade_id, tipo_execucao,
    consultor_id, numero_sequencial, status, estabelecimento_nome,
    data_inicio, progresso, dados, respostas
  ) VALUES (
    v_empresa_id, NULL, p_oportunidade_id, 'diagnostico',
    auth.uid(), v_numero, 'em_andamento', '',
    now(), 0, '{}'::jsonb, '{}'::jsonb
  )
  RETURNING id INTO v_inspecao_id;

  PERFORM public.crm_registrar_timeline_sistema(
    p_oportunidade_id, 'diagnostico_iniciado', 'Diagnóstico inicial iniciado.',
    jsonb_build_object('inspecao_id', v_inspecao_id)
  );

  RETURN QUERY SELECT v_inspecao_id, true;
END;
$function$;

REVOKE ALL ON FUNCTION public.crm_obter_ou_criar_diagnostico(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_obter_ou_criar_diagnostico(uuid) TO authenticated;
