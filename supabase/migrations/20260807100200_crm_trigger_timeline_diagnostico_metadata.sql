-- Fase 5 (Diagnóstico configurável no CRM) — estende o trigger de timeline
-- de mudança de etapa (mesmo mecanismo desde a Fase 2/Etapa 2, sem INSERT
-- manual em nenhuma RPC) pra anexar o status do Diagnóstico ao evento já
-- gravado, quando a etapa de ORIGEM (OLD.etapa_id) era a etapa de
-- Diagnóstico do pipeline. Não cria nenhum evento novo — só enriquece o
-- metadata do mesmo evento 'mudanca_etapa'/'contrato_fechado'/
-- 'oportunidade_perdida' que já é gravado incondicionalmente.
--
-- Nunca escolhe entre múltiplos diagnósticos da mesma oportunidade — conta
-- primeiro; se houver mais de um, grava apenas diagnostico_inconsistente=true
-- em vez de adivinhar qual usar.
CREATE OR REPLACE FUNCTION public.crm_oportunidades_log_etapa_timeline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_etapa_anterior text;
  v_etapa_nova text;
  v_tipo_nova text;
  v_evento_tipo text;
  v_descricao text;
  v_metadata jsonb;
  v_etapa_origem_gera_diagnostico boolean;
  v_qtd_diagnosticos integer;
  v_diagnostico_status text;
BEGIN
  IF NEW.etapa_id IS DISTINCT FROM OLD.etapa_id THEN
    SELECT nome INTO v_etapa_anterior FROM public.crm_etapas WHERE id = OLD.etapa_id;
    SELECT nome, tipo INTO v_etapa_nova, v_tipo_nova FROM public.crm_etapas WHERE id = NEW.etapa_id;

    IF v_tipo_nova = 'ganho' THEN
      v_evento_tipo := 'contrato_fechado';
      v_descricao := 'Oportunidade marcada como ganha.';
    ELSIF v_tipo_nova = 'perdido' THEN
      v_evento_tipo := 'oportunidade_perdida';
      v_descricao := 'Oportunidade marcada como perdida.';
    ELSE
      v_evento_tipo := 'mudanca_etapa';
      v_descricao := format('Etapa alterada de "%s" para "%s"', coalesce(v_etapa_anterior, '—'), coalesce(v_etapa_nova, '—'));
    END IF;

    v_metadata := jsonb_build_object('etapa_anterior_id', OLD.etapa_id, 'etapa_nova_id', NEW.etapa_id);

    SELECT gera_diagnostico INTO v_etapa_origem_gera_diagnostico
    FROM public.crm_etapas WHERE id = OLD.etapa_id;

    IF v_etapa_origem_gera_diagnostico THEN
      SELECT count(*) INTO v_qtd_diagnosticos
      FROM public.inspecoes WHERE crm_oportunidade_id = NEW.id AND tipo_execucao = 'diagnostico';

      IF v_qtd_diagnosticos > 1 THEN
        v_metadata := v_metadata || jsonb_build_object('diagnostico_inconsistente', true);
      ELSIF v_qtd_diagnosticos = 1 THEN
        SELECT status INTO v_diagnostico_status
        FROM public.inspecoes WHERE crm_oportunidade_id = NEW.id AND tipo_execucao = 'diagnostico';
        v_metadata := v_metadata || jsonb_build_object(
          'diagnostico_status', v_diagnostico_status,
          'diagnostico_concluido', v_diagnostico_status = 'concluida'
        );
      ELSE
        v_metadata := v_metadata || jsonb_build_object('diagnostico_status', 'nao_iniciado', 'diagnostico_concluido', false);
      END IF;
    END IF;

    INSERT INTO public.crm_timeline (
      empresa_id, crm_empresa_id, crm_oportunidade_id,
      origem, evento_tipo, descricao, autor_id, metadata
    ) VALUES (
      NEW.empresa_id, NEW.crm_empresa_id, NEW.id,
      'sistema', v_evento_tipo, v_descricao,
      NULL,
      v_metadata
    );
  END IF;
  RETURN NEW;
END;
$function$;
