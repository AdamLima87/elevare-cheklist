-- Fase A do módulo comercial — Representante legal de uma Conta (pessoa que
-- assina um contrato em nome da CONTRATANTE quando ela é pessoa jurídica).
-- Tabela separada de crm_contatos de propósito: contato é "alguém pra
-- falar durante a negociação", representante é "alguém com poder pra
-- assinar juridicamente" (CPF/RG, cargo, flag de principal) — conceitos
-- diferentes, mesmo que às vezes seja a mesma pessoa na prática.
--
-- ativo=false é soft-remove (nunca DELETE): contratos já gerados guardam
-- snapshot próprio dos dados do representante usado na hora (Fase D), mas
-- o histórico de "quem já foi representante desta Conta" fica preservado
-- aqui mesmo depois de a pessoa sair/mudar de cargo.
CREATE TABLE public.crm_representantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  crm_empresa_id uuid NOT NULL,

  nome_completo text NOT NULL,
  cpf text,
  rg text,
  cargo text,
  email text,
  telefone text,
  principal boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT crm_representantes_crm_empresa_fkey
    FOREIGN KEY (crm_empresa_id, empresa_id) REFERENCES public.crm_empresas (id, empresa_id)
);

ALTER TABLE public.crm_representantes ADD CONSTRAINT crm_representantes_id_empresa_unique UNIQUE (id, empresa_id);

-- Normaliza CPF (mesma função criada em 20260813150000, reaproveitada aqui).
CREATE TRIGGER crm_representantes_normalizar_cpf
  BEFORE INSERT OR UPDATE ON public.crm_representantes
  FOR EACH ROW EXECUTE FUNCTION public.crm_normalizar_cpf();

-- Nunca mais de 1 representante principal ativo por Conta ao mesmo tempo —
-- defesa estrutural, além de qualquer checagem feita no client/RPC.
CREATE UNIQUE INDEX crm_representantes_uma_principal_idx
  ON public.crm_representantes (crm_empresa_id) WHERE principal AND ativo;

CREATE INDEX crm_representantes_empresa_crm_empresa_idx ON public.crm_representantes (empresa_id, crm_empresa_id);

CREATE TRIGGER update_crm_representantes_updated_at
  BEFORE UPDATE ON public.crm_representantes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_representantes TO authenticated;
GRANT ALL ON public.crm_representantes TO service_role;
ALTER TABLE public.crm_representantes ENABLE ROW LEVEL SECURITY;

-- Mesmo padrão de crm_contatos: admin e consultor do tenant podem
-- ler/escrever livremente (não é um recurso restrito a admin).
CREATE POLICY crm_representantes_admin ON public.crm_representantes
  FOR ALL USING (
    public.is_super_admin()
    OR (empresa_id = public.get_minha_empresa()
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil = 'admin'))
  );
CREATE POLICY crm_representantes_consultor ON public.crm_representantes
  FOR ALL USING (
    empresa_id = public.get_minha_empresa()
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil = 'consultor')
  );
