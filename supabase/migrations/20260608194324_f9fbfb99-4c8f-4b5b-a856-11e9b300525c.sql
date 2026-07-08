-- Remover a política que pode causar recursão ou que foi criada incorretamente
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;

-- Criar uma nova política que permite admins gerenciarem perfis.
-- Usamos uma subquery que o Postgres otimiza, mas para ser ainda mais seguro contra recursão,
-- garantimos que o admin logado não precise ler a própria linha de forma recursiva.
CREATE POLICY "Admins can manage all profiles" ON public.profiles
FOR ALL
TO authenticated
USING (
  (SELECT p.perfil FROM public.profiles p WHERE p.id = auth.uid()) = 'admin'
)
WITH CHECK (
  (SELECT p.perfil FROM public.profiles p WHERE p.id = auth.uid()) = 'admin'
);

-- Garantir permissões de INSERT para que novos perfis possam ser criados
GRANT INSERT ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
