-- Automação de contratação/pagamentos (Asaas) — Fase 1: schema e domínio.
-- Só schema nesta migration: nenhuma lógica de negócio existente é alterada
-- (public-signup, provision_tenant, ProtectedRoute, crm_leads_resolver_limite
-- continuam exatamente como estão). RLS e grants seguem o padrão mais
-- restritivo já usado em audit_log/signup_attempts: zero grant de escrita
-- pra authenticated — toda mutação passa por service_role (Edge Functions)
-- ou RPC SECURITY DEFINER (fases seguintes), nunca pelo client direto.

-- Intenção de checkout: existe só pra mensal/anual, criada depois da
-- confirmação de e-mail e antes do pagamento. Trial não passa por aqui —
-- provisiona direto (mesmo comportamento de hoje). auth_user_id é sempre
-- conhecido (usuário já confirmou e-mail); empresa ainda não existe.
CREATE TABLE public.saas_checkout_intencoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  plano_codigo text NOT NULL REFERENCES public.saas_planos(codigo),
  periodicidade text NOT NULL CHECK (periodicidade IN ('mensal', 'anual')),
  parcelas int NOT NULL DEFAULT 1 CHECK (parcelas BETWEEN 1 AND 10),
  cupom_codigo text,
  provider text NOT NULL DEFAULT 'asaas',
  provider_customer_id text,
  provider_checkout_id text,
  checkout_url text,
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'aguardando_pagamento', 'pago', 'expirado', 'cancelado')),
  origem jsonb NOT NULL DEFAULT '{}',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '2 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- No máximo uma intenção "aberta" por usuário+plano+periodicidade — é o
-- mecanismo de "retomar checkout pendente" e evita duplicidade por clique
-- repetido: a Fase 2 sempre busca essa linha antes de criar uma nova.
CREATE UNIQUE INDEX saas_checkout_intencoes_aberta_idx
  ON public.saas_checkout_intencoes (auth_user_id, plano_codigo, periodicidade)
  WHERE status IN ('pendente', 'aguardando_pagamento');
CREATE INDEX saas_checkout_intencoes_status_expires_idx
  ON public.saas_checkout_intencoes (status, expires_at);

CREATE TRIGGER update_saas_checkout_intencoes_updated_at
  BEFORE UPDATE ON public.saas_checkout_intencoes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Assinatura local — nunca controlar acesso só por empresas.plano. Pra
-- trial, empresa_id/owner_id já existem no provisionamento (igual hoje);
-- pra mensal/anual, ambos ficam NULL até o webhook confirmar o pagamento
-- e o tenant ser provisionado (Fase 4).
CREATE TABLE public.saas_assinaturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  checkout_intencao_id uuid REFERENCES public.saas_checkout_intencoes(id) ON DELETE SET NULL,
  plano_codigo text NOT NULL REFERENCES public.saas_planos(codigo),
  periodicidade text CHECK (periodicidade IN ('mensal', 'anual')),
  provider text NOT NULL DEFAULT 'asaas',
  provider_customer_id text,
  provider_subscription_id text,
  status text NOT NULL
    CHECK (status IN ('trialing', 'pending', 'active', 'past_due', 'blocked', 'canceled', 'expired')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  canceled_at timestamptz,
  past_due_since timestamptz,
  blocked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- No máximo uma assinatura "viva" por empresa; cancelada/expirada não
-- concorre (permite re-assinar depois de cancelar sem violar a unique).
CREATE UNIQUE INDEX saas_assinaturas_ativa_por_empresa_idx
  ON public.saas_assinaturas (empresa_id)
  WHERE status IN ('trialing', 'pending', 'active', 'past_due', 'blocked');
CREATE INDEX saas_assinaturas_owner_idx ON public.saas_assinaturas (owner_id);
CREATE INDEX saas_assinaturas_status_idx ON public.saas_assinaturas (status);

CREATE TRIGGER update_saas_assinaturas_updated_at
  BEFORE UPDATE ON public.saas_assinaturas
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Pagamento local — um registro por cobrança Asaas (parcela individual,
-- inclusive). provider_payment_id é a chave de idempotência: o webhook
-- sempre faz upsert por ela, nunca insert cego.
CREATE TABLE public.saas_pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  assinatura_id uuid REFERENCES public.saas_assinaturas(id) ON DELETE SET NULL,
  checkout_intencao_id uuid REFERENCES public.saas_checkout_intencoes(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'asaas',
  provider_payment_id text,
  provider_installment_id text,
  valor_base numeric NOT NULL,
  valor_cobrado numeric NOT NULL,
  desconto_aplicado numeric NOT NULL DEFAULT 0,
  forma_pagamento text,
  parcelas int NOT NULL DEFAULT 1,
  parcela_numero int,
  vencimento date,
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'confirmado', 'recebido', 'atrasado', 'recusado', 'estornado', 'cancelado', 'chargeback')),
  paid_at timestamptz,
  invoice_url text,
  checkout_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX saas_pagamentos_provider_payment_idx
  ON public.saas_pagamentos (provider, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;
CREATE INDEX saas_pagamentos_empresa_idx ON public.saas_pagamentos (empresa_id, created_at);
CREATE INDEX saas_pagamentos_assinatura_idx ON public.saas_pagamentos (assinatura_id);
CREATE INDEX saas_pagamentos_status_idx ON public.saas_pagamentos (status);

CREATE TRIGGER update_saas_pagamentos_updated_at
  BEFORE UPDATE ON public.saas_pagamentos
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Log de eventos de webhook — fonte de verdade financeira e mecanismo de
-- idempotência/reprocessamento. payload_hash é o guard contra reentrega
-- exata (Asaas reenvia o mesmo payload em retry, não um novo snapshot);
-- a idempotência do ESTADO em si vem do upsert por provider_payment_id
-- em saas_pagamentos, não só desta tabela — mesmo que um evento aqui
-- escape do dedup, o upsert de pagamento continua seguro.
CREATE TABLE public.saas_webhook_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'asaas',
  provider_event_id text,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  payload_hash text NOT NULL,
  status text NOT NULL DEFAULT 'recebido'
    CHECK (status IN ('recebido', 'processado', 'erro', 'ignorado')),
  processed_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX saas_webhook_eventos_payload_hash_idx ON public.saas_webhook_eventos (payload_hash);
CREATE INDEX saas_webhook_eventos_status_idx ON public.saas_webhook_eventos (status, created_at);
CREATE INDEX saas_webhook_eventos_event_type_idx ON public.saas_webhook_eventos (event_type, created_at);

-- Cupons — catálogo administrado só pela Plataforma (adendo do prompt).
CREATE TABLE public.saas_cupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  descricao text,
  tipo_desconto text NOT NULL CHECK (tipo_desconto IN ('percentual', 'valor_fixo', 'primeiro_periodo_gratis')),
  valor numeric NOT NULL DEFAULT 0,
  plano_codigo text REFERENCES public.saas_planos(codigo),
  periodicidade text CHECK (periodicidade IN ('mensal', 'anual')),
  data_inicio timestamptz NOT NULL DEFAULT now(),
  data_fim timestamptz,
  max_utilizacoes int,
  utilizacoes_atual int NOT NULL DEFAULT 0,
  max_utilizacoes_por_empresa int NOT NULL DEFAULT 1,
  somente_novos_clientes boolean NOT NULL DEFAULT true,
  ativo boolean NOT NULL DEFAULT true,
  criado_por uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER update_saas_cupons_updated_at
  BEFORE UPDATE ON public.saas_cupons
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Utilização de cupom — reserva no início do checkout, confirma só no
-- pagamento. checkout_intencao_id nullable + ON DELETE SET NULL (não
-- CASCADE): mesmo que a intenção seja limpa algum dia, o registro de uso
-- confirmado de um cupom é histórico financeiro e não pode desaparecer.
CREATE TABLE public.saas_cupom_utilizacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cupom_id uuid NOT NULL REFERENCES public.saas_cupons(id) ON DELETE CASCADE,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  checkout_intencao_id uuid REFERENCES public.saas_checkout_intencoes(id) ON DELETE SET NULL,
  assinatura_id uuid REFERENCES public.saas_assinaturas(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'reservado'
    CHECK (status IN ('reservado', 'confirmado', 'expirado', 'cancelado')),
  desconto_aplicado numeric,
  reserved_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '2 days')
);

-- Uma reserva por cupom+intenção — reaplicar o mesmo cupom na mesma
-- tentativa de checkout é idempotente (upsert), nunca duplica.
CREATE UNIQUE INDEX saas_cupom_utilizacoes_intencao_idx
  ON public.saas_cupom_utilizacoes (cupom_id, checkout_intencao_id)
  WHERE checkout_intencao_id IS NOT NULL;
CREATE INDEX saas_cupom_utilizacoes_cupom_idx ON public.saas_cupom_utilizacoes (cupom_id, status);
CREATE INDEX saas_cupom_utilizacoes_empresa_idx ON public.saas_cupom_utilizacoes (empresa_id);

-- RLS: mesmo padrão restritivo de audit_log — zero policy de
-- INSERT/UPDATE/DELETE pra authenticated/anon em nenhuma das 6 tabelas.
-- Toda escrita é service_role (Edge Functions) ou RPC SECURITY DEFINER
-- (fases seguintes). SELECT é a única superfície liberada, e só onde faz
-- sentido pro dono do recurso ou pro super_admin.
ALTER TABLE public.saas_checkout_intencoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_assinaturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_pagamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_webhook_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_cupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_cupom_utilizacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY saas_checkout_intencoes_select ON public.saas_checkout_intencoes
  FOR SELECT USING (auth_user_id = auth.uid() OR public.is_super_admin());

CREATE POLICY saas_assinaturas_select ON public.saas_assinaturas
  FOR SELECT USING (
    public.is_super_admin()
    OR (empresa_id = public.get_minha_empresa() AND EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil = 'admin'
    ))
  );

CREATE POLICY saas_pagamentos_select ON public.saas_pagamentos
  FOR SELECT USING (
    public.is_super_admin()
    OR (empresa_id = public.get_minha_empresa() AND EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil = 'admin'
    ))
  );

CREATE POLICY saas_webhook_eventos_select ON public.saas_webhook_eventos
  FOR SELECT USING (public.is_super_admin());

CREATE POLICY saas_cupons_select ON public.saas_cupons
  FOR SELECT USING (public.is_super_admin());

CREATE POLICY saas_cupom_utilizacoes_select ON public.saas_cupom_utilizacoes
  FOR SELECT USING (public.is_super_admin());

-- Expiração não-destrutiva de intenções/reservas abandonadas: só marca
-- status, nunca deleta (valor de auditoria/anti-abuso > custo de storage).
-- Reaproveita o mesmo padrão de pg_cron de 20260718110000.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-checkout-intencoes') THEN
      PERFORM cron.unschedule('expire-checkout-intencoes');
    END IF;
    PERFORM cron.schedule(
      'expire-checkout-intencoes',
      '*/15 * * * *',
      $cron$
        UPDATE public.saas_checkout_intencoes
        SET status = 'expirado'
        WHERE status IN ('pendente', 'aguardando_pagamento') AND expires_at < now();

        UPDATE public.saas_cupom_utilizacoes
        SET status = 'expirado'
        WHERE status = 'reservado' AND expires_at < now();
      $cron$
    );
  END IF;
END $$;

-- Verificar após aplicar:
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'expire-checkout-intencoes';
