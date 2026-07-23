-- Fase 3 (Diagnóstico no CRM) — corrige "column reference cliente_id is
-- ambiguous". RETURNS TABLE (..., cliente_id uuid, ...) cria uma variável
-- implícita chamada cliente_id no escopo da função — colide com a coluna
-- inspecoes.cliente_id referenciada sem qualificação em várias queries do
-- corpo. Mesmo gotcha de PL/pgSQL já visto e corrigido em aplicar_cupom_checkout
-- (Fase de billing) nesta sessão. Correção: qualificar toda referência a
-- inspecoes.cliente_id com o nome da tabela. Assinatura/retorno idênticos —
-- CREATE OR REPLACE é suficiente, sem precisar de DROP.

CREATE OR REPLACE FUNCTION public.crm_fechar_oportunidade_ganha(p_oportunidade_id uuid)
RETURNS TABLE (
  oportunidade_id uuid,
  cliente_id uuid,
  cliente_criado boolean,
  diagnosticos_vinculados integer,
  already_converted boolean
)
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
DECLARE
  v_oportunidade public.crm_oportunidades;
  v_crm_empresa public.crm_empresas;
  v_etapa_ganho_id uuid;
  v_etapa_atual_tipo text;
  v_cliente_id uuid;
  v_cliente_criado boolean := false;
  v_diagnosticos_vinculados integer := 0;
BEGIN
  SELECT * INTO v_oportunidade FROM public.crm_oportunidades WHERE id = p_oportunidade_id FOR UPDATE;
  IF v_oportunidade.id IS NULL THEN
    RAISE EXCEPTION 'Oportunidade não encontrada ou sem permissão para fechá-la.';
  END IF;

  SELECT tipo INTO v_etapa_atual_tipo FROM public.crm_etapas WHERE id = v_oportunidade.etapa_id;

  IF v_oportunidade.fechada_em IS NOT NULL THEN
    IF v_etapa_atual_tipo <> 'ganho' THEN
      RAISE EXCEPTION 'A oportunidade % está fechada, mas não como ganha (etapa atual: %).', p_oportunidade_id, coalesce(v_etapa_atual_tipo, '—');
    END IF;

    SELECT * INTO v_crm_empresa FROM public.crm_empresas WHERE id = v_oportunidade.crm_empresa_id;
    IF v_crm_empresa.cliente_id IS NULL THEN
      RAISE EXCEPTION 'A oportunidade % está marcada como ganha, mas a Conta não possui cliente vinculado — estado inconsistente, requer investigação manual.', p_oportunidade_id;
    END IF;
    v_cliente_id := v_crm_empresa.cliente_id;

    IF EXISTS (
      SELECT 1 FROM public.inspecoes i
      WHERE i.crm_oportunidade_id = p_oportunidade_id AND i.tipo_execucao = 'diagnostico'
        AND i.cliente_id IS NOT NULL AND i.cliente_id IS DISTINCT FROM v_cliente_id
    ) THEN
      RAISE EXCEPTION 'Diagnóstico da oportunidade % está vinculado a um cliente diferente do cliente da Conta — estado inconsistente, requer investigação manual.', p_oportunidade_id;
    END IF;

    SELECT count(*) INTO v_diagnosticos_vinculados
    FROM public.inspecoes i
    WHERE i.crm_oportunidade_id = p_oportunidade_id AND i.tipo_execucao = 'diagnostico' AND i.cliente_id = v_cliente_id;

    RETURN QUERY SELECT p_oportunidade_id, v_cliente_id, false, v_diagnosticos_vinculados, true;
    RETURN;
  END IF;

  SELECT id INTO v_etapa_ganho_id FROM public.crm_etapas WHERE pipeline_id = v_oportunidade.pipeline_id AND tipo = 'ganho' LIMIT 1;
  IF v_etapa_ganho_id IS NULL THEN
    RAISE EXCEPTION 'O pipeline desta oportunidade não tem uma etapa de tipo "ganho" configurada.';
  END IF;

  SELECT * INTO v_crm_empresa FROM public.crm_empresas WHERE id = v_oportunidade.crm_empresa_id FOR UPDATE;

  PERFORM 1 FROM public.inspecoes i
    WHERE i.crm_oportunidade_id = p_oportunidade_id AND i.tipo_execucao = 'diagnostico' FOR UPDATE;

  IF v_crm_empresa.cliente_id IS NOT NULL THEN
    v_cliente_id := v_crm_empresa.cliente_id;
  ELSIF v_crm_empresa.cnpj IS NOT NULL THEN
    SELECT c.id INTO v_cliente_id FROM public.clientes c
      WHERE c.empresa_id = v_oportunidade.empresa_id AND c.cnpj = v_crm_empresa.cnpj;
  END IF;

  IF v_cliente_id IS NULL THEN
    INSERT INTO public.clientes (empresa_id, nome, cnpj, status, responsavel_id, origem)
      VALUES (v_oportunidade.empresa_id, coalesce(v_crm_empresa.nome_fantasia, v_crm_empresa.razao_social),
              v_crm_empresa.cnpj, 'ativo', v_oportunidade.responsavel_id, 'crm')
      RETURNING id INTO v_cliente_id;
    v_cliente_criado := true;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.inspecoes i
    WHERE i.crm_oportunidade_id = p_oportunidade_id AND i.tipo_execucao = 'diagnostico'
      AND i.cliente_id IS NOT NULL AND i.cliente_id IS DISTINCT FROM v_cliente_id
  ) THEN
    RAISE EXCEPTION 'Diagnóstico da oportunidade % já está vinculado a um cliente diferente do cliente resolvido para esta conversão.', p_oportunidade_id;
  END IF;

  IF v_crm_empresa.cliente_id IS DISTINCT FROM v_cliente_id THEN
    UPDATE public.crm_empresas SET cliente_id = v_cliente_id, status = 'ativa' WHERE id = v_crm_empresa.id;
  END IF;

  UPDATE public.crm_oportunidades SET etapa_id = v_etapa_ganho_id WHERE id = p_oportunidade_id;

  UPDATE public.inspecoes i SET cliente_id = v_cliente_id
    WHERE i.crm_oportunidade_id = p_oportunidade_id AND i.tipo_execucao = 'diagnostico' AND i.cliente_id IS NULL;

  SELECT count(*) INTO v_diagnosticos_vinculados
  FROM public.inspecoes i
  WHERE i.crm_oportunidade_id = p_oportunidade_id AND i.tipo_execucao = 'diagnostico' AND i.cliente_id = v_cliente_id;

  RETURN QUERY SELECT p_oportunidade_id, v_cliente_id, v_cliente_criado, v_diagnosticos_vinculados, false;
END;
$function$;
