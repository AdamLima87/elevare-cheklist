
-- 1. Restrict client_user_queue to admins only
DROP POLICY IF EXISTS "Admins e consultores podem gerenciar fila" ON public.client_user_queue;
CREATE POLICY "Admins can manage client user queue"
  ON public.client_user_queue
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 2. Restrict numeracao_inspecoes writes to admin/consultor; reads stay open for authenticated
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.numeracao_inspecoes;
CREATE POLICY "Authenticated can read numeracao"
  ON public.numeracao_inspecoes
  FOR SELECT
  TO authenticated
  USING (true);
CREATE POLICY "Admins and consultores can modify numeracao"
  ON public.numeracao_inspecoes
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT perfil FROM public.profiles WHERE id = auth.uid()) = ANY (ARRAY['admin','consultor']));
CREATE POLICY "Admins and consultores can update numeracao"
  ON public.numeracao_inspecoes
  FOR UPDATE
  TO authenticated
  USING ((SELECT perfil FROM public.profiles WHERE id = auth.uid()) = ANY (ARRAY['admin','consultor']))
  WITH CHECK ((SELECT perfil FROM public.profiles WHERE id = auth.uid()) = ANY (ARRAY['admin','consultor']));
CREATE POLICY "Admins and consultores can delete numeracao"
  ON public.numeracao_inspecoes
  FOR DELETE
  TO authenticated
  USING ((SELECT perfil FROM public.profiles WHERE id = auth.uid()) = ANY (ARRAY['admin','consultor']));

-- 3. Lock SECURITY DEFINER queue functions: set search_path and revoke from public/anon/authenticated
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;
