-- Fase 3.1: helper functions para RLS multi-tenant + perfil super_admin

CREATE OR REPLACE FUNCTION public.get_minha_empresa()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND perfil = 'super_admin'
  )
$$;

ALTER TABLE public.profiles DROP CONSTRAINT profiles_perfil_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_perfil_check
  CHECK (perfil = ANY (ARRAY['admin', 'consultor', 'cliente', 'super_admin']));
