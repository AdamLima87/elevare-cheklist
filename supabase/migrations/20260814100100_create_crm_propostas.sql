-- Fase B do módulo comercial — Propostas comerciais versionadas. Depois de
-- gerada/enviada, uma revisão nunca é editada in-place: renegociação cria
-- uma revisão nova (grupo_proposta_id constante, numero_revisao+1,
-- revisao_anterior_id apontando pra trás), e a revisão antiga vira
-- 'substituida' — nunca 'recusada'/'cancelada' (o negócio seguiu adiante, só
-- não com aquela versão). Uma revisão 'aceita' encerra o grupo pra sempre:
-- renegociação pós-aceite é uma PROPOSTA NOVA (grupo_proposta_id novo, via
-- nova chamada de crm_obter_ou_criar_proposta), preservando intacto o
-- histórico da proposta aceita. Sem policy de INSERT/UPDATE/DELETE pra
-- authenticated — toda mutação passa pelas RPCs abaixo (SECURITY DEFINER,
-- mesmo padrão de reinspecao_programacoes).
CREATE TABLE public.crm_propostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  crm_oportunidade_id uuid NOT NULL,
  crm_empresa_id uuid NOT NULL,

  grupo_proposta_id uuid NOT NULL,
  numero_revisao int NOT NULL DEFAULT 1,
  revisao_anterior_id uuid,

  status text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho', 'gerada', 'enviada', 'aceita', 'recusada', 'substituida', 'cancelada')),
  valor_total numeric(12,2) NOT NULL DEFAULT 0,

  gerada_em timestamptz,
  enviada_em timestamptz,
  aceite_em timestamptz,
  aceite_por uuid,
  aceite_forma text CHECK (aceite_forma IN ('email', 'whatsapp', 'assinatura_da_proposta', 'verbal_registrado', 'outro')),
  aceite_observacao text,
  aceite_evidencia_path text,

  recusada_em timestamptz,
  recusada_motivo text,
  cancelada_em timestamptz,
  cancelada_motivo text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT crm_propostas_oportunidade_fkey
    FOREIGN KEY (crm_oportunidade_id, empresa_id) REFERENCES public.crm_oportunidades (id, empresa_id),
  CONSTRAINT crm_propostas_crm_empresa_fkey
    FOREIGN KEY (crm_empresa_id, empresa_id) REFERENCES public.crm_empresas (id, empresa_id),
  CONSTRAINT crm_propostas_aceite_por_fkey
    FOREIGN KEY (aceite_por, empresa_id) REFERENCES public.profiles (id, empresa_id)
);
ALTER TABLE public.crm_propostas ADD CONSTRAINT crm_propostas_id_empresa_unique UNIQUE (id, empresa_id);
ALTER TABLE public.crm_propostas ADD CONSTRAINT crm_propostas_revisao_anterior_fkey
  FOREIGN KEY (revisao_anterior_id, empresa_id) REFERENCES public.crm_propostas (id, empresa_id);

-- Só 1 revisão não-terminal (rascunho/gerada/enviada) por grupo, de cada vez.
CREATE UNIQUE INDEX crm_propostas_grupo_ativo_idx
  ON public.crm_propostas (grupo_proposta_id)
  WHERE status IN ('rascunho', 'gerada', 'enviada');

CREATE INDEX crm_propostas_oportunidade_idx ON public.crm_propostas (crm_oportunidade_id);
CREATE INDEX crm_propostas_grupo_idx ON public.crm_propostas (grupo_proposta_id);

CREATE TRIGGER update_crm_propostas_updated_at
  BEFORE UPDATE ON public.crm_propostas
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

GRANT SELECT ON public.crm_propostas TO authenticated;
GRANT ALL ON public.crm_propostas TO service_role;
ALTER TABLE public.crm_propostas ENABLE ROW LEVEL SECURITY;

CREATE POLICY crm_propostas_select ON public.crm_propostas
  FOR SELECT USING (
    public.is_super_admin()
    OR (empresa_id = public.get_minha_empresa()
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil IN ('admin', 'consultor')))
  );

-- Itens de uma revisão específica de proposta (nunca do grupo). Copiados do
-- catálogo no momento de adicionar (nome/descricao/valor), editáveis dali em
-- diante — não é um FK "vivo": editar o catálogo depois não altera propostas
-- já montadas. servico_catalogo_id nullable permite item avulso fora do
-- catálogo.
CREATE TABLE public.crm_proposta_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  proposta_id uuid NOT NULL,
  servico_catalogo_id uuid,
  nome text NOT NULL,
  descricao text,
  valor numeric(12,2) NOT NULL DEFAULT 0,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT crm_proposta_itens_proposta_fkey
    FOREIGN KEY (proposta_id, empresa_id) REFERENCES public.crm_propostas (id, empresa_id),
  CONSTRAINT crm_proposta_itens_servico_fkey
    FOREIGN KEY (servico_catalogo_id, empresa_id) REFERENCES public.crm_servicos_catalogo (id, empresa_id)
);

CREATE INDEX crm_proposta_itens_proposta_idx ON public.crm_proposta_itens (proposta_id);

GRANT SELECT ON public.crm_proposta_itens TO authenticated;
GRANT ALL ON public.crm_proposta_itens TO service_role;
ALTER TABLE public.crm_proposta_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY crm_proposta_itens_select ON public.crm_proposta_itens
  FOR SELECT USING (
    public.is_super_admin()
    OR (empresa_id = public.get_minha_empresa()
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil IN ('admin', 'consultor')))
  );
