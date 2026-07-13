-- Fase 2.5: tabela clientes
CREATE TABLE public.clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id),
    nome TEXT NOT NULL,
    cnpj TEXT,
    categoria TEXT,
    foto_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated;
GRANT ALL ON public.clientes TO service_role;

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_clientes_updated_at
    BEFORE UPDATE ON public.clientes
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE POLICY "Admins can manage clientes" ON public.clientes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND perfil = 'admin'
        )
    );

CREATE POLICY "Consultores can manage clientes" ON public.clientes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND perfil = 'consultor'
        )
    );
