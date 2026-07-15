-- Módulo Documentos: registro de documentos do cliente com controle de vencimento
-- (alvará, licença, controle de pragas, laudos, ASO, etc). Segue o mesmo padrão
-- de multi-tenant + RLS já usado em visitas/cliente_interacoes.
CREATE TABLE public.documentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id),
    cliente_id UUID NOT NULL REFERENCES public.clientes(id),
    tipo TEXT NOT NULL,
    numero TEXT,
    orgao_emissor TEXT,
    data_emissao DATE,
    data_vencimento DATE,
    observacoes TEXT,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX documentos_cliente_id_idx ON public.documentos(cliente_id);
CREATE INDEX documentos_vencimento_idx ON public.documentos(data_vencimento);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documentos TO authenticated;
GRANT ALL ON public.documentos TO service_role;

ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_documentos_updated_at
    BEFORE UPDATE ON public.documentos
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE POLICY "documentos_admin" ON public.documentos
  FOR ALL USING (
    public.is_super_admin()
    OR (
      empresa_id = public.get_minha_empresa()
      AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil = 'admin')
    )
  );

CREATE POLICY "documentos_consultor" ON public.documentos
  FOR ALL USING (
    empresa_id = public.get_minha_empresa()
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil = 'consultor')
  );
