-- CRM Comercial — Buscar Leads (Google Places). Infra de banco: cota,
-- credencial BYO, histórico de importação e rate limit de busca. Nenhuma
-- linha de negócio aqui ainda (RPCs de resolução de limite/importação
-- ficam na migration seguinte) — só schema + RLS.

-- Config por tenant: só o contador do trial (limite total, nunca reseta).
-- O limite mensal do plano pago vive em crm_leads_usage (linha por período),
-- não aqui, porque "mês" precisa de várias linhas ao longo do tempo.
CREATE TABLE public.crm_leads_config (
  empresa_id uuid PRIMARY KEY REFERENCES public.empresas(id),
  trial_leads_usados int NOT NULL DEFAULT 0,
  trial_leads_limite int NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER update_crm_leads_config_updated_at
  BEFORE UPDATE ON public.crm_leads_config
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- SELECT liberado pra admin/consultor (mostrar contador na UI). Nenhum
-- INSERT/UPDATE/DELETE pra authenticated — o contador só é tocado pela RPC
-- SECURITY DEFINER de importação (crm_importar_lead_google), nunca
-- diretamente pelo client, senão o frontend poderia zerar a própria cota.
GRANT SELECT ON public.crm_leads_config TO authenticated;
GRANT ALL ON public.crm_leads_config TO service_role;
ALTER TABLE public.crm_leads_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY crm_leads_config_select ON public.crm_leads_config
  FOR SELECT USING (
    public.is_super_admin()
    OR (empresa_id = public.get_minha_empresa()
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil IN ('admin', 'consultor')))
  );

-- Cota mensal do plano pago: uma linha por (tenant, período). O período é
-- resolvido pela RPC no momento da importação (mês corrente em
-- America/Sao_Paulo), não calculado aqui.
CREATE TABLE public.crm_leads_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  periodo_inicio date NOT NULL,
  periodo_fim date NOT NULL,
  leads_importados int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, periodo_inicio)
);

CREATE TRIGGER update_crm_leads_usage_updated_at
  BEFORE UPDATE ON public.crm_leads_usage
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

GRANT SELECT ON public.crm_leads_usage TO authenticated;
GRANT ALL ON public.crm_leads_usage TO service_role;
ALTER TABLE public.crm_leads_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY crm_leads_usage_select ON public.crm_leads_usage
  FOR SELECT USING (
    public.is_super_admin()
    OR (empresa_id = public.get_minha_empresa()
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil IN ('admin', 'consultor')))
  );

-- Histórico/auditoria por importação — uma linha por lead efetivamente
-- importado, pra suporte e auditoria (nunca editável, só leitura).
CREATE TABLE public.crm_leads_importacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  crm_empresa_id uuid,
  google_place_id text NOT NULL,
  credencial_origem text NOT NULL CHECK (credencial_origem IN ('rdcheck', 'tenant')),
  importado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_leads_importacoes_crm_empresa_fkey
    FOREIGN KEY (crm_empresa_id, empresa_id) REFERENCES public.crm_empresas (id, empresa_id),
  CONSTRAINT crm_leads_importacoes_importado_por_fkey
    FOREIGN KEY (importado_por, empresa_id) REFERENCES public.profiles (id, empresa_id)
);
CREATE INDEX crm_leads_importacoes_empresa_idx ON public.crm_leads_importacoes (empresa_id, created_at DESC);

GRANT SELECT ON public.crm_leads_importacoes TO authenticated;
GRANT ALL ON public.crm_leads_importacoes TO service_role;
ALTER TABLE public.crm_leads_importacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY crm_leads_importacoes_select ON public.crm_leads_importacoes
  FOR SELECT USING (
    public.is_super_admin()
    OR (empresa_id = public.get_minha_empresa()
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil IN ('admin', 'consultor')))
  );

-- Credencial BYO (chave própria do Google Cloud do cliente). Guarda só
-- ciphertext + iv — a chave em texto puro NUNCA passa pelo Postgres nem
-- pelo frontend. A criptografia/decriptação acontece inteiramente dentro
-- da Edge Function lead-finder, com uma chave mestra que vive só em secret
-- de projeto (Deno.env.get('CRM_LEADS_ENC_KEY')). Por isso ZERO grant pra
-- authenticated: nem SELECT — só service_role (a própria Edge Function)
-- toca esta tabela. O frontend só enxerga o campo `status` através da
-- action get_usage da Edge Function (que faz um SELECT com service_role e
-- devolve só status/último teste, nunca o ciphertext).
CREATE TABLE public.crm_leads_credenciais (
  empresa_id uuid PRIMARY KEY REFERENCES public.empresas(id),
  api_key_ciphertext text NOT NULL,
  api_key_iv text NOT NULL,
  status text NOT NULL DEFAULT 'nao_configurado' CHECK (status IN ('nao_configurado', 'conectado', 'invalido')),
  ultimo_teste_em timestamptz,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER update_crm_leads_credenciais_updated_at
  BEFORE UPDATE ON public.crm_leads_credenciais
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.crm_leads_credenciais ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.crm_leads_credenciais TO service_role;
-- Nenhuma policy: RLS ligado sem nenhuma CREATE POLICY bloqueia
-- authenticated/anon totalmente (default deny). Só service_role (que
-- bypassa RLS por padrão no Postgres) consegue ler/escrever.

-- Rate limit de busca — mesmo formato de public.signup_attempts (tabela +
-- janela de tempo via created_at), só que por tenant em vez de por IP,
-- porque aqui quem abusa é um tenant autenticado, não um IP anônimo.
CREATE TABLE public.crm_leads_busca_tentativas (
  id bigserial PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX crm_leads_busca_tentativas_empresa_idx ON public.crm_leads_busca_tentativas (empresa_id, created_at);

ALTER TABLE public.crm_leads_busca_tentativas ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.crm_leads_busca_tentativas TO service_role;
-- Zero policies: só a Edge Function (service_role) grava/lê, igual
-- signup_attempts — log técnico interno, não dado de produto.

-- Dedup por place_id: mesmo estabelecimento do Google nunca vira 2 Contas
-- nem é cobrado 2x no mesmo tenant. Índice parcial (só quando preenchido)
-- porque Contas criadas por outras origens (CRM manual, migração da
-- Prospecção) não têm google_place_id.
ALTER TABLE public.crm_empresas ADD COLUMN google_place_id text;
CREATE UNIQUE INDEX crm_empresas_empresa_google_place_unique
  ON public.crm_empresas (empresa_id, google_place_id) WHERE google_place_id IS NOT NULL;
