CREATE TABLE IF NOT EXISTS public.inspecoes (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
    numero INTEGER NOT NULL,
    status TEXT NOT NULL,
    estabelecimento TEXT,
    data_inicio TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    data_conclusao TIMESTAMP WITH TIME ZONE,
    progresso NUMERIC DEFAULT 0,
    conformidade NUMERIC,
    dados JSONB NOT NULL DEFAULT '{}',
    respostas JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Grant access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inspecoes TO authenticated;
GRANT ALL ON public.inspecoes TO service_role;

-- Enable RLS
ALTER TABLE public.inspecoes ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage their own inspections" 
ON public.inspecoes FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Updated at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_inspecoes_updated_at 
BEFORE UPDATE ON public.inspecoes 
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();