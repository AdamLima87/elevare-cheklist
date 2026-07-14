-- Fase 5.3: agenda de visitas
CREATE TABLE public.visitas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id),
    cliente_id UUID NOT NULL REFERENCES public.clientes(id),
    consultor_id UUID REFERENCES public.profiles(id),
    data_hora TIMESTAMP WITH TIME ZONE NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'inspecao',
    status TEXT NOT NULL DEFAULT 'agendada',
    observacoes TEXT,
    inspecao_id UUID REFERENCES public.inspecoes(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.visitas TO authenticated;
GRANT ALL ON public.visitas TO service_role;

ALTER TABLE public.visitas ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_visitas_updated_at
    BEFORE UPDATE ON public.visitas
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE POLICY "visitas_admin" ON public.visitas
  FOR ALL USING (
    public.is_super_admin()
    OR (
      empresa_id = public.get_minha_empresa()
      AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil = 'admin')
    )
  );

CREATE POLICY "visitas_consultor" ON public.visitas
  FOR ALL USING (
    empresa_id = public.get_minha_empresa()
    AND (
      consultor_id = auth.uid()
      OR consultor_id IS NULL
    )
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil = 'consultor')
  );
