-- CRM Comercial — "próxima ação obrigatória": ao mover uma oportunidade
-- aberta de etapa, ela precisa terminar com pelo menos uma atividade
-- pendente agendada. Isso substitui o UPDATE direto que o client fazia
-- (useMoverEtapaOportunidade) por esta RPC.
--
-- SECURITY INVOKER (padrão) de propósito: roda com os privilégios de quem
-- chamou, então a RLS de crm_oportunidades/crm_atividades continua valendo
-- normalmente (só admin/consultor do tenant conseguem mover etapa). Isso
-- não é um bypass de segurança, é só uma forma de garantir atomicidade —
-- se faltar a próxima atividade, a função inteira (incluindo o UPDATE de
-- etapa) roda em rollback, já que é tudo uma transação só.
--
-- Etapas de fechamento (ganho/perdido) NÃO passam por aqui — usam a RPC
-- dedicada de fechamento (Etapa 7). Isso também implementa o ajuste do
-- usuário: a obrigação de próxima atividade vale só pra oportunidades
-- abertas, nunca pra ganhas/perdidas.
CREATE OR REPLACE FUNCTION public.crm_mover_etapa_com_proxima_acao(
  p_oportunidade_id uuid,
  p_etapa_id uuid,
  p_nova_atividade_tipo_id uuid DEFAULT NULL,
  p_nova_atividade_vencimento timestamptz DEFAULT NULL
)
RETURNS public.crm_oportunidades
LANGUAGE plpgsql
AS $function$
DECLARE
  v_etapa_tipo text;
  v_oportunidade public.crm_oportunidades;
  v_pendentes int;
BEGIN
  SELECT tipo INTO v_etapa_tipo FROM public.crm_etapas WHERE id = p_etapa_id;
  IF v_etapa_tipo IS NULL THEN
    RAISE EXCEPTION 'Etapa não encontrada.';
  END IF;
  IF v_etapa_tipo <> 'aberta' THEN
    RAISE EXCEPTION 'Use o fechamento de oportunidade (ganho/perdido) para mover pra esta etapa.';
  END IF;

  UPDATE public.crm_oportunidades
    SET etapa_id = p_etapa_id
    WHERE id = p_oportunidade_id
    RETURNING * INTO v_oportunidade;

  IF v_oportunidade.id IS NULL THEN
    RAISE EXCEPTION 'Oportunidade não encontrada ou sem permissão para movê-la.';
  END IF;

  SELECT count(*) INTO v_pendentes
    FROM public.crm_atividades
    WHERE crm_oportunidade_id = v_oportunidade.id AND status = 'pendente';

  IF v_pendentes = 0 THEN
    IF p_nova_atividade_tipo_id IS NULL OR p_nova_atividade_vencimento IS NULL THEN
      RAISE EXCEPTION 'PROXIMA_ACAO_OBRIGATORIA: informe tipo e vencimento da próxima atividade para mover esta oportunidade.';
    END IF;

    INSERT INTO public.crm_atividades (
      empresa_id, crm_empresa_id, crm_oportunidade_id, tipo_id, responsavel_id, vencimento
    ) VALUES (
      v_oportunidade.empresa_id, v_oportunidade.crm_empresa_id, v_oportunidade.id,
      p_nova_atividade_tipo_id, v_oportunidade.responsavel_id, p_nova_atividade_vencimento
    );
  END IF;

  RETURN v_oportunidade;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.crm_mover_etapa_com_proxima_acao(uuid, uuid, uuid, timestamptz) TO authenticated;
