-- CRM Comercial — Contatos (pessoas dentro de uma Conta). 1 Conta : N Contatos.
CREATE TABLE public.crm_contatos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  crm_empresa_id uuid NOT NULL,

  nome text NOT NULL,
  cargo text,
  telefone text,
  whatsapp text,
  email text,
  observacoes text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT crm_contatos_crm_empresa_fkey
    FOREIGN KEY (crm_empresa_id, empresa_id) REFERENCES public.crm_empresas (id, empresa_id)
);

CREATE INDEX crm_contatos_empresa_crm_empresa_idx ON public.crm_contatos (empresa_id, crm_empresa_id);
CREATE INDEX crm_contatos_email_idx ON public.crm_contatos (empresa_id, lower(email));

CREATE TRIGGER update_crm_contatos_updated_at
  BEFORE UPDATE ON public.crm_contatos
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_contatos TO authenticated;
GRANT ALL ON public.crm_contatos TO service_role;
ALTER TABLE public.crm_contatos ENABLE ROW LEVEL SECURITY;

CREATE POLICY crm_contatos_admin ON public.crm_contatos
  FOR ALL USING (
    public.is_super_admin()
    OR (empresa_id = public.get_minha_empresa()
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil = 'admin'))
  );
CREATE POLICY crm_contatos_consultor ON public.crm_contatos
  FOR ALL USING (
    empresa_id = public.get_minha_empresa()
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil = 'consultor')
  );
