-- CRM Comercial — "Conta" (entidade central do módulo comercial).
--
-- NUNCA confundir com:
--   - public.empresas: o tenant raiz multi-tenant (empresa_id nesta tabela
--     aponta para lá, como em toda outra tabela do sistema).
--   - public.clientes: a entidade OPERACIONAL (inspeções, documentos,
--     agenda). crm_empresas é desacoplada de clientes por decisão de
--     produto — o CRM nunca lê/escreve clientes diretamente, exceto pela
--     ponte explícita de conversão (crm_converter_oportunidade_ganha,
--     Etapa 7), que preenche cliente_id abaixo.
-- Rótulo de UI: "Conta" (nunca "Empresa" sozinho), para eliminar qualquer
-- ambiguidade com os dois conceitos acima.
CREATE TABLE public.crm_empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),

  razao_social text NOT NULL,
  nome_fantasia text,
  cnpj text,                 -- opcional; único por tenant quando informado (índice abaixo)
  segmento text,
  cidade text,
  estado text,
  site text,
  whatsapp text,
  instagram text,
  numero_unidades int,
  observacoes text,
  origem_id uuid,
  responsavel_id uuid NOT NULL,  -- "nunca sem dono" — obrigatório desde a criação
  status text NOT NULL DEFAULT 'lead' CHECK (status IN ('lead', 'prospect', 'ativa', 'inativa')),
  tags text[] NOT NULL DEFAULT '{}',  -- stub para busca global (Etapa 6); sem UI de gestão ainda

  cliente_id uuid,  -- preenchido só pela ponte de conversão (Etapa 7); NULL até então

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT crm_empresas_origem_fkey
    FOREIGN KEY (origem_id, empresa_id) REFERENCES public.crm_origens_lead (id, empresa_id),
  CONSTRAINT crm_empresas_responsavel_fkey
    FOREIGN KEY (responsavel_id, empresa_id) REFERENCES public.profiles (id, empresa_id),
  CONSTRAINT crm_empresas_cliente_fkey
    FOREIGN KEY (cliente_id, empresa_id) REFERENCES public.clientes (id, empresa_id)
);

ALTER TABLE public.crm_empresas ADD CONSTRAINT crm_empresas_id_empresa_unique UNIQUE (id, empresa_id);

-- Normaliza CNPJ pra dígitos antes de gravar, para que formatações
-- diferentes (com/sem pontuação) não burlem a unicidade abaixo.
CREATE OR REPLACE FUNCTION public.crm_normalizar_cnpj()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.cnpj IS NOT NULL THEN
    NEW.cnpj := NULLIF(regexp_replace(NEW.cnpj, '\D', '', 'g'), '');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER crm_empresas_normalizar_cnpj
  BEFORE INSERT OR UPDATE ON public.crm_empresas
  FOR EACH ROW EXECUTE FUNCTION public.crm_normalizar_cnpj();

-- Único por tenant quando informado; múltiplas Contas sem CNPJ nunca colidem.
CREATE UNIQUE INDEX crm_empresas_empresa_cnpj_unique
  ON public.crm_empresas (empresa_id, cnpj) WHERE cnpj IS NOT NULL;

CREATE INDEX crm_empresas_empresa_status_idx ON public.crm_empresas (empresa_id, status);
CREATE INDEX crm_empresas_empresa_responsavel_idx ON public.crm_empresas (empresa_id, responsavel_id);
CREATE INDEX crm_empresas_tags_idx ON public.crm_empresas USING gin (tags);

CREATE TRIGGER update_crm_empresas_updated_at
  BEFORE UPDATE ON public.crm_empresas
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_empresas TO authenticated;
GRANT ALL ON public.crm_empresas TO service_role;
ALTER TABLE public.crm_empresas ENABLE ROW LEVEL SECURITY;

CREATE POLICY crm_empresas_admin ON public.crm_empresas
  FOR ALL USING (
    public.is_super_admin()
    OR (empresa_id = public.get_minha_empresa()
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil = 'admin'))
  );
CREATE POLICY crm_empresas_consultor ON public.crm_empresas
  FOR ALL USING (
    empresa_id = public.get_minha_empresa()
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil = 'consultor')
  );
