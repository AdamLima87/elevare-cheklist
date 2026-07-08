-- Revogar acesso público às funções SECURITY DEFINER para evitar execução por usuários não autorizados
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;

-- Alterar a função handle_new_user para SECURITY INVOKER
-- Isso garante que ela execute com as permissões do usuário que a invoca, seguindo as melhores práticas de segurança do Supabase
ALTER FUNCTION public.handle_new_user() SECURITY INVOKER;

-- Garantir que as funções necessárias ainda possam ser executadas pelo sistema
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO service_role;
GRANT EXECUTE ON FUNCTION public.promote_first_user_to_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.promote_first_user_to_admin() TO service_role;
