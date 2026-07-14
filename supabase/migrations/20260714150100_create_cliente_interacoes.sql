-- Fase 5.2: timeline de interacoes do CRM (notas, ligacoes, mudancas de etapa)
CREATE TABLE public.cliente_interacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id),
    cliente_id UUID NOT NULL REFERENCES public.clientes(id),
    autor_id UUID REFERENCES public.profiles(id),
    tipo TEXT NOT NULL DEFAULT 'nota',
    texto TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.cliente_interacoes TO authenticated;
GRANT ALL ON public.cliente_interacoes TO service_role;

ALTER TABLE public.cliente_interacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cliente_interacoes_select" ON public.cliente_interacoes
  FOR SELECT USING (
    public.is_super_admin()
    OR empresa_id = public.get_minha_empresa()
  );

CREATE POLICY "cliente_interacoes_insert" ON public.cliente_interacoes
  FOR INSERT WITH CHECK (
    empresa_id = public.get_minha_empresa()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND perfil IN ('admin', 'consultor')
    )
  );
