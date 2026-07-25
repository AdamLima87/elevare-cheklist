-- Fase 7.9 — RPCs de programação de reinspeção. Todas SECURITY DEFINER (as
-- tabelas não têm policy de escrita pra `authenticated`, ver migration
-- anterior) — cada uma valida tenant/perfil manualmente antes de escrever,
-- mesmo padrão já usado em crm_definir_etapa_diagnostico (Fase 5).

CREATE OR REPLACE FUNCTION public.criar_programacao_reinspecao(
  p_inspecao_origem_id uuid,
  p_data_prevista date,
  p_responsavel_id uuid DEFAULT NULL,
  p_observacao text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_origem public.inspecoes;
  v_perfil text;
  v_minha_empresa uuid;
  v_programacao_id uuid;
BEGIN
  SELECT perfil, empresa_id INTO v_perfil, v_minha_empresa FROM public.profiles WHERE id = auth.uid();
  IF v_perfil NOT IN ('admin', 'consultor') AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Sem permissão para programar reinspeção.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_origem FROM public.inspecoes WHERE id = p_inspecao_origem_id;
  IF v_origem.id IS NULL THEN
    RAISE EXCEPTION 'Inspeção de origem não encontrada.' USING ERRCODE = 'P0002';
  END IF;
  IF v_origem.empresa_id <> v_minha_empresa AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Inspeção de origem não pertence ao seu tenant.' USING ERRCODE = '42501';
  END IF;
  IF v_origem.status <> 'concluida' THEN
    RAISE EXCEPTION 'Só é possível programar reinspeção a partir de uma inspeção concluída.' USING ERRCODE = '22023';
  END IF;
  IF p_responsavel_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_responsavel_id AND empresa_id = v_origem.empresa_id) THEN
      RAISE EXCEPTION 'Responsável não encontrado neste tenant.' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  INSERT INTO public.reinspecao_programacoes (
    empresa_id, inspecao_origem_id, cliente_id, responsavel_id, data_prevista, observacao, status, created_by
  ) VALUES (
    v_origem.empresa_id, p_inspecao_origem_id, v_origem.cliente_id, p_responsavel_id, p_data_prevista, p_observacao, 'programada', auth.uid()
  ) RETURNING id INTO v_programacao_id;

  INSERT INTO public.reinspecao_programacao_eventos (programacao_id, evento_tipo, data_nova, observacao, autor_id)
    VALUES (v_programacao_id, 'criada', p_data_prevista, p_observacao, auth.uid());

  RETURN v_programacao_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.criar_programacao_reinspecao(uuid, date, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.criar_programacao_reinspecao(uuid, date, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.reagendar_programacao_reinspecao(
  p_programacao_id uuid,
  p_nova_data date,
  p_observacao text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_prog public.reinspecao_programacoes;
  v_minha_empresa uuid;
  v_data_anterior date;
BEGIN
  SELECT empresa_id INTO v_minha_empresa FROM public.profiles WHERE id = auth.uid();
  SELECT * INTO v_prog FROM public.reinspecao_programacoes WHERE id = p_programacao_id FOR UPDATE;
  IF v_prog.id IS NULL THEN
    RAISE EXCEPTION 'Programação não encontrada.' USING ERRCODE = 'P0002';
  END IF;
  IF v_prog.empresa_id <> v_minha_empresa AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;
  IF v_prog.status NOT IN ('programada', 'reagendada') THEN
    RAISE EXCEPTION 'Só é possível reagendar uma programação em aberto (status atual: %).', v_prog.status USING ERRCODE = '22023';
  END IF;

  v_data_anterior := v_prog.data_prevista;
  UPDATE public.reinspecao_programacoes
    SET data_prevista = p_nova_data, status = 'reagendada', updated_at = now()
    WHERE id = p_programacao_id;

  INSERT INTO public.reinspecao_programacao_eventos (programacao_id, evento_tipo, data_anterior, data_nova, observacao, autor_id)
    VALUES (p_programacao_id, 'reagendada', v_data_anterior, p_nova_data, p_observacao, auth.uid());
END;
$function$;

REVOKE ALL ON FUNCTION public.reagendar_programacao_reinspecao(uuid, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reagendar_programacao_reinspecao(uuid, date, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancelar_programacao_reinspecao(
  p_programacao_id uuid,
  p_observacao text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_prog public.reinspecao_programacoes;
  v_minha_empresa uuid;
BEGIN
  SELECT empresa_id INTO v_minha_empresa FROM public.profiles WHERE id = auth.uid();
  SELECT * INTO v_prog FROM public.reinspecao_programacoes WHERE id = p_programacao_id FOR UPDATE;
  IF v_prog.id IS NULL THEN
    RAISE EXCEPTION 'Programação não encontrada.' USING ERRCODE = 'P0002';
  END IF;
  IF v_prog.empresa_id <> v_minha_empresa AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;
  IF v_prog.status IN ('iniciada', 'realizada', 'cancelada') THEN
    RAISE EXCEPTION 'Não é possível cancelar uma programação com status %.', v_prog.status USING ERRCODE = '22023';
  END IF;

  UPDATE public.reinspecao_programacoes SET status = 'cancelada', updated_at = now() WHERE id = p_programacao_id;

  INSERT INTO public.reinspecao_programacao_eventos (programacao_id, evento_tipo, observacao, autor_id)
    VALUES (p_programacao_id, 'cancelada', p_observacao, auth.uid());
END;
$function$;

REVOKE ALL ON FUNCTION public.cancelar_programacao_reinspecao(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancelar_programacao_reinspecao(uuid, text) TO authenticated;

-- O RPC crítico: mesmo padrão de lock já validado em produção pela Fase 4
-- (crm_obter_ou_criar_diagnostico) — SELECT ... FOR UPDATE serializa
-- chamadas concorrentes/duplo-clique; a segunda vê inspecao_criada_id já
-- preenchido e falha com erro claro, nunca cria uma segunda inspeção.
CREATE OR REPLACE FUNCTION public.iniciar_reinspecao(
  p_programacao_id uuid,
  p_responsavel_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_prog public.reinspecao_programacoes;
  v_origem public.inspecoes;
  v_minha_empresa uuid;
  v_numero integer;
  v_nova_inspecao_id uuid;
  v_consultor_id uuid;
BEGIN
  SELECT empresa_id INTO v_minha_empresa FROM public.profiles WHERE id = auth.uid();
  SELECT * INTO v_prog FROM public.reinspecao_programacoes WHERE id = p_programacao_id FOR UPDATE;
  IF v_prog.id IS NULL THEN
    RAISE EXCEPTION 'Programação não encontrada.' USING ERRCODE = 'P0002';
  END IF;
  IF v_prog.empresa_id <> v_minha_empresa AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;
  IF v_prog.status NOT IN ('programada', 'reagendada') OR v_prog.inspecao_criada_id IS NOT NULL THEN
    RAISE EXCEPTION 'Reinspeção já foi iniciada ou a programação não está mais em aberto.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_origem FROM public.inspecoes WHERE id = v_prog.inspecao_origem_id;
  IF v_origem.id IS NULL THEN
    RAISE EXCEPTION 'Inspeção de origem não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  v_consultor_id := COALESCE(p_responsavel_id, v_prog.responsavel_id, auth.uid());
  SELECT public.get_next_numero_inspecao() INTO v_numero;

  INSERT INTO public.inspecoes (
    empresa_id, cliente_id, crm_oportunidade_id, tipo_execucao, inspecao_origem_id,
    consultor_id, numero_sequencial, status, estabelecimento_nome, cnpj,
    data_inicio, progresso, dados, respostas, checklist_modelo_versao_id
  ) VALUES (
    v_origem.empresa_id, v_origem.cliente_id, NULL, 'reinspecao', v_origem.id,
    v_consultor_id, v_numero, 'em_andamento', v_origem.estabelecimento_nome, v_origem.cnpj,
    now(), 0, '{}'::jsonb, '{}'::jsonb, v_origem.checklist_modelo_versao_id
  ) RETURNING id INTO v_nova_inspecao_id;

  UPDATE public.reinspecao_programacoes
    SET status = 'iniciada', inspecao_criada_id = v_nova_inspecao_id,
        responsavel_id = COALESCE(p_responsavel_id, responsavel_id), updated_at = now()
    WHERE id = p_programacao_id;

  INSERT INTO public.reinspecao_programacao_eventos (programacao_id, evento_tipo, autor_id)
    VALUES (p_programacao_id, 'iniciada', auth.uid());

  RETURN v_nova_inspecao_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.iniciar_reinspecao(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.iniciar_reinspecao(uuid, uuid) TO authenticated;

-- Fecha o ciclo automaticamente: quando a reinspeção criada por
-- iniciar_reinspecao é concluída (fluxo já existente, ResultadoShell/
-- storage.ts), a programação vira 'realizada' sem o frontend precisar saber
-- disso. SECURITY DEFINER — precisa escrever independentemente das
-- permissões de quem concluiu a inspeção (que só tem SELECT nestas tabelas).
CREATE OR REPLACE FUNCTION public.reinspecao_marcar_programacao_realizada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  IF NEW.status = 'concluida' AND OLD.status IS DISTINCT FROM 'concluida' AND NEW.tipo_execucao = 'reinspecao' THEN
    UPDATE public.reinspecao_programacoes
      SET status = 'realizada', updated_at = now()
      WHERE inspecao_criada_id = NEW.id AND status = 'iniciada';

    INSERT INTO public.reinspecao_programacao_eventos (programacao_id, evento_tipo, autor_id)
      SELECT id, 'realizada', auth.uid()
      FROM public.reinspecao_programacoes
      WHERE inspecao_criada_id = NEW.id AND status = 'realizada';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER reinspecao_marcar_programacao_realizada
  AFTER UPDATE ON public.inspecoes
  FOR EACH ROW EXECUTE FUNCTION public.reinspecao_marcar_programacao_realizada();
