DROP POLICY IF EXISTS "Clientes podem ver suas próprias inspeções" ON public.inspecoes;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;