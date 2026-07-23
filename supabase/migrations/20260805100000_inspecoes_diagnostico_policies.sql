-- Fase 3 (Diagnóstico no CRM) — autorização e integridade estrutural para
-- diagnósticos pré-venda. Zero mudança de comportamento visível: hoje não
-- existe nenhuma linha real com tipo_execucao='diagnostico' (Fase 4 ainda
-- não existe), então nenhuma policy/constraint nova aqui afeta dado real.

-- 1. Helper: "este usuário tem papel elegível pro CRM e está ativo?" — não
-- decide tenant (isso continua com get_minha_empresa()/is_super_admin()).
-- Mesmo estilo dos helpers existentes.
CREATE OR REPLACE FUNCTION public.can_access_crm()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND ativo = true AND perfil IN ('admin', 'consultor', 'super_admin')
  )
$$;

REVOKE ALL ON FUNCTION public.can_access_crm() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_crm() TO authenticated;

-- 2. Três policies aditivas para diagnóstico pré-venda em inspecoes.
-- FK composta inspecoes_crm_oportunidade_empresa_fkey já garante empresa_id
-- consistente quando crm_oportunidade_id é preenchido — não precisa de EXISTS
-- redundante contra crm_oportunidades. cliente_id não tem essa garantia (FK
-- simples), por isso o EXISTS contra clientes nas policies de INSERT/UPDATE.

CREATE POLICY "inspecoes_diagnostico_select" ON public.inspecoes
FOR SELECT USING (
  tipo_execucao = 'diagnostico' AND public.can_access_crm()
  AND (public.is_super_admin() OR empresa_id = public.get_minha_empresa())
);

CREATE POLICY "inspecoes_diagnostico_insert" ON public.inspecoes
FOR INSERT WITH CHECK (
  tipo_execucao = 'diagnostico' AND public.can_access_crm()
  AND (public.is_super_admin() OR empresa_id = public.get_minha_empresa())
  AND crm_oportunidade_id IS NOT NULL
  AND (cliente_id IS NULL OR EXISTS (
    SELECT 1 FROM public.clientes c WHERE c.id = inspecoes.cliente_id AND c.empresa_id = inspecoes.empresa_id
  ))
);

-- crm_oportunidade_id IS NOT NULL em USING e WITH CHECK é defesa em
-- profundidade, mas não é suficiente sozinha: inspecoes_admin (FOR ALL, sem
-- essa exigência) é uma policy permissiva separada e Postgres combina
-- policies permissivas do mesmo comando por OR. A garantia real de que um
-- diagnóstico nunca perde crm_oportunidade_id é a constraint estrutural
-- abaixo, incondicional a qual policy autorizou a escrita.
CREATE POLICY "inspecoes_diagnostico_update" ON public.inspecoes
FOR UPDATE USING (
  tipo_execucao = 'diagnostico' AND crm_oportunidade_id IS NOT NULL AND public.can_access_crm()
  AND (public.is_super_admin() OR empresa_id = public.get_minha_empresa())
) WITH CHECK (
  tipo_execucao = 'diagnostico' AND crm_oportunidade_id IS NOT NULL AND public.can_access_crm()
  AND (public.is_super_admin() OR empresa_id = public.get_minha_empresa())
  AND (cliente_id IS NULL OR EXISTS (
    SELECT 1 FROM public.clientes c WHERE c.id = inspecoes.cliente_id AND c.empresa_id = inspecoes.empresa_id
  ))
);

-- Sem policy de DELETE nova: inspecoes_admin (FOR ALL) já cobre exclusão
-- para admin/super_admin; sem pedido claro de consultor excluir diagnóstico.

-- 3. Correção pontual em inspecoes_cliente: hoje casa só por
-- empresa_id+cnpj, sem filtrar tipo_execucao — vazaria diagnóstico pré-venda
-- pro perfil cliente se o cnpj bater, antes mesmo da conversão. Mudança
-- estritamente mais restritiva (nunca concede o que não concedia antes);
-- hoje 100% das linhas são tipo_execucao<>'diagnostico', então isso não
-- afeta nenhum dado real existente.
DROP POLICY "inspecoes_cliente" ON public.inspecoes;
CREATE POLICY "inspecoes_cliente" ON public.inspecoes
  FOR SELECT USING (
    empresa_id = public.get_minha_empresa()
    AND tipo_execucao <> 'diagnostico'
    AND cnpj = (SELECT cnpj FROM public.profiles WHERE id = auth.uid() AND perfil = 'cliente')
  );

-- 4. Constraint estrutural: diagnóstico nasce vinculado a uma oportunidade e
-- nunca perde esse vínculo, em qualquer camada de escrita (não só via RLS).
-- NOT VALID de propósito — validada só depois de confirmar, via script
-- read-only, que não existe nenhuma linha violadora (ver Etapa 3.4 do plano
-- / scripts/prevalidacao-diagnostico-crm.mjs).
ALTER TABLE public.inspecoes
  ADD CONSTRAINT inspecoes_diagnostico_tem_oportunidade_check
  CHECK (tipo_execucao <> 'diagnostico' OR crm_oportunidade_id IS NOT NULL)
  NOT VALID;
