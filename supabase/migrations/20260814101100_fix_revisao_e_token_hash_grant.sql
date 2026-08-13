-- Fase B — mais 2 correções encontradas pelos testes:
--
-- 1) crm_criar_revisao_proposta: "column reference proposta_id is ambiguous".
--    RETURNS TABLE (proposta_id uuid) declara implicitamente uma variável
--    plpgsql chamada "proposta_id" (mesmo nome da coluna da tabela
--    crm_proposta_itens) — a cláusula WHERE proposta_id = v_atual.id ficava
--    ambígua entre a coluna e essa variável de saída. Corrigido com um
--    alias explícito na subquery.
-- 2) GRANT de coluna não é suficiente pra restringir token_hash: GRANT
--    nunca remove privilégio, só adiciona — e este projeto já tem GRANT
--    amplo pra "authenticated" via privilégios padrão do schema, então o
--    GRANT de coluna estreito da migration anterior não tinha efeito
--    nenhum (a tabela inteira, incluindo token_hash, continuava visível).
--    Corrigido com REVOKE explícito antes do GRANT estreito.

CREATE OR REPLACE FUNCTION public.crm_criar_revisao_proposta(p_proposta_id uuid)
RETURNS TABLE (proposta_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_perfil text;
  v_minha_empresa uuid;
  v_atual public.crm_propostas;
  v_novo_id uuid;
BEGIN
  SELECT perfil, empresa_id INTO v_perfil, v_minha_empresa FROM public.profiles WHERE id = auth.uid();
  IF v_perfil NOT IN ('admin', 'consultor') AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Sem permissão para criar revisão de proposta.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_atual FROM public.crm_propostas WHERE id = p_proposta_id FOR UPDATE;
  IF v_atual.id IS NULL THEN
    RAISE EXCEPTION 'Proposta não encontrada ou sem permissão.' USING ERRCODE = 'P0002';
  END IF;
  IF v_atual.empresa_id <> v_minha_empresa AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Proposta não pertence ao seu tenant.' USING ERRCODE = '42501';
  END IF;

  IF v_atual.status NOT IN ('gerada', 'enviada') THEN
    RAISE EXCEPTION 'PROPOSTA_REVISAO_INVALIDA: só é possível criar uma nova revisão a partir de uma proposta gerada ou enviada (status atual: %).', v_atual.status;
  END IF;

  UPDATE public.crm_propostas SET status = 'substituida' WHERE id = v_atual.id;

  v_novo_id := gen_random_uuid();
  INSERT INTO public.crm_propostas (
    id, empresa_id, crm_oportunidade_id, crm_empresa_id, grupo_proposta_id,
    numero_revisao, revisao_anterior_id, status, valor_total
  ) VALUES (
    v_novo_id, v_atual.empresa_id, v_atual.crm_oportunidade_id, v_atual.crm_empresa_id, v_atual.grupo_proposta_id,
    v_atual.numero_revisao + 1, v_atual.id, 'rascunho', v_atual.valor_total
  );

  INSERT INTO public.crm_proposta_itens (empresa_id, proposta_id, servico_catalogo_id, nome, descricao, valor, ordem)
    SELECT itens.empresa_id, v_novo_id, itens.servico_catalogo_id, itens.nome, itens.descricao, itens.valor, itens.ordem
    FROM public.crm_proposta_itens AS itens WHERE itens.proposta_id = v_atual.id;

  PERFORM public.crm_registrar_timeline_sistema(
    v_atual.crm_oportunidade_id, 'proposta_substituida', 'Nova revisão de proposta criada.',
    jsonb_build_object('revisao_anterior_id', v_atual.id, 'nova_revisao_id', v_novo_id, 'numero_revisao', v_atual.numero_revisao + 1)
  );

  RETURN QUERY SELECT v_novo_id;
END;
$function$;

REVOKE SELECT ON public.crm_documentos_links FROM authenticated;
GRANT SELECT (id, empresa_id, tipo, proposta_id, contrato_id, expira_em, revogado_em, created_by, created_at)
  ON public.crm_documentos_links TO authenticated;
