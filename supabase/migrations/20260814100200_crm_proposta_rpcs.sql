-- Fase B — RPCs de proposta. Todas SECURITY DEFINER (a tabela não tem policy
-- de escrita pra authenticated), mesmo padrão de crm_definir_etapa_diagnostico
-- e das RPCs de reinspecao_programacoes: cada uma valida perfil/tenant
-- manualmente antes de escrever. empresa_id é sempre resolvido no servidor,
-- nunca confiado do client.

CREATE OR REPLACE FUNCTION public.crm_obter_ou_criar_proposta(p_oportunidade_id uuid)
RETURNS TABLE (proposta_id uuid, criado boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_perfil text;
  v_minha_empresa uuid;
  v_oportunidade public.crm_oportunidades;
  v_proposta public.crm_propostas;
  v_novo_id uuid;
BEGIN
  SELECT perfil, empresa_id INTO v_perfil, v_minha_empresa FROM public.profiles WHERE id = auth.uid();
  IF v_perfil NOT IN ('admin', 'consultor') AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Sem permissão para criar proposta.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_oportunidade FROM public.crm_oportunidades WHERE id = p_oportunidade_id FOR UPDATE;
  IF v_oportunidade.id IS NULL THEN
    RAISE EXCEPTION 'Oportunidade não encontrada ou sem permissão.' USING ERRCODE = 'P0002';
  END IF;
  IF v_oportunidade.empresa_id <> v_minha_empresa AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Oportunidade não pertence ao seu tenant.' USING ERRCODE = '42501';
  END IF;

  -- Só reaproveita uma revisão ainda não-terminal (rascunho/gerada/enviada).
  -- 'aceita' encerra o grupo pra sempre — uma renegociação depois do aceite
  -- sempre cai no ramo de baixo e cria um grupo NOVO (nunca reabre a aceita).
  SELECT * INTO v_proposta FROM public.crm_propostas
    WHERE crm_oportunidade_id = p_oportunidade_id AND status IN ('rascunho', 'gerada', 'enviada')
    ORDER BY created_at DESC LIMIT 1 FOR UPDATE;

  IF v_proposta.id IS NOT NULL THEN
    RETURN QUERY SELECT v_proposta.id, false;
    RETURN;
  END IF;

  v_novo_id := gen_random_uuid();
  INSERT INTO public.crm_propostas (id, empresa_id, crm_oportunidade_id, crm_empresa_id, grupo_proposta_id, numero_revisao, status)
    VALUES (v_novo_id, v_oportunidade.empresa_id, p_oportunidade_id, v_oportunidade.crm_empresa_id, v_novo_id, 1, 'rascunho');

  PERFORM public.crm_registrar_timeline_sistema(
    p_oportunidade_id, 'proposta_criada', 'Proposta comercial criada (revisão 1).',
    jsonb_build_object('proposta_id', v_novo_id, 'numero_revisao', 1)
  );

  RETURN QUERY SELECT v_novo_id, true;
END;
$function$;
REVOKE ALL ON FUNCTION public.crm_obter_ou_criar_proposta(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_obter_ou_criar_proposta(uuid) TO authenticated;


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

  -- Regra fechada: só a partir de 'gerada'/'enviada'. Uma revisão 'aceita'
  -- é terminal pro grupo — renegociação pós-aceite é proposta nova (novo
  -- grupo), não mais uma revisão desta. 'rascunho' edita a si mesma via
  -- crm_salvar_itens_proposta, sem precisar de revisão nova.
  IF v_atual.status NOT IN ('gerada', 'enviada') THEN
    RAISE EXCEPTION 'PROPOSTA_REVISAO_INVALIDA: só é possível criar uma nova revisão a partir de uma proposta gerada ou enviada (status atual: %).', v_atual.status;
  END IF;

  -- Marca a revisão atual como substituida ANTES de inserir a nova — o
  -- índice único parcial permite só 1 linha não-terminal por grupo, e as
  -- duas coexistiriam (mesmo que por um instante) se a ordem fosse invertida.
  UPDATE public.crm_propostas SET status = 'substituida' WHERE id = v_atual.id;

  v_novo_id := gen_random_uuid();
  INSERT INTO public.crm_propostas (
    id, empresa_id, crm_oportunidade_id, crm_empresa_id, grupo_proposta_id,
    numero_revisao, revisao_anterior_id, status, valor_total
  ) VALUES (
    v_novo_id, v_atual.empresa_id, v_atual.crm_oportunidade_id, v_atual.crm_empresa_id, v_atual.grupo_proposta_id,
    v_atual.numero_revisao + 1, v_atual.id, 'rascunho', v_atual.valor_total
  );

  -- Aliasado explicitamente: RETURNS TABLE (proposta_id uuid) declara uma
  -- variável plpgsql implícita "proposta_id" que colide com a coluna de
  -- mesmo nome — sem o alias, o WHERE fica ambíguo.
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
REVOKE ALL ON FUNCTION public.crm_criar_revisao_proposta(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_criar_revisao_proposta(uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.crm_salvar_itens_proposta(p_proposta_id uuid, p_itens jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_perfil text;
  v_minha_empresa uuid;
  v_proposta public.crm_propostas;
  v_total numeric(12,2);
BEGIN
  SELECT perfil, empresa_id INTO v_perfil, v_minha_empresa FROM public.profiles WHERE id = auth.uid();
  IF v_perfil NOT IN ('admin', 'consultor') AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Sem permissão para editar proposta.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_proposta FROM public.crm_propostas WHERE id = p_proposta_id FOR UPDATE;
  IF v_proposta.id IS NULL THEN
    RAISE EXCEPTION 'Proposta não encontrada ou sem permissão.' USING ERRCODE = 'P0002';
  END IF;
  IF v_proposta.empresa_id <> v_minha_empresa AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Proposta não pertence ao seu tenant.' USING ERRCODE = '42501';
  END IF;
  IF v_proposta.status <> 'rascunho' THEN
    RAISE EXCEPTION 'PROPOSTA_NAO_EDITAVEL: só é possível editar itens de uma proposta em rascunho (status atual: %).', v_proposta.status;
  END IF;

  DELETE FROM public.crm_proposta_itens WHERE proposta_id = p_proposta_id;

  INSERT INTO public.crm_proposta_itens (empresa_id, proposta_id, servico_catalogo_id, nome, descricao, valor, ordem)
  SELECT
    v_proposta.empresa_id,
    p_proposta_id,
    NULLIF(item->>'servico_catalogo_id', '')::uuid,
    item->>'nome',
    item->>'descricao',
    COALESCE((item->>'valor')::numeric(12,2), 0),
    COALESCE((item->>'ordem')::int, 0)
  FROM jsonb_array_elements(p_itens) AS item
  WHERE COALESCE(item->>'nome', '') <> '';

  SELECT COALESCE(SUM(valor), 0) INTO v_total FROM public.crm_proposta_itens WHERE proposta_id = p_proposta_id;
  UPDATE public.crm_propostas SET valor_total = v_total WHERE id = p_proposta_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.crm_salvar_itens_proposta(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_salvar_itens_proposta(uuid, jsonb) TO authenticated;


CREATE OR REPLACE FUNCTION public.crm_marcar_proposta_gerada(p_proposta_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_perfil text;
  v_minha_empresa uuid;
  v_proposta public.crm_propostas;
BEGIN
  SELECT perfil, empresa_id INTO v_perfil, v_minha_empresa FROM public.profiles WHERE id = auth.uid();
  IF v_perfil NOT IN ('admin', 'consultor') AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_proposta FROM public.crm_propostas WHERE id = p_proposta_id FOR UPDATE;
  IF v_proposta.id IS NULL THEN
    RAISE EXCEPTION 'Proposta não encontrada ou sem permissão.' USING ERRCODE = 'P0002';
  END IF;
  IF v_proposta.empresa_id <> v_minha_empresa AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Proposta não pertence ao seu tenant.' USING ERRCODE = '42501';
  END IF;
  IF v_proposta.status <> 'rascunho' THEN
    RAISE EXCEPTION 'PROPOSTA_NAO_EDITAVEL: só é possível gerar uma proposta em rascunho (status atual: %).', v_proposta.status;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.crm_proposta_itens WHERE proposta_id = p_proposta_id) THEN
    RAISE EXCEPTION 'PROPOSTA_SEM_ITENS: adicione ao menos um item antes de gerar a proposta.';
  END IF;

  UPDATE public.crm_propostas SET status = 'gerada', gerada_em = now() WHERE id = p_proposta_id;

  PERFORM public.crm_registrar_timeline_sistema(
    v_proposta.crm_oportunidade_id, 'proposta_gerada', 'Proposta comercial gerada.',
    jsonb_build_object('proposta_id', p_proposta_id, 'numero_revisao', v_proposta.numero_revisao)
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.crm_marcar_proposta_gerada(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_marcar_proposta_gerada(uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.crm_marcar_proposta_enviada(p_proposta_id uuid, p_canal text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_perfil text;
  v_minha_empresa uuid;
  v_proposta public.crm_propostas;
BEGIN
  SELECT perfil, empresa_id INTO v_perfil, v_minha_empresa FROM public.profiles WHERE id = auth.uid();
  IF v_perfil NOT IN ('admin', 'consultor') AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_proposta FROM public.crm_propostas WHERE id = p_proposta_id FOR UPDATE;
  IF v_proposta.id IS NULL THEN
    RAISE EXCEPTION 'Proposta não encontrada ou sem permissão.' USING ERRCODE = 'P0002';
  END IF;
  IF v_proposta.empresa_id <> v_minha_empresa AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Proposta não pertence ao seu tenant.' USING ERRCODE = '42501';
  END IF;
  IF v_proposta.status NOT IN ('gerada', 'enviada') THEN
    RAISE EXCEPTION 'PROPOSTA_NAO_ENVIAVEL: só é possível marcar como enviada uma proposta gerada (status atual: %).', v_proposta.status;
  END IF;

  UPDATE public.crm_propostas
    SET status = 'enviada', enviada_em = COALESCE(enviada_em, now())
    WHERE id = p_proposta_id;

  PERFORM public.crm_registrar_timeline_sistema(
    v_proposta.crm_oportunidade_id, 'proposta_enviada', 'Proposta comercial enviada ao cliente.',
    jsonb_build_object('proposta_id', p_proposta_id, 'canal', p_canal)
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.crm_marcar_proposta_enviada(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_marcar_proposta_enviada(uuid, text) TO authenticated;


CREATE OR REPLACE FUNCTION public.crm_registrar_aceite_proposta(
  p_proposta_id uuid,
  p_forma text,
  p_observacao text DEFAULT NULL,
  p_evidencia_path text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_perfil text;
  v_minha_empresa uuid;
  v_proposta public.crm_propostas;
BEGIN
  SELECT perfil, empresa_id INTO v_perfil, v_minha_empresa FROM public.profiles WHERE id = auth.uid();
  IF v_perfil NOT IN ('admin', 'consultor') AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;

  IF p_forma NOT IN ('email', 'whatsapp', 'assinatura_da_proposta', 'verbal_registrado', 'outro') THEN
    RAISE EXCEPTION 'Forma de aceite inválida: %.', p_forma;
  END IF;

  SELECT * INTO v_proposta FROM public.crm_propostas WHERE id = p_proposta_id FOR UPDATE;
  IF v_proposta.id IS NULL THEN
    RAISE EXCEPTION 'Proposta não encontrada ou sem permissão.' USING ERRCODE = 'P0002';
  END IF;
  IF v_proposta.empresa_id <> v_minha_empresa AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Proposta não pertence ao seu tenant.' USING ERRCODE = '42501';
  END IF;
  IF v_proposta.status NOT IN ('gerada', 'enviada') THEN
    RAISE EXCEPTION 'PROPOSTA_NAO_ACEITAVEL: só é possível registrar aceite de uma proposta gerada ou enviada (status atual: %).', v_proposta.status;
  END IF;

  UPDATE public.crm_propostas SET
    status = 'aceita', aceite_em = now(), aceite_por = auth.uid(),
    aceite_forma = p_forma, aceite_observacao = p_observacao, aceite_evidencia_path = p_evidencia_path
  WHERE id = p_proposta_id;

  -- Demais revisões não-terminais do mesmo grupo (nunca deveria haver mais
  -- de uma por causa do índice único parcial, mas por segurança) viram
  -- substituida, nunca recusada/cancelada.
  UPDATE public.crm_propostas SET status = 'substituida'
    WHERE grupo_proposta_id = v_proposta.grupo_proposta_id
      AND id <> p_proposta_id
      AND status IN ('rascunho', 'gerada', 'enviada');

  PERFORM public.crm_registrar_timeline_sistema(
    v_proposta.crm_oportunidade_id, 'proposta_aceita', 'Aceite da proposta comercial registrado.',
    jsonb_build_object('proposta_id', p_proposta_id, 'forma', p_forma)
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.crm_registrar_aceite_proposta(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_registrar_aceite_proposta(uuid, text, text, text) TO authenticated;


-- Não fazia parte da lista original de RPCs, mas o estado 'recusada' já é
-- declarado no CHECK da tabela — sem esta RPC não haveria nenhum caminho de
-- código pra alcançá-lo. Mesmo padrão/guarda de crm_cancelar_proposta.
CREATE OR REPLACE FUNCTION public.crm_marcar_proposta_recusada(p_proposta_id uuid, p_motivo text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_perfil text;
  v_minha_empresa uuid;
  v_proposta public.crm_propostas;
BEGIN
  SELECT perfil, empresa_id INTO v_perfil, v_minha_empresa FROM public.profiles WHERE id = auth.uid();
  IF v_perfil NOT IN ('admin', 'consultor') AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_proposta FROM public.crm_propostas WHERE id = p_proposta_id FOR UPDATE;
  IF v_proposta.id IS NULL THEN
    RAISE EXCEPTION 'Proposta não encontrada ou sem permissão.' USING ERRCODE = 'P0002';
  END IF;
  IF v_proposta.empresa_id <> v_minha_empresa AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Proposta não pertence ao seu tenant.' USING ERRCODE = '42501';
  END IF;
  IF v_proposta.status NOT IN ('gerada', 'enviada') THEN
    RAISE EXCEPTION 'PROPOSTA_NAO_RECUSAVEL: só é possível marcar como recusada uma proposta gerada ou enviada (status atual: %).', v_proposta.status;
  END IF;

  UPDATE public.crm_propostas SET status = 'recusada', recusada_em = now(), recusada_motivo = p_motivo WHERE id = p_proposta_id;

  PERFORM public.crm_registrar_timeline_sistema(
    v_proposta.crm_oportunidade_id, 'proposta_recusada', 'Proposta comercial recusada pelo cliente.',
    jsonb_build_object('proposta_id', p_proposta_id, 'motivo', p_motivo)
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.crm_marcar_proposta_recusada(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_marcar_proposta_recusada(uuid, text) TO authenticated;


CREATE OR REPLACE FUNCTION public.crm_cancelar_proposta(p_proposta_id uuid, p_motivo text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_perfil text;
  v_minha_empresa uuid;
  v_proposta public.crm_propostas;
BEGIN
  SELECT perfil, empresa_id INTO v_perfil, v_minha_empresa FROM public.profiles WHERE id = auth.uid();
  IF v_perfil NOT IN ('admin', 'consultor') AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_proposta FROM public.crm_propostas WHERE id = p_proposta_id FOR UPDATE;
  IF v_proposta.id IS NULL THEN
    RAISE EXCEPTION 'Proposta não encontrada ou sem permissão.' USING ERRCODE = 'P0002';
  END IF;
  IF v_proposta.empresa_id <> v_minha_empresa AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Proposta não pertence ao seu tenant.' USING ERRCODE = '42501';
  END IF;
  IF v_proposta.status NOT IN ('rascunho', 'gerada', 'enviada') THEN
    RAISE EXCEPTION 'PROPOSTA_NAO_CANCELAVEL: não é possível cancelar uma proposta com status "%".', v_proposta.status;
  END IF;

  UPDATE public.crm_propostas SET status = 'cancelada', cancelada_em = now(), cancelada_motivo = p_motivo WHERE id = p_proposta_id;

  PERFORM public.crm_registrar_timeline_sistema(
    v_proposta.crm_oportunidade_id, 'proposta_cancelada', 'Proposta comercial cancelada.',
    jsonb_build_object('proposta_id', p_proposta_id, 'motivo', p_motivo)
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.crm_cancelar_proposta(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_cancelar_proposta(uuid, text) TO authenticated;
