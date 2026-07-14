-- empresas tinha RLS habilitado sem nenhuma policy (deny-all). super_admin precisa
-- listar todas; um admin/consultor comum só ve a propria empresa (ex: tela de onboarding).
CREATE POLICY "empresas_select" ON public.empresas
  FOR SELECT USING (
    public.is_super_admin()
    OR id = public.get_minha_empresa()
  );
