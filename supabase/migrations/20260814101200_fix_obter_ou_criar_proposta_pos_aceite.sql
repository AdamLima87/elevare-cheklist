-- Fase B — bug real encontrado pelo teste de renegociação pós-aceite:
-- crm_obter_ou_criar_proposta buscava "status NOT IN ('recusada',
-- 'cancelada')", o que incluía 'aceita' como resultado reaproveitável —
-- então uma nova chamada após o aceite devolvia a MESMA proposta aceita em
-- vez de iniciar um grupo novo, violando a regra: "uma revisão aceita
-- encerra definitivamente aquele grupo; renegociação pós-aceite inicia uma
-- proposta nova". Corrigido: só reaproveita revisões efetivamente
-- não-terminais (rascunho/gerada/enviada) — aceita/recusada/substituida/
-- cancelada sempre disparam a criação de um grupo novo.
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
  -- sempre cai no ramo de baixo e cria um grupo NOVO.
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
