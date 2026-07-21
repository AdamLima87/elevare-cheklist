-- CRM Comercial — Etapa 8: migração de fato dos prospects legados
-- (clientes.status='prospeccao') pro CRM novo, tenant por tenant.
--
-- Idempotente: cada cliente processado grava uma linha em
-- crm_migracao_prospeccao (empresa_id, cliente_id) — rodar de novo pula
-- tudo que já foi migrado ou já deu erro antes (silenciosamente), sem
-- duplicar nada.
--
-- Para cada cliente legado:
--   - crm_empresas nova: nome/cnpj/responsável preservados; se
--     responsavel_id for nulo, cai no primeiro admin ativo do tenant
--     (marcado em responsavel_fallback=true na tabela de controle, pra
--     revisão manual depois).
--   - etapa_funil legado mapeado pro nome da etapa correspondente no
--     pipeline padrão do CRM; se não reconhecer, cai na primeira etapa
--     aberta.
--   - se a etapa mapeada for "ganho": crm_empresas já nasce status='ativa'
--     e cliente_id apontando pro PRÓPRIO registro legado (esse cliente já
--     é operacional — não faz sentido criar um duplicado).
--   - se for "perdido": usa o motivo "Outro" (motivo original não existia
--     no sistema legado) com detalhe explicando a migração.
--   - qualquer erro (ex: CNPJ colidindo com uma Conta já existente) é
--     capturado e logado em crm_migracao_prospeccao como 'erro', sem
--     abortar o restante do tenant.
--
-- Não é exposta pra authenticated de propósito — chamada manualmente
-- (service role) depois de revisar crm_relatorio_pre_migracao_prospeccao
-- pro tenant, nunca automaticamente.
CREATE OR REPLACE FUNCTION public.crm_migrar_prospeccao_tenant(p_empresa_id uuid)
RETURNS TABLE (migrados int, pulados int, erros int)
LANGUAGE plpgsql
AS $function$
DECLARE
  v_cliente record;
  v_pipeline_id uuid;
  v_etapa_id uuid;
  v_etapa_tipo text;
  v_admin_fallback_id uuid;
  v_responsavel_id uuid;
  v_crm_empresa_id uuid;
  v_crm_oportunidade_id uuid;
  v_cnpj_normalizado text;
  v_motivo_outro_id uuid;
  v_migrados int := 0;
  v_pulados int := 0;
  v_erros int := 0;
  v_fallback_usado boolean;
BEGIN
  SELECT id INTO v_pipeline_id FROM public.crm_pipelines WHERE empresa_id = p_empresa_id AND padrao = true;
  IF v_pipeline_id IS NULL THEN
    RAISE EXCEPTION 'Tenant % não tem pipeline padrão do CRM configurado — rode crm_seed_catalogos_padrao antes.', p_empresa_id;
  END IF;

  SELECT id INTO v_admin_fallback_id FROM public.profiles
    WHERE empresa_id = p_empresa_id AND perfil = 'admin' AND ativo
    ORDER BY created_at LIMIT 1;

  SELECT id INTO v_motivo_outro_id FROM public.crm_motivos_perda WHERE empresa_id = p_empresa_id AND nome = 'Outro';

  FOR v_cliente IN
    SELECT * FROM public.clientes WHERE empresa_id = p_empresa_id AND status = 'prospeccao'
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.crm_migracao_prospeccao
      WHERE empresa_id = p_empresa_id AND cliente_id = v_cliente.id
    ) THEN
      v_pulados := v_pulados + 1;
      CONTINUE;
    END IF;

    BEGIN
      v_fallback_usado := false;
      v_responsavel_id := v_cliente.responsavel_id;
      IF v_responsavel_id IS NULL THEN
        v_responsavel_id := v_admin_fallback_id;
        v_fallback_usado := true;
      END IF;
      IF v_responsavel_id IS NULL THEN
        RAISE EXCEPTION 'Sem responsável na linha legada e sem admin ativo nesse tenant pra fallback.';
      END IF;

      SELECT id, tipo INTO v_etapa_id, v_etapa_tipo FROM public.crm_etapas
        WHERE pipeline_id = v_pipeline_id AND nome = CASE v_cliente.etapa_funil
          WHEN 'novo_lead' THEN 'Novo Lead'
          WHEN 'contato_feito' THEN 'Qualificação'
          WHEN 'proposta_enviada' THEN 'Proposta Enviada'
          WHEN 'negociacao' THEN 'Negociação'
          WHEN 'fechado_ganho' THEN 'Ganho'
          WHEN 'fechado_perdido' THEN 'Perdido'
          ELSE 'Novo Lead'
        END;
      IF v_etapa_id IS NULL THEN
        SELECT id, tipo INTO v_etapa_id, v_etapa_tipo FROM public.crm_etapas
          WHERE pipeline_id = v_pipeline_id AND tipo = 'aberta' ORDER BY ordem LIMIT 1;
      END IF;

      v_cnpj_normalizado := NULLIF(regexp_replace(coalesce(v_cliente.cnpj, ''), '\D', '', 'g'), '');

      INSERT INTO public.crm_empresas (
        empresa_id, razao_social, cnpj, responsavel_id, status, cliente_id, observacoes
      ) VALUES (
        p_empresa_id, v_cliente.nome, v_cnpj_normalizado, v_responsavel_id,
        CASE WHEN v_etapa_tipo = 'ganho' THEN 'ativa' ELSE 'prospect' END,
        CASE WHEN v_etapa_tipo = 'ganho' THEN v_cliente.id ELSE NULL END,
        'Migrado automaticamente da Prospecção legada.'
      ) RETURNING id INTO v_crm_empresa_id;

      INSERT INTO public.crm_oportunidades (
        empresa_id, crm_empresa_id, pipeline_id, etapa_id, nome, responsavel_id,
        motivo_perda_id, motivo_perda_detalhe, fechada_em
      ) VALUES (
        p_empresa_id, v_crm_empresa_id, v_pipeline_id, v_etapa_id,
        v_cliente.nome, v_responsavel_id,
        CASE WHEN v_etapa_tipo = 'perdido' THEN v_motivo_outro_id ELSE NULL END,
        CASE WHEN v_etapa_tipo = 'perdido' THEN 'Migrado da Prospecção — motivo original não registrado.' ELSE NULL END,
        CASE WHEN v_etapa_tipo IN ('ganho', 'perdido') THEN now() ELSE NULL END
      ) RETURNING id INTO v_crm_oportunidade_id;

      INSERT INTO public.crm_migracao_prospeccao (
        empresa_id, cliente_id, crm_empresa_id, crm_oportunidade_id, status, responsavel_fallback
      ) VALUES (
        p_empresa_id, v_cliente.id, v_crm_empresa_id, v_crm_oportunidade_id, 'migrado', v_fallback_usado
      );

      v_migrados := v_migrados + 1;
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.crm_migracao_prospeccao (empresa_id, cliente_id, status, motivo)
        VALUES (p_empresa_id, v_cliente.id, 'erro', SQLERRM)
        ON CONFLICT (empresa_id, cliente_id) DO NOTHING;
      v_erros := v_erros + 1;
    END;
  END LOOP;

  RETURN QUERY SELECT v_migrados, v_pulados, v_erros;
END;
$function$;
