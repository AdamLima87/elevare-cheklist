-- Fase 3.2: reescrever policies para isolar por empresa_id, com bypass para super_admin

-- profiles: hoje profiles_select deixa qualquer usuario autenticado ver todos os perfis
-- (vazamento entre empresas). Passa a restringir a mesma empresa.
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (
    public.is_super_admin()
    OR empresa_id = public.get_minha_empresa()
  );

-- inspecoes
DROP POLICY IF EXISTS "inspecoes_admin" ON public.inspecoes;
CREATE POLICY "inspecoes_admin" ON public.inspecoes
  FOR ALL USING (
    public.is_super_admin()
    OR (
      empresa_id = public.get_minha_empresa()
      AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil = 'admin')
    )
  );

DROP POLICY IF EXISTS "inspecoes_consultor" ON public.inspecoes;
CREATE POLICY "inspecoes_consultor" ON public.inspecoes
  FOR ALL USING (
    consultor_id = auth.uid()
    AND empresa_id = public.get_minha_empresa()
  );

DROP POLICY IF EXISTS "inspecoes_cliente" ON public.inspecoes;
CREATE POLICY "inspecoes_cliente" ON public.inspecoes
  FOR SELECT USING (
    empresa_id = public.get_minha_empresa()
    AND cnpj = (SELECT cnpj FROM public.profiles WHERE id = auth.uid() AND perfil = 'cliente')
  );

-- clientes
DROP POLICY IF EXISTS "Admins can manage clientes" ON public.clientes;
CREATE POLICY "clientes_admin" ON public.clientes
  FOR ALL USING (
    public.is_super_admin()
    OR (
      empresa_id = public.get_minha_empresa()
      AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil = 'admin')
    )
  );

DROP POLICY IF EXISTS "Consultores can manage clientes" ON public.clientes;
CREATE POLICY "clientes_consultor" ON public.clientes
  FOR ALL USING (
    empresa_id = public.get_minha_empresa()
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil = 'consultor')
  );

-- configuracoes
DROP POLICY IF EXISTS "configuracoes_admin" ON public.configuracoes;
CREATE POLICY "configuracoes_admin" ON public.configuracoes
  FOR ALL USING (
    public.is_super_admin()
    OR (
      empresa_id = public.get_minha_empresa()
      AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil = 'admin')
    )
  );
