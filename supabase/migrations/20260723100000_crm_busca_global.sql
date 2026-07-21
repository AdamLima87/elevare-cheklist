-- CRM Comercial — busca global por Conta (razão social/fantasia/CNPJ/
-- cidade/whatsapp/tags/responsável) ou Contato (nome/telefone/whatsapp/
-- email). Um round-trip só (função SQL com UNION), não múltiplas chamadas
-- .or() do client. SECURITY INVOKER (padrão): roda com os privilégios de
-- quem chamou, RLS de crm_empresas/crm_contatos/profiles continua valendo
-- normalmente.
CREATE OR REPLACE FUNCTION public.crm_busca_global(p_query text)
RETURNS TABLE (
  tipo text,
  id uuid,
  titulo text,
  subtitulo text,
  crm_empresa_id uuid
)
LANGUAGE sql
STABLE
AS $function$
  SELECT 'conta', e.id, coalesce(e.nome_fantasia, e.razao_social),
    nullif(concat_ws(' · ', e.cidade, e.cnpj), ''), e.id
  FROM public.crm_empresas e
  WHERE e.razao_social ILIKE '%' || p_query || '%'
    OR e.nome_fantasia ILIKE '%' || p_query || '%'
    OR e.cnpj ILIKE '%' || p_query || '%'
    OR e.cidade ILIKE '%' || p_query || '%'
    OR e.whatsapp ILIKE '%' || p_query || '%'
    OR EXISTS (SELECT 1 FROM unnest(e.tags) tag WHERE tag ILIKE '%' || p_query || '%')

  UNION ALL

  SELECT 'contato', c.id, c.nome,
    nullif(coalesce(c.telefone, c.whatsapp, c.email), ''), c.crm_empresa_id
  FROM public.crm_contatos c
  WHERE c.nome ILIKE '%' || p_query || '%'
    OR c.telefone ILIKE '%' || p_query || '%'
    OR c.whatsapp ILIKE '%' || p_query || '%'
    OR c.email ILIKE '%' || p_query || '%'

  UNION ALL

  SELECT 'conta', e.id, coalesce(e.nome_fantasia, e.razao_social),
    'Responsável: ' || p.nome, e.id
  FROM public.crm_empresas e
  JOIN public.profiles p ON p.id = e.responsavel_id
  WHERE p.nome ILIKE '%' || p_query || '%'

  LIMIT 20
$function$;

GRANT EXECUTE ON FUNCTION public.crm_busca_global(text) TO authenticated;
