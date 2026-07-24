-- Fase 5 (Diagnóstico configurável no CRM) — única forma de marcar,
-- transferir ou remover a etapa de Diagnóstico Inicial de um pipeline.
--
-- SECURITY DEFINER só por causa do INSERT em audit_log (que não tem
-- policy de INSERT para `authenticated`, só service_role/DEFINER owner).
-- Compensado por validação explícita no topo: can_access_crm() (perfil
-- elegível + ativo=true) e, além disso, perfil especificamente 'admin'.
--
-- Importante: NÃO usa is_super_admin() para pular a checagem de tenant.
-- Nesta fase não existe impersonação — super_admin administra apenas o
-- tenant do próprio profiles.empresa_id ("Minha Empresa"), exatamente como
-- um admin comum. Dar a super_admin acesso implícito a pipelines de
-- QUALQUER tenant só por ser super_admin criaria uma falsa sensação de
-- escopo global nesta RPC. Administração global de pipelines de outros
-- tenants fica fora de escopo até existir um mecanismo de impersonação
-- seguro.

CREATE FUNCTION public.crm_definir_etapa_diagnostico(
  p_pipeline_id uuid,
  p_etapa_id uuid DEFAULT NULL -- NULL = remover a marcação do pipeline
)
RETURNS TABLE (pipeline_id uuid, etapa_diagnostico_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_empresa_id uuid;
  v_perfil text;
  v_pipeline_empresa_id uuid;
  v_etapa record;
  v_etapa_anterior_id uuid;
BEGIN
  IF NOT public.can_access_crm() THEN
    RAISE EXCEPTION 'Sem permissão para acessar o CRM.' USING ERRCODE = '42501';
  END IF;

  SELECT perfil, empresa_id INTO v_perfil, v_empresa_id
  FROM public.profiles WHERE id = auth.uid();

  IF v_perfil IS DISTINCT FROM 'admin' THEN
    -- Bloqueia consultor E super_admin agindo fora do próprio tenant —
    -- ver comentário de cabeçalho.
    RAISE EXCEPTION 'Apenas administradores do tenant podem configurar a etapa de Diagnóstico.'
      USING ERRCODE = '42501';
  END IF;

  SELECT empresa_id INTO v_pipeline_empresa_id
  FROM public.crm_pipelines WHERE id = p_pipeline_id;

  IF v_pipeline_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Pipeline não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  IF v_pipeline_empresa_id <> v_empresa_id THEN
    RAISE EXCEPTION 'Pipeline não pertence ao seu tenant.' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_etapa_anterior_id
  FROM public.crm_etapas WHERE pipeline_id = p_pipeline_id AND gera_diagnostico = true;

  IF p_etapa_id IS NULL THEN
    UPDATE public.crm_etapas SET gera_diagnostico = false
      WHERE pipeline_id = p_pipeline_id AND gera_diagnostico = true;

    INSERT INTO public.audit_log (empresa_id, actor_id, event_type, metadata)
      VALUES (
        v_empresa_id, auth.uid(), 'crm_etapa_diagnostico_removida',
        jsonb_build_object('pipeline_id', p_pipeline_id, 'etapa_anterior_id', v_etapa_anterior_id)
      );

    RETURN QUERY SELECT p_pipeline_id, NULL::uuid;
    RETURN;
  END IF;

  SELECT * INTO v_etapa FROM public.crm_etapas WHERE id = p_etapa_id AND pipeline_id = p_pipeline_id;
  IF v_etapa.id IS NULL THEN
    RAISE EXCEPTION 'Etapa não encontrada neste pipeline.' USING ERRCODE = 'P0002';
  END IF;
  IF v_etapa.tipo <> 'aberta' THEN
    RAISE EXCEPTION 'Apenas etapas do tipo "aberta" podem ser marcadas como etapa de Diagnóstico.'
      USING ERRCODE = '22023';
  END IF;

  -- Desmarca a anterior (se houver, e for diferente da nova) antes de
  -- marcar a nova, na mesma transação — nunca viola o índice único parcial
  -- nem por instante.
  UPDATE public.crm_etapas SET gera_diagnostico = false
    WHERE pipeline_id = p_pipeline_id AND gera_diagnostico = true AND id <> p_etapa_id;
  UPDATE public.crm_etapas SET gera_diagnostico = true WHERE id = p_etapa_id;

  INSERT INTO public.audit_log (empresa_id, actor_id, event_type, metadata)
    VALUES (
      v_empresa_id, auth.uid(), 'crm_etapa_diagnostico_definida',
      jsonb_build_object(
        'pipeline_id', p_pipeline_id,
        'etapa_anterior_id', v_etapa_anterior_id,
        'etapa_nova_id', p_etapa_id
      )
    );

  RETURN QUERY SELECT p_pipeline_id, p_etapa_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.crm_definir_etapa_diagnostico(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_definir_etapa_diagnostico(uuid, uuid) TO authenticated;
