ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN DEFAULT FALSE;

-- Update existing consultants to force password change if they haven't yet (optional logic)
-- UPDATE public.profiles SET force_password_change = TRUE WHERE perfil = 'consultor';
