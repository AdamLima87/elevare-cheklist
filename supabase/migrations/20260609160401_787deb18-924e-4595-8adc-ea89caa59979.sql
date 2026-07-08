ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS senha_texto TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ultimo_acesso TIMESTAMP WITH TIME ZONE;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;