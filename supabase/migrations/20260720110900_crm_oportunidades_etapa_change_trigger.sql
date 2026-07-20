-- CRM Comercial — troca de etapa em crm_oportunidades é server-authoritative:
-- carimba etapa_alterada_em/fechada_em e loga um evento 'sistema' na
-- timeline sozinha, sem depender do app lembrar de fazer os dois passos.

-- BEFORE UPDATE: carimba os timestamps quando a etapa muda.
CREATE OR REPLACE FUNCTION public.crm_oportunidades_stamp_etapa()
RETURNS trigger LANGUAGE plpgsql AS $function$
DECLARE
  v_tipo text;
BEGIN
  IF NEW.etapa_id IS DISTINCT FROM OLD.etapa_id THEN
    NEW.etapa_alterada_em := now();

    SELECT tipo INTO v_tipo FROM public.crm_etapas WHERE id = NEW.etapa_id;
    IF v_tipo IN ('ganho', 'perdido') THEN
      NEW.fechada_em := now();
    ELSE
      NEW.fechada_em := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER crm_oportunidades_stamp_etapa
  BEFORE UPDATE ON public.crm_oportunidades
  FOR EACH ROW EXECUTE FUNCTION public.crm_oportunidades_stamp_etapa();

-- AFTER UPDATE: loga a mudança de etapa na timeline como evento 'sistema'.
-- SECURITY DEFINER pra bypassar a RLS de crm_timeline (que não libera
-- INSERT de origem='sistema' pra authenticated) — é exatamente o
-- comportamento pretendido: só trigger/RPC grava evento de sistema.
CREATE OR REPLACE FUNCTION public.crm_oportunidades_log_etapa_timeline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_etapa_anterior text;
  v_etapa_nova text;
BEGIN
  IF NEW.etapa_id IS DISTINCT FROM OLD.etapa_id THEN
    SELECT nome INTO v_etapa_anterior FROM public.crm_etapas WHERE id = OLD.etapa_id;
    SELECT nome INTO v_etapa_nova FROM public.crm_etapas WHERE id = NEW.etapa_id;

    INSERT INTO public.crm_timeline (
      empresa_id, crm_empresa_id, crm_oportunidade_id,
      origem, evento_tipo, descricao, autor_id, metadata
    ) VALUES (
      NEW.empresa_id, NEW.crm_empresa_id, NEW.id,
      'sistema', 'mudanca_etapa',
      format('Etapa alterada de "%s" para "%s"', coalesce(v_etapa_anterior, '—'), coalesce(v_etapa_nova, '—')),
      NULL,
      jsonb_build_object('etapa_anterior_id', OLD.etapa_id, 'etapa_nova_id', NEW.etapa_id)
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER crm_oportunidades_log_etapa_timeline
  AFTER UPDATE ON public.crm_oportunidades
  FOR EACH ROW EXECUTE FUNCTION public.crm_oportunidades_log_etapa_timeline();
