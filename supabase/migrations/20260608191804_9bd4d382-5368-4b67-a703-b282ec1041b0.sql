-- Função para promover o primeiro usuário cadastrado a Admin, caso não existam admins
CREATE OR REPLACE FUNCTION public.promote_first_user_to_admin()
RETURNS TRIGGER AS $$
BEGIN
    -- Se for o primeiro perfil sendo criado, define como admin
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE perfil = 'admin') THEN
        NEW.perfil := 'admin';
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql' SET search_path = public;

-- Trigger para aplicar a promoção antes de inserir no profiles
DROP TRIGGER IF EXISTS tr_promote_first_user ON public.profiles;
CREATE TRIGGER tr_promote_first_user
    BEFORE INSERT ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.promote_first_user_to_admin();
