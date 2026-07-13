-- Fase 2.1: tabela empresas (multi-tenant) + seed da Elevare
CREATE TABLE public.empresas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    cnpj TEXT,
    plano TEXT NOT NULL DEFAULT 'trial',
    status TEXT NOT NULL DEFAULT 'ativo',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.empresas TO authenticated;
GRANT ALL ON public.empresas TO service_role;

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_empresas_updated_at
    BEFORE UPDATE ON public.empresas
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

INSERT INTO public.empresas (nome, status, plano)
VALUES ('Elevare Consultoria', 'ativo', 'pro');
