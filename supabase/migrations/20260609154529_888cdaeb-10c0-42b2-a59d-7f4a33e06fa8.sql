-- Recria as políticas de RLS para a tabela de inspeções garantindo acesso total ao Admin

DROP POLICY IF EXISTS "Admins can manage all inspecoes" ON public.inspecoes;
DROP POLICY IF EXISTS "Consultores can manage their own inspecoes" ON public.inspecoes;
DROP POLICY IF EXISTS "Clientes can view their own inspecoes" ON public.inspecoes;

-- Política para Administradores (Acesso Total)
CREATE POLICY "Admins can manage all inspecoes" ON public.inspecoes
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() 
    AND p.perfil = 'admin'
    AND p.ativo = true
  )
);

-- Política para Consultores (Apenas as suas próprias)
CREATE POLICY "Consultores can manage their own inspecoes" ON public.inspecoes
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
);

-- Política para Clientes (Apenas inspeções concluídas do seu CNPJ)
CREATE POLICY "Clientes can view their own inspecoes" ON public.inspecoes
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
