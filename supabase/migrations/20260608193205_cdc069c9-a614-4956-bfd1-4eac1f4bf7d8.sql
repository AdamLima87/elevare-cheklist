-- Corrigir recursão infinita nas políticas de profiles e inspecoes

-- Remover políticas recursivas existentes
DROP POLICY IF EXISTS "Admins can manage profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

DROP POLICY IF EXISTS "Admins can manage all inspecoes" ON public.inspecoes;
DROP POLICY IF EXISTS "Consultores can manage their own inspecoes" ON public.inspecoes;
DROP POLICY IF EXISTS "Clientes can view their own inspecoes" ON public.inspecoes;

-- Função segura para verificar perfil sem acionar RLS recursiva
CREATE OR REPLACE FUNCTION public.get_user_profile(_user_id uuid)
RETURNS TABLE(perfil text, ativo boolean, cnpj text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.perfil, p.ativo, p.cnpj
  FROM public.profiles p
  WHERE p.id = _user_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = _user_id
      AND p.perfil = 'admin'
      AND p.ativo = true
  );
$$;

CREATE OR REPLACE FUNCTION public.has_profile(_user_id uuid, _perfil text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = _user_id
      AND p.perfil = _perfil
      AND p.ativo = true
  );
$$;

REVOKE EXECUTE ON FUNCTION public.get_user_profile(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_profile(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.has_profile(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_profile(uuid, text) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.get_user_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_profile(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_profile(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_profile(uuid, text) TO service_role;

-- Recriar políticas de profiles sem recursão direta
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Recriar políticas de inspecoes usando funções seguras
CREATE POLICY "Admins can manage all inspecoes"
ON public.inspecoes
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Consultores can manage their own inspecoes"
ON public.inspecoes
FOR ALL
TO authenticated
USING (consultor_id = auth.uid() AND public.has_profile(auth.uid(), 'consultor'))
WITH CHECK (consultor_id = auth.uid() AND public.has_profile(auth.uid(), 'consultor'));

CREATE POLICY "Clientes can view their own inspecoes"
ON public.inspecoes
FOR SELECT
TO authenticated
USING (
  status = 'concluida'
  AND cnpj = (SELECT gp.cnpj FROM public.get_user_profile(auth.uid()) gp)
  AND public.has_profile(auth.uid(), 'cliente')
);

-- Garantir acesso da Data API conforme as políticas
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inspecoes TO authenticated;
GRANT ALL ON public.inspecoes TO service_role;