-- Fase 3 (Diagnóstico no CRM) — crm_fechar_oportunidade_ganha passa a
-- vincular os diagnósticos da oportunidade ao cliente operacional na
-- conversão, preservando permanentemente crm_oportunidade_id (nunca
-- apagado), e ganha idempotência real (segunda chamada não lança erro,
-- desde que o estado esteja comprovadamente consistente).
--
-- RETURNS TABLE muda de shape (2 colunas novas) -> precisa de DROP antes,
-- Postgres não permite CREATE OR REPLACE mudar o formato do retorno.
--
-- Mantida SECURITY INVOKER (sem a palavra-chave, como já era): as 4 tabelas
-- tocadas (crm_oportunidades, crm_empresas, clientes, inspecoes) têm RLS
-- que, com as policies novas da migration anterior, autoriza exatamente o
-- que a função precisa — nada além disso. SECURITY DEFINER abriria bypass
-- total de RLS sem necessidade.
--
-- Comportamento real de fechada_em/timeline confirmado antes de escrever
-- esta função (não presumido):
-- - crm_oportunidades_stamp_etapa (BEFORE UPDATE) carimba fechada_em=now()
--   tanto para etapa tipo='ganho' quanto tipo='perdido' — fechada_em
--   sozinho NÃO prova conversão em cliente, por isso o branch idempotente
--   abaixo confirma também o tipo da etapa atual.
-- - crm_oportunidades_log_etapa_timeline (AFTER UPDATE, SECURITY DEFINER)
--   já dispara sozinho quando etapa_id muda de verdade — o branch
--   idempotente nunca executa esse UPDATE de novo, então nunca duplica
--   evento de timeline. Nenhum INSERT manual em crm_timeline é necessário.
-- - Esta RPC nunca gravou em audit_log; Fase 3 não adiciona.

DROP FUNCTION IF EXISTS public.crm_fechar_oportunidade_ganha(uuid);

CREATE FUNCTION public.crm_fechar_oportunidade_ganha(p_oportunidade_id uuid)
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

  -- Idempotência SEM erro — só quando comprovadamente convertida e
  -- consistente, nunca só por "tem uma data de fechamento" (fechada_em
  -- também é carimbada para oportunidades perdidas).
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
      SELECT 1 FROM public.inspecoes
      WHERE crm_oportunidade_id = p_oportunidade_id AND tipo_execucao = 'diagnostico'
        AND cliente_id IS NOT NULL AND cliente_id IS DISTINCT FROM v_cliente_id
    ) THEN
      RAISE EXCEPTION 'Diagnóstico da oportunidade % está vinculado a um cliente diferente do cliente da Conta — estado inconsistente, requer investigação manual.', p_oportunidade_id;
    END IF;

    SELECT count(*) INTO v_diagnosticos_vinculados
    FROM public.inspecoes
    WHERE crm_oportunidade_id = p_oportunidade_id AND tipo_execucao = 'diagnostico' AND cliente_id = v_cliente_id;

    RETURN QUERY SELECT p_oportunidade_id, v_cliente_id, false, v_diagnosticos_vinculados, true;
    RETURN;
  END IF;

  SELECT id INTO v_etapa_ganho_id FROM public.crm_etapas WHERE pipeline_id = v_oportunidade.pipeline_id AND tipo = 'ganho' LIMIT 1;
  IF v_etapa_ganho_id IS NULL THEN
    RAISE EXCEPTION 'O pipeline desta oportunidade não tem uma etapa de tipo "ganho" configurada.';
  END IF;

  SELECT * INTO v_crm_empresa FROM public.crm_empresas WHERE id = v_oportunidade.crm_empresa_id FOR UPDATE;

  -- Lock dos diagnósticos desta oportunidade, evita corrida com edição/conversão concorrente.
  PERFORM 1 FROM public.inspecoes
    WHERE crm_oportunidade_id = p_oportunidade_id AND tipo_execucao = 'diagnostico' FOR UPDATE;

  -- Vínculo direto da Conta é sempre prioritário sobre o achado por CNPJ —
  -- os dois ramos são mutuamente exclusivos por construção (ELSIF), nunca há
  -- dois candidatos pra comparar. Se existir outro cliente com o mesmo CNPJ
  -- do cliente já vinculado à Conta, esse outro é ignorado deliberadamente
  -- (clientes não tem UNIQUE(empresa_id, cnpj) hoje — risco pré-existente,
  -- documentado, não corrigido nesta fase).
  IF v_crm_empresa.cliente_id IS NOT NULL THEN
    v_cliente_id := v_crm_empresa.cliente_id;
  ELSIF v_crm_empresa.cnpj IS NOT NULL THEN
    SELECT id INTO v_cliente_id FROM public.clientes
      WHERE empresa_id = v_oportunidade.empresa_id AND cnpj = v_crm_empresa.cnpj;
  END IF;

  IF v_cliente_id IS NULL THEN
    INSERT INTO public.clientes (empresa_id, nome, cnpj, status, responsavel_id, origem)
      VALUES (v_oportunidade.empresa_id, coalesce(v_crm_empresa.nome_fantasia, v_crm_empresa.razao_social),
              v_crm_empresa.cnpj, 'ativo', v_oportunidade.responsavel_id, 'crm')
      RETURNING id INTO v_cliente_id;
    v_cliente_criado := true;
  END IF;

  -- Conflito: algum diagnóstico já vinculado a um cliente DIFERENTE do
  -- resolvido agora. RAISE aqui desfaz tudo (inclusive o INSERT acima) — a
  -- função roda numa única transação implícita, não precisa de SAVEPOINT.
  IF EXISTS (
    SELECT 1 FROM public.inspecoes
    WHERE crm_oportunidade_id = p_oportunidade_id AND tipo_execucao = 'diagnostico'
      AND cliente_id IS NOT NULL AND cliente_id IS DISTINCT FROM v_cliente_id
  ) THEN
    RAISE EXCEPTION 'Diagnóstico da oportunidade % já está vinculado a um cliente diferente do cliente resolvido para esta conversão.', p_oportunidade_id;
  END IF;

  IF v_crm_empresa.cliente_id IS DISTINCT FROM v_cliente_id THEN
    UPDATE public.crm_empresas SET cliente_id = v_cliente_id, status = 'ativa' WHERE id = v_crm_empresa.id;
  END IF;

  UPDATE public.crm_oportunidades SET etapa_id = v_etapa_ganho_id WHERE id = p_oportunidade_id;

  -- Preserva crm_oportunidade_id, respostas, dados, conformidade, progresso,
  -- numero_sequencial, consultor_id, datas — só cliente_id é tocado, e só
  -- onde ainda nulo.
  UPDATE public.inspecoes SET cliente_id = v_cliente_id
    WHERE crm_oportunidade_id = p_oportunidade_id AND tipo_execucao = 'diagnostico' AND cliente_id IS NULL;

  SELECT count(*) INTO v_diagnosticos_vinculados
  FROM public.inspecoes
  WHERE crm_oportunidade_id = p_oportunidade_id AND tipo_execucao = 'diagnostico' AND cliente_id = v_cliente_id;

  RETURN QUERY SELECT p_oportunidade_id, v_cliente_id, v_cliente_criado, v_diagnosticos_vinculados, false;
END;
$function$;

REVOKE ALL ON FUNCTION public.crm_fechar_oportunidade_ganha(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_fechar_oportunidade_ganha(uuid) TO authenticated;
