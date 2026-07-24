-- Fase 5 (Diagnóstico configurável no CRM) — estende
-- crm_fechar_oportunidade_ganha com um parâmetro opcional
-- p_motivo_sem_diagnostico, pra exigir confirmação forte (com motivo
-- validado no backend) quando o pipeline tem uma etapa de Diagnóstico
-- configurada e o Diagnóstico da oportunidade não está concluído.
--
-- Compatibilidade: parâmetro novo com DEFAULT NULL ao final da assinatura
-- — chamadas existentes (nomeadas, sem esse parâmetro) continuam
-- funcionando sem alteração. Quando o pipeline não tem etapa de
-- diagnóstico configurada, o bloco novo inteiro é pulado — comportamento
-- idêntico ao pré-Fase 5. Mesma função (CREATE OR REPLACE), mesmo
-- retorno, sem segundo caminho de conversão.
--
-- Nunca busca o "diagnóstico mais recente" — a invariância de 1
-- diagnóstico por oportunidade (índice único, Fase 4) é verificada
-- explicitamente; >1 é erro de integridade que aborta a conversão.

CREATE OR REPLACE FUNCTION public.crm_fechar_oportunidade_ganha(
  p_oportunidade_id uuid,
  p_motivo_sem_diagnostico text DEFAULT NULL
)
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
  v_etapa_diagnostico_id uuid;
  v_qtd_diagnosticos integer;
  v_diagnostico_status text;
  v_diagnostico_concluido boolean;
  v_motivo_normalizado text;
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

  -- Fase 5: só entra nesta checagem se o PIPELINE tiver uma etapa de
  -- Diagnóstico configurada; senão, comportamento 100% preservado.
  SELECT id INTO v_etapa_diagnostico_id
  FROM public.crm_etapas WHERE pipeline_id = v_oportunidade.pipeline_id AND gera_diagnostico = true;

  IF v_etapa_diagnostico_id IS NOT NULL THEN
    SELECT count(*) INTO v_qtd_diagnosticos
    FROM public.inspecoes i
    WHERE i.crm_oportunidade_id = p_oportunidade_id AND i.tipo_execucao = 'diagnostico';

    IF v_qtd_diagnosticos > 1 THEN
      RAISE EXCEPTION 'Mais de um Diagnóstico Inicial encontrado para a oportunidade % — inconsistência, requer investigação manual.', p_oportunidade_id;
    END IF;

    IF v_qtd_diagnosticos = 1 THEN
      SELECT i.status INTO v_diagnostico_status
      FROM public.inspecoes i
      WHERE i.crm_oportunidade_id = p_oportunidade_id AND i.tipo_execucao = 'diagnostico';
    ELSE
      v_diagnostico_status := NULL;
    END IF;
    v_diagnostico_concluido := v_diagnostico_status = 'concluida';

    IF NOT COALESCE(v_diagnostico_concluido, false) THEN
      v_motivo_normalizado := trim(coalesce(p_motivo_sem_diagnostico, ''));

      IF v_motivo_normalizado = '' THEN
        RAISE EXCEPTION 'DIAGNOSTICO_NAO_CONCLUIDO: O Diagnóstico Inicial desta oportunidade não foi concluído.';
      END IF;
      IF length(v_motivo_normalizado) < 5 THEN
        RAISE EXCEPTION 'Motivo muito curto — descreva brevemente por que está avançando sem o Diagnóstico concluído.';
      END IF;
      IF length(v_motivo_normalizado) > 500 THEN
        RAISE EXCEPTION 'Motivo muito longo (máximo 500 caracteres).';
      END IF;

      PERFORM public.crm_registrar_timeline_sistema(
        p_oportunidade_id,
        'oportunidade_ganha_sem_diagnostico',
        'Oportunidade fechada como ganha sem o Diagnóstico Inicial concluído.',
        jsonb_build_object('motivo', v_motivo_normalizado, 'diagnostico_status', coalesce(v_diagnostico_status, 'nao_iniciado'))
      );
    ELSIF p_motivo_sem_diagnostico IS NOT NULL THEN
      -- Diagnóstico já concluído: motivo não faz sentido aqui. Ignorado
      -- silenciosamente (não é erro do usuário — pode ter sido preenchido
      -- antes de o diagnóstico ser concluído por outra aba/usuário) em vez
      -- de gravar uma metadata enganosa.
      NULL;
    END IF;
  END IF;

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
