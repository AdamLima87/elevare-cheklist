-- Remove the overly permissive self-update policy
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Recreate it with a WITH CHECK that prevents users from elevating their role
-- or reactivating themselves. Admins still have full control via the admin policy.
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND perfil = (SELECT perfil FROM public.profiles WHERE id = auth.uid())
  AND ativo = (SELECT ativo FROM public.profiles WHERE id = auth.uid())
);