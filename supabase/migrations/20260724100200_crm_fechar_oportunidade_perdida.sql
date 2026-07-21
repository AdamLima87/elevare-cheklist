-- CRM Comercial — Etapa 7: fecha uma oportunidade como PERDIDA, exigindo
-- motivo padronizado (catálogo crm_motivos_perda, Etapa 2). SECURITY
-- INVOKER de propósito, mesmo racional de crm_fechar_oportunidade_ganha:
-- RLS normal do usuário chamador, timeline sai de graça via trigger.
CREATE OR REPLACE FUNCTION public.crm_fechar_oportunidade_perdida(
  p_oportunidade_id uuid,
  p_motivo_perda_id uuid,
  p_motivo_perda_detalhe text DEFAULT NULL
)
RETURNS public.crm_oportunidades
LANGUAGE plpgsql
AS $function$
DECLARE
  v_oportunidade public.crm_oportunidades;
  v_etapa_perdido_id uuid;
BEGIN
  IF p_motivo_perda_id IS NULL THEN
    RAISE EXCEPTION 'Motivo da perda é obrigatório.';
  END IF;

  SELECT * INTO v_oportunidade FROM public.crm_oportunidades WHERE id = p_oportunidade_id FOR UPDATE;
  IF v_oportunidade.id IS NULL THEN
    RAISE EXCEPTION 'Oportunidade não encontrada ou sem permissão para fechá-la.';
  END IF;
  IF v_oportunidade.fechada_em IS NOT NULL THEN
    RAISE EXCEPTION 'Esta oportunidade já está fechada.';
  END IF;

  SELECT id INTO v_etapa_perdido_id FROM public.crm_etapas WHERE pipeline_id = v_oportunidade.pipeline_id AND tipo = 'perdido' LIMIT 1;
  IF v_etapa_perdido_id IS NULL THEN
    RAISE EXCEPTION 'O pipeline desta oportunidade não tem uma etapa de tipo "perdido" configurada.';
  END IF;

  UPDATE public.crm_oportunidades
    SET etapa_id = v_etapa_perdido_id,
        motivo_perda_id = p_motivo_perda_id,
        motivo_perda_detalhe = p_motivo_perda_detalhe
    WHERE id = p_oportunidade_id
    RETURNING * INTO v_oportunidade;

  RETURN v_oportunidade;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.crm_fechar_oportunidade_perdida(uuid, uuid, text) TO authenticated;
