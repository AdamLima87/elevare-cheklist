CREATE TABLE IF NOT EXISTS public.numeracao_inspecoes (
    id BIGINT PRIMARY KEY DEFAULT 1,
    ultimo_numero INT DEFAULT 0,
    numeros_disponiveis INT[] DEFAULT '{}'
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.numeracao_inspecoes TO authenticated;
GRANT ALL ON public.numeracao_inspecoes TO service_role;

-- Initialize the numbering table if it doesn't exist
INSERT INTO public.numeracao_inspecoes (id, ultimo_numero, numeros_disponiveis)
VALUES (1, (SELECT COALESCE(MAX(numero), 0) FROM public.inspecoes), '{}')
ON CONFLICT (id) DO UPDATE SET 
    ultimo_numero = GREATEST(public.numeracao_inspecoes.ultimo_numero, (SELECT COALESCE(MAX(numero), 0) FROM public.inspecoes));

ALTER TABLE public.numeracao_inspecoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON public.numeracao_inspecoes
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
