-- Bug: as RPCs crm_importar_lead_google e crm_leads_resolver_limite
-- restringiam o acesso a perfil IN ('admin', 'consultor'), sem incluir
-- 'super_admin' -- inconsistente com a Edge Function lead-finder, que ja
-- libera super_admin (podeBuscarImportar) para buscar/importar leads e
-- consultar a cota. Resultado: qualquer usuario super_admin recebia
-- "Perfil sem acesso a importacao de leads." / "...a prospeccao de leads."
-- dessas RPCs, mascarado pela mensagem generica do supabase-js ("Edge
-- Function returned a non-2xx status code"), que nao repassa o corpo do
-- erro real da resposta. Corpo das funcoes identico ao original -- so a
-- lista de perfis aceitos mudou.
CREATE OR REPLACE FUNCTION public.crm_leads_resolver_limite()
RETURNS TABLE (
  pode_importar boolean,
  limite_tipo text,          -- 'tenant' (chave própria, sem limite) | 'trial' | 'mensal'
  limite int,                -- NULL quando limite_tipo = 'tenant'
  usados int,
  disponivel int,
  tem_credencial_propria boolean,
  periodo_inicio date,       -- só preenchido quando limite_tipo = 'mensal'
  periodo_fim date
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_empresa_id uuid;
  v_plano text;
  v_tem_credencial boolean;
  v_trial_usados int;
  v_trial_limite int;
  v_periodo_inicio date;
  v_periodo_fim date;
  v_mensal_usados int;
BEGIN
  v_empresa_id := public.get_minha_empresa();
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa associada.' USING ERRCODE = '28000';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil IN ('admin', 'consultor', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Perfil sem acesso à prospecção de leads.' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.crm_leads_credenciais
    WHERE empresa_id = v_empresa_id AND status = 'conectado'
  ) INTO v_tem_credencial;

  IF v_tem_credencial THEN
    RETURN QUERY SELECT true, 'tenant'::text, NULL::int, NULL::int, NULL::int, true, NULL::date, NULL::date;
    RETURN;
  END IF;

  SELECT plano INTO v_plano FROM public.empresas WHERE id = v_empresa_id;

  IF v_plano = 'trial' THEN
    SELECT trial_leads_usados, trial_leads_limite INTO v_trial_usados, v_trial_limite
      FROM public.crm_leads_config WHERE empresa_id = v_empresa_id;
    -- Linha de config deveria sempre existir (seed em provision_tenant /
    -- backfill), mas se faltar por algum motivo, trata como zerada em vez
    -- de quebrar a busca de leads.
    v_trial_usados := coalesce(v_trial_usados, 0);
    v_trial_limite := coalesce(v_trial_limite, 5);
    RETURN QUERY SELECT
      (v_trial_usados < v_trial_limite), 'trial'::text, v_trial_limite, v_trial_usados,
      (v_trial_limite - v_trial_usados), false, NULL::date, NULL::date;
    RETURN;
  END IF;

  v_periodo_inicio := date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_periodo_fim := (v_periodo_inicio + interval '1 month' - interval '1 day')::date;

  SELECT leads_importados INTO v_mensal_usados
    FROM public.crm_leads_usage WHERE empresa_id = v_empresa_id AND periodo_inicio = v_periodo_inicio;
  v_mensal_usados := coalesce(v_mensal_usados, 0);

  RETURN QUERY SELECT
    (v_mensal_usados < 30), 'mensal'::text, 30, v_mensal_usados,
    (30 - v_mensal_usados), false, v_periodo_inicio, v_periodo_fim;
END;
$function$;

CREATE OR REPLACE FUNCTION public.crm_importar_lead_google(
  p_place_id text,
  p_razao_social text,
  p_nome_fantasia text,
  p_cidade text,
  p_estado text,
  p_site text,
  p_whatsapp text,
  p_pipeline_id uuid,
  p_etapa_id uuid,
  p_responsavel_id uuid
)
RETURNS TABLE (crm_empresa_id uuid, crm_oportunidade_id uuid, ja_existia boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_empresa_id uuid;
  v_existing_crm_empresa_id uuid;
  v_existing_oportunidade_id uuid;
  v_crm_empresa_id uuid;
  v_oportunidade_id uuid;
  v_origem_id uuid;
  v_tem_credencial boolean;
  v_plano text;
  v_trial_usados int;
  v_trial_limite int;
  v_periodo_inicio date;
  v_periodo_fim date;
  v_mensal_usados int;
  v_pode_importar boolean;
BEGIN
  v_empresa_id := public.get_minha_empresa();
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa associada.' USING ERRCODE = '28000';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil IN ('admin', 'consultor', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Perfil sem acesso à importação de leads.' USING ERRCODE = '42501';
  END IF;
  IF coalesce(trim(p_place_id), '') = '' OR coalesce(trim(p_razao_social), '') = '' THEN
    RAISE EXCEPTION 'place_id e razão social são obrigatórios.' USING ERRCODE = '22023';
  END IF;

  -- Idempotência: mesmo place_id já importado neste tenant (duplo clique,
  -- retry de rede, ou reimportação intencional) retorna o registro
  -- existente sem duplicar Conta/Oportunidade e sem consumir cota de novo.
  SELECT id INTO v_existing_crm_empresa_id
    FROM public.crm_empresas
    WHERE empresa_id = v_empresa_id AND google_place_id = p_place_id
    FOR UPDATE;

  IF FOUND THEN
    SELECT id INTO v_existing_oportunidade_id
      FROM public.crm_oportunidades
      WHERE public.crm_oportunidades.crm_empresa_id = v_existing_crm_empresa_id
      ORDER BY created_at ASC LIMIT 1;
    RETURN QUERY SELECT v_existing_crm_empresa_id, v_existing_oportunidade_id, true;
    RETURN;
  END IF;

  -- Trava a linha de cota relevante ANTES de checar o limite, serializando
  -- importações concorrentes do mesmo tenant — impede que duas chamadas
  -- simultâneas leiam o mesmo contador "não estourado" e ambas passem.
  SELECT EXISTS (
    SELECT 1 FROM public.crm_leads_credenciais
    WHERE empresa_id = v_empresa_id AND status = 'conectado'
  ) INTO v_tem_credencial;

  IF NOT v_tem_credencial THEN
    SELECT plano INTO v_plano FROM public.empresas WHERE id = v_empresa_id;

    IF v_plano = 'trial' THEN
      PERFORM 1 FROM public.crm_leads_config WHERE empresa_id = v_empresa_id FOR UPDATE;
      IF NOT FOUND THEN
        INSERT INTO public.crm_leads_config (empresa_id) VALUES (v_empresa_id);
      END IF;
      SELECT trial_leads_usados, trial_leads_limite INTO v_trial_usados, v_trial_limite
        FROM public.crm_leads_config WHERE empresa_id = v_empresa_id;
      v_pode_importar := v_trial_usados < v_trial_limite;
      IF NOT v_pode_importar THEN
        RAISE EXCEPTION 'Você utilizou os % leads incluídos na demonstração. Para continuar utilizando a prospecção, contrate um plano do RDCheck.', v_trial_limite
          USING ERRCODE = 'P0001', HINT = 'trial_limite_atingido';
      END IF;
    ELSE
      v_periodo_inicio := date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo')::date;
      v_periodo_fim := (v_periodo_inicio + interval '1 month' - interval '1 day')::date;

      INSERT INTO public.crm_leads_usage (empresa_id, periodo_inicio, periodo_fim, leads_importados)
        VALUES (v_empresa_id, v_periodo_inicio, v_periodo_fim, 0)
        ON CONFLICT (empresa_id, periodo_inicio) DO NOTHING;

      PERFORM 1 FROM public.crm_leads_usage
        WHERE empresa_id = v_empresa_id AND periodo_inicio = v_periodo_inicio FOR UPDATE;

      SELECT leads_importados INTO v_mensal_usados
        FROM public.crm_leads_usage WHERE empresa_id = v_empresa_id AND periodo_inicio = v_periodo_inicio;
      v_pode_importar := v_mensal_usados < 30;
      IF NOT v_pode_importar THEN
        RAISE EXCEPTION 'Você utilizou os 30 leads incluídos neste mês. Para continuar agora, conecte sua própria conta do Google Cloud. Seu consumo passará a ser processado diretamente pela sua configuração do Google Maps Platform.'
          USING ERRCODE = 'P0001', HINT = 'limite_mensal_atingido';
      END IF;
    END IF;
  END IF;

  SELECT id INTO v_origem_id FROM public.crm_origens_lead
    WHERE empresa_id = v_empresa_id AND nome = 'Google Maps';

  BEGIN
    INSERT INTO public.crm_empresas (
      empresa_id, razao_social, nome_fantasia, cidade, estado, site, whatsapp,
      responsavel_id, origem_id, status, google_place_id, observacoes
    ) VALUES (
      v_empresa_id, p_razao_social, p_nome_fantasia, p_cidade, p_estado, p_site, p_whatsapp,
      p_responsavel_id, v_origem_id, 'lead', p_place_id,
      'Importado via Buscar Leads (Google Places). Dados revisados e confirmados pelo usuário no momento da importação.'
    ) RETURNING id INTO v_crm_empresa_id;
  EXCEPTION WHEN unique_violation THEN
    -- Corrida rara: outra transação concorrente importou o mesmo place_id
    -- entre o FOR UPDATE acima (que não encontrou nada) e este INSERT.
    -- Trata como idempotente em vez de propagar erro pro usuário.
    SELECT id INTO v_existing_crm_empresa_id
      FROM public.crm_empresas WHERE empresa_id = v_empresa_id AND google_place_id = p_place_id;
    SELECT id INTO v_existing_oportunidade_id
      FROM public.crm_oportunidades WHERE public.crm_oportunidades.crm_empresa_id = v_existing_crm_empresa_id
      ORDER BY created_at ASC LIMIT 1;
    RETURN QUERY SELECT v_existing_crm_empresa_id, v_existing_oportunidade_id, true;
    RETURN;
  END;

  INSERT INTO public.crm_oportunidades (
    empresa_id, crm_empresa_id, pipeline_id, etapa_id, nome, responsavel_id
  ) VALUES (
    v_empresa_id, v_crm_empresa_id, p_pipeline_id, p_etapa_id, p_razao_social, p_responsavel_id
  ) RETURNING id INTO v_oportunidade_id;

  INSERT INTO public.crm_timeline (
    empresa_id, crm_empresa_id, crm_oportunidade_id, origem, evento_tipo, descricao, metadata
  ) VALUES (
    v_empresa_id, v_crm_empresa_id, v_oportunidade_id, 'sistema', 'lead_importado_google',
    'Lead importado via Buscar Leads (Google Places).', jsonb_build_object('place_id', p_place_id)
  );

  INSERT INTO public.crm_leads_importacoes (
    empresa_id, crm_empresa_id, google_place_id, credencial_origem, importado_por
  ) VALUES (
    v_empresa_id, v_crm_empresa_id, p_place_id,
    CASE WHEN v_tem_credencial THEN 'tenant' ELSE 'rdcheck' END, auth.uid()
  );

  -- Cota só é incrementada aqui, depois de Conta + Oportunidade + Timeline
  -- já terem sido gravadas com sucesso na mesma transação — qualquer falha
  -- acima faz rollback de tudo, sem consumir cota. Chave própria (BYO)
  -- nunca consome a cota do RDCheck.
  IF NOT v_tem_credencial THEN
    IF v_plano = 'trial' THEN
      UPDATE public.crm_leads_config SET trial_leads_usados = trial_leads_usados + 1
        WHERE empresa_id = v_empresa_id;
    ELSE
      UPDATE public.crm_leads_usage SET leads_importados = leads_importados + 1
        WHERE empresa_id = v_empresa_id AND periodo_inicio = v_periodo_inicio;
    END IF;
  END IF;

  RETURN QUERY SELECT v_crm_empresa_id, v_oportunidade_id, false;
END;
$function$;
