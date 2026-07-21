-- CRM Comercial — estende o trigger de timeline da Etapa 2 (mudança de
-- etapa) pra distinguir fechamento (ganho/perdido) de uma troca de etapa
-- normal. Continua sendo o mesmo mecanismo: SECURITY DEFINER, disparado
-- pelo UPDATE de etapa_id que as RPCs de fechamento (Etapa 7) fazem — não
-- precisa de nenhum INSERT manual adicional em crm_timeline, então nenhuma
-- RPC de fechamento precisa de privilégio elevado só pra logar o evento.
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

    INSERT INTO public.crm_timeline (
      empresa_id, crm_empresa_id, crm_oportunidade_id,
      origem, evento_tipo, descricao, autor_id, metadata
    ) VALUES (
      NEW.empresa_id, NEW.crm_empresa_id, NEW.id,
      'sistema', v_evento_tipo, v_descricao,
      NULL,
      jsonb_build_object('etapa_anterior_id', OLD.etapa_id, 'etapa_nova_id', NEW.etapa_id)
    );
  END IF;
  RETURN NEW;
END;
$function$;
