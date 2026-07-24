-- Fase 4 (Diagnóstico no CRM) — unicidade do Diagnóstico Inicial garantida
-- no backend, não apenas no frontend. Duas chamadas concorrentes para a
-- mesma oportunidade (duplo clique, duas abas) nunca criam duas linhas:
-- o SELECT ... FOR UPDATE na oportunidade serializa a segunda chamada até a
-- primeira committar, e o índice único parcial abaixo é a defesa
-- estrutural independente de qual caminho de escrita é usado.
--
-- Pré-requisito confirmado por scripts/prevalidacao-diagnostico-crm.mjs
-- (seção 14) antes de aplicar: zero oportunidades com mais de um
-- diagnóstico em staging — esperado, já que a Fase 4 ainda não existe.

CREATE UNIQUE INDEX inspecoes_diagnostico_unico_por_oportunidade
  ON public.inspecoes (empresa_id, crm_oportunidade_id)
  WHERE tipo_execucao = 'diagnostico';

CREATE FUNCTION public.crm_obter_ou_criar_diagnostico(p_oportunidade_id uuid)
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
  -- RLS de crm_oportunidades (tenant-wide, admin/consultor ativo via
  -- can_access_crm()) já resolve tenant + valida acesso ao CRM + valida que
  -- a oportunidade pertence ao usuário — mesma garantia usada por
  -- crm_fechar_oportunidade_ganha (Fase 3), sem checagem redundante aqui.
  SELECT * INTO v_oportunidade FROM public.crm_oportunidades
    WHERE id = p_oportunidade_id FOR UPDATE;
  IF v_oportunidade.id IS NULL THEN
    RAISE EXCEPTION 'Oportunidade não encontrada ou sem permissão.';
  END IF;
  v_empresa_id := v_oportunidade.empresa_id;

  -- Lock a nível de oportunidade (FOR UPDATE acima) já serializa duas
  -- chamadas concorrentes para a MESMA oportunidade — a segunda espera a
  -- primeira committar antes deste SELECT, então nunca vê "nenhum
  -- diagnóstico" simultaneamente com a primeira.
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

  -- Evento de timeline "iniciado" gravado aqui, não via nota de usuário
  -- solta: como este branch só executa uma vez por oportunidade (garantido
  -- pelo lock + índice único acima), a própria unicidade da criação já dá
  -- idempotência ao evento — sem precisar de chave lógica adicional.
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

REVOKE ALL ON FUNCTION public.crm_obter_ou_criar_diagnostico(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_obter_ou_criar_diagnostico(uuid) TO authenticated;
