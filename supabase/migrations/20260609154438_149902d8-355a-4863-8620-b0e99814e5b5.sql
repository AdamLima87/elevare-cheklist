-- Drop the existing admin policy if it exists and recreate it to ensure it covers SELECT
-- The previous policy 'Admins can manage all inspecoes' was already 'ALL', 
-- but let's make sure it's working correctly and checking the profile correctly.

DROP POLICY IF EXISTS "Admins can manage all inspecoes" ON public.inspecoes;

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
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() 
    AND p.perfil = 'admin'
    AND p.ativo = true
  )
);
