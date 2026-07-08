CREATE TABLE public.configuracoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_empresa TEXT NOT NULL DEFAULT 'Elevare Consultoria',
    email_contato TEXT NOT NULL DEFAULT 'contato@elevare.com.br',
    telefone TEXT,
    site TEXT,
    enviar_email_cliente BOOLEAN DEFAULT true,
    notificar_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.configuracoes TO authenticated;
GRANT ALL ON public.configuracoes TO service_role;

-- Enable RLS
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage settings" ON public.configuracoes 
    FOR ALL 
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil = 'admin'));

-- Insert default values if empty
INSERT INTO public.configuracoes (nome_empresa, email_contato)
VALUES ('Elevare Consultoria', 'contato@elevare.com.br');

-- Function to update updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_configuracoes_updated_at
    BEFORE UPDATE ON public.configuracoes
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();