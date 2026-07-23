-- Fase 3 (Diagnóstico no CRM) — achado durante a revalidação pós-migration:
-- staging ainda tem uma policy LEGADA "Clientes can view their own inspecoes"
-- (pré-multitenant, coexistindo com inspecoes_cliente por drift de histórico
-- de migrations em staging), que casa por status='concluida'+cnpj SEM
-- filtrar tipo_execucao — o mesmo vazamento de diagnóstico pré-venda pro
-- perfil cliente que já foi corrigido em inspecoes_cliente na migration
-- anterior, só que por um caminho que o código-fonte sugeria já estar
-- removido (supabase/migrations/20260718140000_fix_legacy_cross_tenant_policies.sql
-- só dropa "Admins can manage all inspecoes", nunca esta). Mesma correção:
-- estritamente mais restritiva, zero regressão (hoje 100% das linhas são
-- tipo_execucao<>'diagnostico').
DROP POLICY IF EXISTS "Clientes can view their own inspecoes" ON public.inspecoes;
CREATE POLICY "Clientes can view their own inspecoes" ON public.inspecoes
  FOR SELECT USING (
    status = 'concluida'
    AND tipo_execucao <> 'diagnostico'
    AND cnpj = (
      SELECT p.cnpj FROM public.profiles p
      WHERE p.id = auth.uid() AND p.perfil = 'cliente' AND p.ativo = true
    )
  );
