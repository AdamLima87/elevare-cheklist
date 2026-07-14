-- Fase 4: admins/super_admin precisam poder atualizar (ativar/desativar) perfis
-- da propria empresa pelo client (hoje so existe profiles_update com id = auth.uid()).
CREATE POLICY "profiles_admin_manage" ON public.profiles
  FOR UPDATE USING (
    public.is_super_admin()
    OR (
      empresa_id = public.get_minha_empresa()
      AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil = 'admin')
    )
  );
