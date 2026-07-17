-- Achado de auditoria: get_minha_empresa() e is_super_admin() (usados por
-- praticamente toda policy RLS de negócio) hoje não checam profiles.ativo.
-- Um usuário desativado (profiles.ativo = false) com um JWT ainda não
-- expirado continua passando pela RLS via chamada direta à API — só o
-- ProtectedRoute do front bloqueia, e só após recarregar a página. Isso é
-- uma lacuna real de defesa em profundidade.

-- Normaliza a coluna primeiro: NULL não deve significar "provavelmente
-- ativo" numa regra de autorização — vira estado explícito.
UPDATE public.profiles SET ativo = true WHERE ativo IS NULL;
ALTER TABLE public.profiles ALTER COLUMN ativo SET DEFAULT true;
ALTER TABLE public.profiles ALTER COLUMN ativo SET NOT NULL;

CREATE OR REPLACE FUNCTION public.get_minha_empresa()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT empresa_id FROM public.profiles WHERE id = auth.uid() AND ativo = true
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND perfil = 'super_admin' AND ativo = true
  )
$$;
