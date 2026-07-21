-- CRM Comercial — Etapa 8: relatório de inconsistências, pra rodar ANTES
-- da migração de verdade em cada tenant. Só leitura, não move nada. Não é
-- exposta pra authenticated de propósito — é uma ferramenta operacional,
-- rodada manualmente (service role / super admin) antes de decidir migrar
-- um tenant, não uma feature do produto.
CREATE OR REPLACE FUNCTION public.crm_relatorio_pre_migracao_prospeccao(p_empresa_id uuid DEFAULT NULL)
RETURNS TABLE (
  empresa_id uuid,
  total_prospeccao int,
  sem_responsavel int,
  sem_admin_para_fallback boolean,
  cnpj_colidindo_com_conta_existente int,
  ja_migrados int
)
LANGUAGE sql
STABLE
AS $function$
  SELECT
    e.id AS empresa_id,
    count(c.id)::int AS total_prospeccao,
    count(c.id) FILTER (WHERE c.responsavel_id IS NULL)::int AS sem_responsavel,
    NOT EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.empresa_id = e.id AND p.perfil = 'admin' AND p.ativo
    ) AS sem_admin_para_fallback,
    count(c.id) FILTER (
      WHERE c.cnpj IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.crm_empresas ce
          WHERE ce.empresa_id = e.id AND ce.cnpj = regexp_replace(c.cnpj, '\D', '', 'g')
        )
    )::int AS cnpj_colidindo_com_conta_existente,
    (
      SELECT count(*)::int FROM public.crm_migracao_prospeccao m
      WHERE m.empresa_id = e.id AND m.status = 'migrado'
    ) AS ja_migrados
  FROM public.empresas e
  LEFT JOIN public.clientes c ON c.empresa_id = e.id AND c.status = 'prospeccao'
  WHERE p_empresa_id IS NULL OR e.id = p_empresa_id
  GROUP BY e.id
  HAVING count(c.id) > 0 OR p_empresa_id IS NOT NULL
$function$;
