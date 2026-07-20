-- CRM Comercial — "saúde da oportunidade" (🟢/🟡/🔴), calculada a partir de
-- now() em cada consulta (não é coluna gravada, não precisa de cron pra
-- ficar desatualizada). Baseada em 3 sinais, sem IA — só regras:
--   - atividade pendente vencida
--   - tempo na etapa atual (etapa_alterada_em, mantido pelo trigger da Etapa 2)
--   - tempo desde o último evento na timeline (contato mais recente)
--
-- WITH (security_invoker = true): a view roda com os privilégios de quem
-- consulta, não do dono (postgres) — sem isso, a RLS de crm_oportunidades/
-- crm_timeline/crm_atividades seria ignorada e a view vazaria dados entre
-- tenants. Suportado desde Postgres 15; staging roda 17.6.
--
-- Limiares (10/21 dias parado na etapa, 7/14 dias sem contato) são um
-- ponto de partida arbitrário — ajustáveis aqui sem tocar em código de
-- aplicação, já que é tudo SQL numa view só.
CREATE VIEW public.crm_oportunidades_saude
WITH (security_invoker = true)
AS
SELECT
  o.*,
  ult.ultimo_evento_em,
  coalesce(atv.tem_atividade_vencida, false) AS tem_atividade_vencida,
  CASE
    WHEN o.fechada_em IS NOT NULL THEN 'fechada'
    WHEN coalesce(atv.tem_atividade_vencida, false)
      OR now() - o.etapa_alterada_em > interval '21 days'
      OR now() - coalesce(ult.ultimo_evento_em, o.created_at) > interval '14 days'
    THEN 'vermelho'
    WHEN now() - o.etapa_alterada_em > interval '10 days'
      OR now() - coalesce(ult.ultimo_evento_em, o.created_at) > interval '7 days'
    THEN 'amarelo'
    ELSE 'verde'
  END AS saude
FROM public.crm_oportunidades o
LEFT JOIN LATERAL (
  SELECT max(created_at) AS ultimo_evento_em
  FROM public.crm_timeline t
  WHERE t.crm_oportunidade_id = o.id
) ult ON true
LEFT JOIN LATERAL (
  SELECT EXISTS (
    SELECT 1 FROM public.crm_atividades a
    WHERE a.crm_oportunidade_id = o.id AND a.status = 'pendente' AND a.vencimento < now()
  ) AS tem_atividade_vencida
) atv ON true;

GRANT SELECT ON public.crm_oportunidades_saude TO authenticated;
GRANT SELECT ON public.crm_oportunidades_saude TO service_role;
