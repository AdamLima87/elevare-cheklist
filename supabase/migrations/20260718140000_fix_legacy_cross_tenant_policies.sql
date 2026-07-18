-- Três policies legadas (anteriores ao refactor multi-tenant) concedem ALL
-- a "qualquer admin" sem checar empresa_id. Como policies RLS são somadas
-- por OR, elas permaneciam ativas mesmo depois das policies corretas
-- (*_admin, escopadas por empresa_id = get_minha_empresa()) terem sido
-- criadas — um admin de uma empresa conseguia ler/escrever configuracoes,
-- inspecoes e profiles de QUALQUER outra empresa via chamada direta à API.
-- Confirmado que cada uma tem uma policy equivalente e corretamente
-- escopada já em vigor, e que nenhum caminho do app depende do DELETE
-- irrestrito de profiles (grep: zero chamadas a profiles.delete()).
DROP POLICY IF EXISTS "Admins can manage settings" ON public.configuracoes;
DROP POLICY IF EXISTS "Admins can manage all inspecoes" ON public.inspecoes;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;

-- RPC estreita para o próprio admin marcar o onboarding da sua empresa
-- como concluído. Não expõe UPDATE genérico em empresas (que incluiria
-- colunas sensíveis como plano/status/trial_ends_at) — só este campo.
CREATE OR REPLACE FUNCTION public.complete_onboarding()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_empresa_id uuid;
BEGIN
  v_empresa_id := public.get_minha_empresa();
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa associada ou inativo' USING ERRCODE = '28000';
  END IF;

  UPDATE public.empresas
    SET onboarding_completed_at = now()
    WHERE id = v_empresa_id AND onboarding_completed_at IS NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.complete_onboarding() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_onboarding() TO authenticated;
