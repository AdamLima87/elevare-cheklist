-- Drop existing table if it exists to recreate with correct schema
DROP TABLE IF EXISTS public.inspecoes;

-- Create profiles table
CREATE TABLE public.profiles (
    id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    nome TEXT NOT NULL,
    perfil TEXT NOT NULL CHECK (perfil IN ('admin', 'consultor', 'cliente')),
    cnpj TEXT, -- Apenas para perfil cliente
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Grant access to profiles
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND perfil = 'admin'
        )
    );

CREATE POLICY "Admins can manage profiles" ON public.profiles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND perfil = 'admin'
        )
    );

-- Create inspecoes table with updated schema
CREATE TABLE public.inspecoes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    numero INTEGER NOT NULL,
    consultor_id UUID REFERENCES auth.users(id),
    estabelecimento_nome TEXT,
    cnpj TEXT, -- CNPJ do estabelecimento para vínculo com cliente
    status TEXT NOT NULL DEFAULT 'em_andamento',
    progresso INTEGER NOT NULL DEFAULT 0,
    conformidade NUMERIC,
    dados JSONB NOT NULL DEFAULT '{}'::jsonb,
    respostas JSONB NOT NULL DEFAULT '{}'::jsonb,
    data_inicio TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    data_conclusao TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Grant access to inspecoes
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inspecoes TO authenticated;
GRANT ALL ON public.inspecoes TO service_role;

-- Enable RLS on inspecoes
ALTER TABLE public.inspecoes ENABLE ROW LEVEL SECURITY;

-- Policies for inspecoes
CREATE POLICY "Admins can manage all inspecoes" ON public.inspecoes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND perfil = 'admin'
        )
    );

CREATE POLICY "Consultores can manage their own inspecoes" ON public.inspecoes
    FOR ALL USING (
        consultor_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND perfil = 'consultor'
        )
    );

CREATE POLICY "Clientes can view their own inspecoes" ON public.inspecoes
    FOR SELECT USING (
        status = 'concluida' AND
        cnpj = (SELECT cnpj FROM public.profiles WHERE id = auth.uid()) AND
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND perfil = 'cliente'
        )
    );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_inspecoes_updated_at BEFORE UPDATE ON public.inspecoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, nome, perfil, ativo)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email), 'consultor', true);
    RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Trigger for new user signup (Optional: defaults to consultor)
-- CREATE TRIGGER on_auth_user_created
--     AFTER INSERT ON auth.users
--     FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
