-- Fase 7.8 — schema de programação de reinspeção. Integridade multiempresa
-- garantida no banco via FK composta (empresa_id, id) contra cada tabela
-- referenciada — mesmo padrão tenant-safe já usado desde
-- 20260718100300_tenant_safe_foreign_keys.sql (clientes) e
-- 20260720100000_profiles_tenant_safe_unique.sql (profiles). inspecoes
-- ganhou o UNIQUE (id, empresa_id) equivalente na migration 20260808100200
-- desta mesma fase.

CREATE TABLE public.reinspecao_programacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  inspecao_origem_id uuid NOT NULL,
  cliente_id uuid,
  responsavel_id uuid,
  inspecao_criada_id uuid,
  data_prevista date NOT NULL,
  observacao text,
  status text NOT NULL DEFAULT 'programada'
    CHECK (status IN ('programada', 'reagendada', 'iniciada', 'realizada', 'cancelada')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (inspecao_origem_id, empresa_id) REFERENCES public.inspecoes (id, empresa_id),
  FOREIGN KEY (cliente_id, empresa_id) REFERENCES public.clientes (id, empresa_id),
  FOREIGN KEY (responsavel_id, empresa_id) REFERENCES public.profiles (id, empresa_id),
  FOREIGN KEY (inspecao_criada_id, empresa_id) REFERENCES public.inspecoes (id, empresa_id)
);
-- Nenhuma FK composta acima é NOT NULL exceto inspecao_origem_id — cliente_id
-- pode ser null (diagnóstico pré-venda sem cliente), responsavel_id pode ser
-- definido só na hora de iniciar, inspecao_criada_id só é preenchida quando
-- a reinspeção é de fato criada (iniciar_reinspecao).

CREATE INDEX reinspecao_programacoes_empresa_idx ON public.reinspecao_programacoes (empresa_id);
CREATE INDEX reinspecao_programacoes_origem_idx ON public.reinspecao_programacoes (inspecao_origem_id);
CREATE INDEX reinspecao_programacoes_responsavel_idx ON public.reinspecao_programacoes (responsavel_id) WHERE responsavel_id IS NOT NULL;
CREATE INDEX reinspecao_programacoes_status_idx ON public.reinspecao_programacoes (empresa_id, status);
-- Uma programação só pode originar UMA reinspeção — reforça no banco o que
-- iniciar_reinspecao() já garante via lock (defesa em profundidade).
CREATE UNIQUE INDEX reinspecao_programacoes_inspecao_criada_unique
  ON public.reinspecao_programacoes (inspecao_criada_id) WHERE inspecao_criada_id IS NOT NULL;

CREATE TABLE public.reinspecao_programacao_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  programacao_id uuid NOT NULL REFERENCES public.reinspecao_programacoes(id),
  evento_tipo text NOT NULL CHECK (evento_tipo IN ('criada', 'reagendada', 'cancelada', 'iniciada', 'realizada')),
  data_anterior date,
  data_nova date,
  observacao text,
  autor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX reinspecao_programacao_eventos_programacao_idx
  ON public.reinspecao_programacao_eventos (programacao_id);

-- RLS — só leitura direta; toda escrita passa pelas RPCs (Fase 7.9), mesmo
-- padrão do crm_timeline com eventos de origem 'sistema'. Nenhuma policy de
-- INSERT/UPDATE/DELETE para `authenticated` é criada — as funções
-- SECURITY DEFINER escrevem independentemente disso.
ALTER TABLE public.reinspecao_programacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reinspecao_programacao_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY reinspecao_programacoes_select_admin ON public.reinspecao_programacoes
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_minha_empresa() AND EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil = 'admin'
  ));

CREATE POLICY reinspecao_programacoes_select_consultor ON public.reinspecao_programacoes
  FOR SELECT TO authenticated
  USING (
    empresa_id = public.get_minha_empresa()
    AND (
      responsavel_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.inspecoes i
        WHERE i.id = inspecao_origem_id AND i.consultor_id = auth.uid()
      )
    )
  );

CREATE POLICY reinspecao_programacoes_select_super_admin ON public.reinspecao_programacoes
  FOR SELECT TO authenticated USING (public.is_super_admin());

CREATE POLICY reinspecao_programacao_eventos_select ON public.reinspecao_programacao_eventos
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.reinspecao_programacoes p WHERE p.id = programacao_id
  ));
-- A subquery acima reaproveita as policies de SELECT já definidas em
-- reinspecao_programacoes (RLS é composável: só enxerga p se a policy da
-- tabela pai já permitir) — não precisa duplicar a lógica de
-- admin/consultor/super_admin aqui.
