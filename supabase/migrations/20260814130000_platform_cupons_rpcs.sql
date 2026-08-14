-- Bug real: saas_cupons tem RLS com só política de SELECT (saas_cupons_select).
-- criarCupom/atualizarCupomAtivo em platformService.ts faziam insert/update
-- diretos pelo client, sempre rejeitados pela RLS ("new row violates
-- row-level security policy"). Como todo o resto do painel de Plataforma,
-- escrita só via RPC SECURITY DEFINER restrita a super_admin.
CREATE OR REPLACE FUNCTION public.platform_criar_cupom(
  p_codigo text,
  p_descricao text,
  p_tipo_desconto text,
  p_valor numeric,
  p_plano_codigo text,
  p_periodicidade text,
  p_data_fim timestamptz,
  p_max_utilizacoes int,
  p_max_utilizacoes_por_empresa int
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_cupom_id uuid;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Acesso restrito à administração da plataforma.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.saas_cupons (
    codigo, descricao, tipo_desconto, valor, plano_codigo, periodicidade,
    data_fim, max_utilizacoes, max_utilizacoes_por_empresa, criado_por
  ) VALUES (
    upper(trim(p_codigo)), p_descricao, p_tipo_desconto, p_valor, p_plano_codigo, p_periodicidade,
    p_data_fim, p_max_utilizacoes, p_max_utilizacoes_por_empresa, auth.uid()
  )
  RETURNING id INTO v_cupom_id;

  INSERT INTO public.audit_log (actor_id, event_type, metadata)
    VALUES (auth.uid(), 'cupom_criado', jsonb_build_object('cupom_id', v_cupom_id, 'codigo', upper(trim(p_codigo))));

  RETURN v_cupom_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.platform_atualizar_cupom_ativo(p_cupom_id uuid, p_ativo boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Acesso restrito à administração da plataforma.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.saas_cupons SET ativo = p_ativo WHERE id = p_cupom_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cupom não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.audit_log (actor_id, event_type, metadata)
    VALUES (auth.uid(), 'cupom_ativo_alterado', jsonb_build_object('cupom_id', p_cupom_id, 'ativo', p_ativo));
END;
$function$;

GRANT EXECUTE ON FUNCTION public.platform_criar_cupom(text, text, text, numeric, text, text, timestamptz, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_atualizar_cupom_ativo(uuid, boolean) TO authenticated;
