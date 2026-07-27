-- Fase 7.11 (achado pelo smoke test de produção pós-publicação) — iniciar_reinspecao
-- criava a nova inspeção com dados = '{}'::jsonb, mas cnpj/estabelecimento_nome só
-- eram copiados nas colunas planas (cnpj, estabelecimento_nome), não dentro do JSON
-- dados.estabelecimento — que é o que o frontend (pushInspecaoToCloud) de fato lê pra
-- resolver o cliente_id via findOrCreateCliente. Com dados.estabelecimento.cnpj vazio,
-- cada autosave da reinspeção criava um novo cliente duplicado (findOrCreateCliente só
-- busca o existente quando recebe um cnpj não vazio). Corrige copiando
-- dados->'estabelecimento' da inspeção de origem para a nova.
CREATE OR REPLACE FUNCTION public.iniciar_reinspecao(
  p_programacao_id uuid,
  p_responsavel_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_prog public.reinspecao_programacoes;
  v_origem public.inspecoes;
  v_minha_empresa uuid;
  v_numero integer;
  v_nova_inspecao_id uuid;
  v_consultor_id uuid;
  v_dados jsonb;
BEGIN
  SELECT empresa_id INTO v_minha_empresa FROM public.profiles WHERE id = auth.uid();
  SELECT * INTO v_prog FROM public.reinspecao_programacoes WHERE id = p_programacao_id FOR UPDATE;
  IF v_prog.id IS NULL THEN
    RAISE EXCEPTION 'Programação não encontrada.' USING ERRCODE = 'P0002';
  END IF;
  IF v_prog.empresa_id <> v_minha_empresa AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;
  IF v_prog.status NOT IN ('programada', 'reagendada') OR v_prog.inspecao_criada_id IS NOT NULL THEN
    RAISE EXCEPTION 'Reinspeção já foi iniciada ou a programação não está mais em aberto.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_origem FROM public.inspecoes WHERE id = v_prog.inspecao_origem_id;
  IF v_origem.id IS NULL THEN
    RAISE EXCEPTION 'Inspeção de origem não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  v_consultor_id := COALESCE(p_responsavel_id, v_prog.responsavel_id, auth.uid());
  SELECT public.get_next_numero_inspecao() INTO v_numero;

  v_dados := jsonb_build_object('estabelecimento', COALESCE(v_origem.dados->'estabelecimento', '{}'::jsonb));

  INSERT INTO public.inspecoes (
    empresa_id, cliente_id, crm_oportunidade_id, tipo_execucao, inspecao_origem_id,
    consultor_id, numero_sequencial, status, estabelecimento_nome, cnpj,
    data_inicio, progresso, dados, respostas, checklist_modelo_versao_id
  ) VALUES (
    v_origem.empresa_id, v_origem.cliente_id, NULL, 'reinspecao', v_origem.id,
    v_consultor_id, v_numero, 'em_andamento', v_origem.estabelecimento_nome, v_origem.cnpj,
    now(), 0, v_dados, '{}'::jsonb, v_origem.checklist_modelo_versao_id
  ) RETURNING id INTO v_nova_inspecao_id;

  UPDATE public.reinspecao_programacoes
    SET status = 'iniciada', inspecao_criada_id = v_nova_inspecao_id,
        responsavel_id = COALESCE(p_responsavel_id, responsavel_id), updated_at = now()
    WHERE id = p_programacao_id;

  INSERT INTO public.reinspecao_programacao_eventos (programacao_id, evento_tipo, autor_id)
    VALUES (p_programacao_id, 'iniciada', auth.uid());

  RETURN v_nova_inspecao_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.iniciar_reinspecao(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.iniciar_reinspecao(uuid, uuid) TO authenticated;
