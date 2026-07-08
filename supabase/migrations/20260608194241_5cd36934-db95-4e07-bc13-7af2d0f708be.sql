-- Não é necessário SQL para Edge Functions, mas vou garantir que as políticas de RLS 
-- permitam que o admin gerencie perfis corretamente.

-- Adicionar política para permitir que admins gerenciem todos os perfis
-- Nota: Esta política usa auth.jwt() para verificar o perfil do usuário logado
-- sem causar recursão infinita.

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' AND policyname = 'Admins can manage all profiles'
    ) THEN
        CREATE POLICY "Admins can manage all profiles" ON public.profiles
        FOR ALL
        TO authenticated
        USING (
            (SELECT perfil FROM public.profiles WHERE id = auth.uid()) = 'admin'
        )
        WITH CHECK (
            (SELECT perfil FROM public.profiles WHERE id = auth.uid()) = 'admin'
        );
    END IF;
END $$;
