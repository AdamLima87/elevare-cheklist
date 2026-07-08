-- Criar função para verificar se o usuário é admin sem causar recursão
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN (
    SELECT (perfil = 'admin')
    FROM public.profiles
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ajustar permissões da função
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Remover política problemática
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;

-- Recriar política usando a função is_admin()
CREATE POLICY "Admins can manage all profiles" ON public.profiles
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Garantir que todos possam ver seu próprio perfil (SELECT já existe, mas vamos garantir)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Garantir que todos possam atualizar seu próprio perfil
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
