-- CRM Comercial — score do lead, baseado só em regras (zero IA). Ajuste do
-- usuário aplicado aqui: segmento (texto livre) NÃO entra como fator —
-- só dado estruturado ou catálogo configurável pontua. Fatores atuais:
--   - origem do lead: peso_score da própria crm_origens_lead (dado, não
--     código — ajustável por tenant sem migration/deploy)
--   - porte: numero_unidades (até 30 pontos)
--   - interação/urgência: atividades concluídas dessa Conta (até 30 pontos)
--   - potencial: maior oportunidade aberta em valor_estimado (até 30 pontos)
-- SECURITY INVOKER (padrão): roda com os privilégios de quem chamou, então
-- a RLS de crm_empresas/crm_atividades/crm_oportunidades/crm_origens_lead
-- continua valendo normalmente — sem risco de vazar dado entre tenants.
CREATE OR REPLACE FUNCTION public.crm_lead_score(p_crm_empresa_id uuid)
RETURNS int
LANGUAGE sql
STABLE
AS $function$
  SELECT (
    coalesce((
      SELECT ol.peso_score
      FROM public.crm_empresas e
      JOIN public.crm_origens_lead ol ON ol.id = e.origem_id
      WHERE e.id = p_crm_empresa_id
    ), 0)
    + least(coalesce((
        SELECT numero_unidades FROM public.crm_empresas WHERE id = p_crm_empresa_id
      ), 0) * 2, 30)
    + least((
        SELECT count(*)::int FROM public.crm_atividades
        WHERE crm_empresa_id = p_crm_empresa_id AND status = 'concluida'
      ) * 5, 30)
    + least(floor(coalesce((
        SELECT max(valor_estimado) FROM public.crm_oportunidades
        WHERE crm_empresa_id = p_crm_empresa_id AND fechada_em IS NULL
      ), 0) / 1000)::int, 30)
  )::int
$function$;

GRANT EXECUTE ON FUNCTION public.crm_lead_score(uuid) TO authenticated;

-- Versão em view para listagens em lote (Contas), sem chamar a função
-- linha a linha no client. Mesma ressalva de security_invoker da view de
-- saúde: sem isso a RLS de crm_empresas seria ignorada.
CREATE VIEW public.crm_empresas_score
WITH (security_invoker = true)
AS
SELECT e.*, public.crm_lead_score(e.id) AS score
FROM public.crm_empresas e;

GRANT SELECT ON public.crm_empresas_score TO authenticated;
GRANT SELECT ON public.crm_empresas_score TO service_role;
