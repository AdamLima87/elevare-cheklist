-- CRM Comercial — bloqueia concluir a ÚLTIMA atividade pendente de uma
-- oportunidade aberta sem agendar a próxima (mesmo racional de
-- crm_mover_etapa_com_proxima_acao: atômico, SECURITY INVOKER, RLS normal).
-- Atividades sem oportunidade vinculada (só ligadas à Conta) ou cuja
-- oportunidade já fechou (ganho/perdido) não têm essa obrigação.
CREATE OR REPLACE FUNCTION public.crm_concluir_atividade(
  p_atividade_id uuid,
  p_resultado text DEFAULT NULL,
  p_nova_atividade_tipo_id uuid DEFAULT NULL,
  p_nova_atividade_vencimento timestamptz DEFAULT NULL
)
RETURNS public.crm_atividades
LANGUAGE plpgsql
AS $function$
DECLARE
  v_atividade public.crm_atividades;
  v_etapa_tipo text;
  v_pendentes int;
BEGIN
  UPDATE public.crm_atividades
    SET status = 'concluida', resultado = p_resultado, concluida_em = now()
    WHERE id = p_atividade_id AND status = 'pendente'
    RETURNING * INTO v_atividade;

  IF v_atividade.id IS NULL THEN
    RAISE EXCEPTION 'Atividade não encontrada, sem permissão, ou já concluída/cancelada.';
  END IF;

  IF v_atividade.crm_oportunidade_id IS NOT NULL THEN
    SELECT e.tipo INTO v_etapa_tipo
      FROM public.crm_oportunidades o
      JOIN public.crm_etapas e ON e.id = o.etapa_id
      WHERE o.id = v_atividade.crm_oportunidade_id;

    IF v_etapa_tipo = 'aberta' THEN
      SELECT count(*) INTO v_pendentes
        FROM public.crm_atividades
        WHERE crm_oportunidade_id = v_atividade.crm_oportunidade_id AND status = 'pendente';

      IF v_pendentes = 0 THEN
        IF p_nova_atividade_tipo_id IS NULL OR p_nova_atividade_vencimento IS NULL THEN
          RAISE EXCEPTION 'PROXIMA_ACAO_OBRIGATORIA: agende a próxima atividade antes de concluir esta.';
        END IF;

        INSERT INTO public.crm_atividades (
          empresa_id, crm_empresa_id, crm_oportunidade_id, tipo_id, responsavel_id, vencimento
        ) VALUES (
          v_atividade.empresa_id, v_atividade.crm_empresa_id, v_atividade.crm_oportunidade_id,
          p_nova_atividade_tipo_id, v_atividade.responsavel_id, p_nova_atividade_vencimento
        );
      END IF;
    END IF;
  END IF;

  RETURN v_atividade;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.crm_concluir_atividade(uuid, text, uuid, timestamptz) TO authenticated;
