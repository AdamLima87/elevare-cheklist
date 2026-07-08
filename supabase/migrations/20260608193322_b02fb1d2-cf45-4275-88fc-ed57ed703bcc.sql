-- Remover políticas que dependem das funções SECURITY DEFINER recém-criadas
DROP POLICY IF EXISTS "Admins can manage profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

DROP POLICY IF EXISTS "Admins can manage all inspecoes" ON public.inspecoes;
DROP POLICY IF EXISTS "Consultores can manage their own inspecoes" ON public.inspecoes;
DROP POLICY IF EXISTS "Clientes can view their own inspecoes" ON public.inspecoes;

-- Remover funções SECURITY DEFINER que causaram alertas do linter
DROP FUNCTION IF EXISTS public.get_user_profile(uuid);
DROP FUNCTION IF EXISTS public.is_admin(uuid);
DROP FUNCTION IF EXISTS public.has_profile(uuid, text);

-- Perfil: cada usuário autenticado consegue ler o próprio perfil sem recursão
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Perfil: cada usuário autenticado consegue atualizar apenas dados não críticos do próprio perfil
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Inspeções: admin gerencia todas, verificando apenas o próprio perfil
CREATE POLICY "Admins can manage all inspecoes"
ON public.inspecoes
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.perfil = 'admin'
      AND p.ativo = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.perfil = 'admin'
      AND p.ativo = true
  )
);

-- Inspeções: consultor gerencia apenas as próprias inspeções
CREATE POLICY "Consultores can manage their own inspecoes"
ON public.inspecoes
FOR ALL
TO authenticated
USING (
  consultor_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.perfil = 'consultor'
      AND p.ativo = true
  )
)
WITH CHECK (
  consultor_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.perfil = 'consultor'
      AND p.ativo = true
  )
);

-- Inspeções: cliente lê apenas resultados concluídos do CNPJ vinculado ao próprio perfil
CREATE POLICY "Clientes can view their own inspecoes"
ON public.inspecoes
FOR SELECT
TO authenticated
USING (
  status = 'concluida'
  AND cnpj = (
    SELECT p.cnpj FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.perfil = 'cliente'
      AND p.ativo = true
  )
);

GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inspecoes TO authenticated;
GRANT ALL ON public.inspecoes TO service_role;