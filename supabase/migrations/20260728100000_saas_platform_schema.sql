-- Administração da Plataforma (SaaS) — Fase 0: infraestrutura de dados.
-- Separação lógica entre "tenant" (empresa/consultoria, RLS de sempre,
-- empresa_id/get_minha_empresa() intocados) e "plataforma" (o próprio
-- RDCheck como SaaS, só super_admin, sem noção de empresa_id ativo).
--
-- Esta migration só cria schema + seed refletindo o comportamento ATUAL
-- do sistema — nenhuma lógica existente é religada aqui. Ex: os limites
-- de crm_leads_resolver_limite() continuam fixos no código; esta tabela
-- só serve de base pra uma fase futura migrar isso gradualmente.
--
-- RLS: todas as 5 tabelas abaixo só são acessíveis por is_super_admin().
-- Nenhum perfil de tenant (admin/consultor/cliente) enxerga nada aqui,
-- mesmo espírito das tabelas de catálogo internas (crm_motivos_perda
-- etc.), só que restrito à plataforma em vez de por tenant.

-- Catálogo de planos comerciais do RDCheck.
CREATE TABLE public.saas_planos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE, -- mesmo valor usado em empresas.plano ('trial', 'pro', ...)
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER update_saas_planos_updated_at
  BEFORE UPDATE ON public.saas_planos
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Limites por plano — chave/valor livre (limite_key) pra não exigir
-- migration nova toda vez que um módulo precisar de um limite diferente.
CREATE TABLE public.saas_plano_limites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id uuid NOT NULL REFERENCES public.saas_planos(id) ON DELETE CASCADE,
  limite_key text NOT NULL,
  valor numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plano_id, limite_key)
);
CREATE TRIGGER update_saas_plano_limites_updated_at
  BEFORE UPDATE ON public.saas_plano_limites
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Override pontual de um limite pra um tenant específico (ex: suporte
-- estende o limite de leads de um cliente sem mudar o plano dele todo).
-- Tabela de histórico/auditoria própria: não apaga o override anterior,
-- só acumula (a leitura de "override vigente" pega o mais recente).
CREATE TABLE public.saas_empresa_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  limite_key text NOT NULL,
  valor numeric NOT NULL,
  motivo text,
  criado_por uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX saas_empresa_overrides_empresa_idx ON public.saas_empresa_overrides (empresa_id, limite_key, created_at DESC);

-- Catálogo de funcionalidades que podem ser ligadas/desligadas por
-- tenant sem deploy. `ativo_por_padrao` é o valor usado quando o tenant
-- não tem override em saas_empresa_features.
CREATE TABLE public.saas_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE,
  nome text NOT NULL,
  descricao text,
  ativo_por_padrao boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Override de feature por tenant. Ausência de linha aqui = usa
-- saas_features.ativo_por_padrao.
CREATE TABLE public.saas_empresa_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  feature_id uuid NOT NULL REFERENCES public.saas_features(id) ON DELETE CASCADE,
  enabled boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, feature_id)
);
CREATE TRIGGER update_saas_empresa_features_updated_at
  BEFORE UPDATE ON public.saas_empresa_features
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS: só plataforma (is_super_admin()) toca nessas 5 tabelas. Nenhum
-- perfil de tenant tem policy nenhuma aqui.
ALTER TABLE public.saas_planos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_plano_limites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_empresa_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_empresa_features ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saas_planos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saas_plano_limites TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saas_empresa_overrides TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saas_features TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saas_empresa_features TO authenticated;
GRANT ALL ON public.saas_planos, public.saas_plano_limites, public.saas_empresa_overrides,
  public.saas_features, public.saas_empresa_features TO service_role;

CREATE POLICY saas_planos_platform_only ON public.saas_planos
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY saas_plano_limites_platform_only ON public.saas_plano_limites
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY saas_empresa_overrides_platform_only ON public.saas_empresa_overrides
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY saas_features_platform_only ON public.saas_features
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY saas_empresa_features_platform_only ON public.saas_empresa_features
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- Seed: reflete exatamente o comportamento atual do sistema, nada novo
-- é ligado. codigo dos planos usa os mesmos valores já gravados hoje em
-- empresas.plano ('trial' e 'pro').
INSERT INTO public.saas_planos (codigo, nome, ordem) VALUES
  ('trial', 'Trial', 1),
  ('pro', 'Pago', 2);

INSERT INTO public.saas_plano_limites (plano_id, limite_key, valor)
  SELECT id, 'crm_leads_total', 5 FROM public.saas_planos WHERE codigo = 'trial'
  UNION ALL
  SELECT id, 'crm_leads_mensal', 30 FROM public.saas_planos WHERE codigo = 'pro';

-- Features que já existem e funcionam pra todo tenant hoje (sem gating
-- nenhum ainda — ativo_por_padrao=true só documenta o estado atual).
INSERT INTO public.saas_features (chave, nome, descricao, ativo_por_padrao) VALUES
  ('crm_comercial', 'CRM Comercial', 'Contas, Oportunidades, Pipeline, Atividades.', true),
  ('buscar_leads', 'Buscar Leads', 'Prospecção via Google Places dentro do CRM.', true);

-- Catálogo de features planejadas, ainda não construídas — entram no
-- catálogo pra quando existirem de fato; ativo_por_padrao=false porque
-- a funcionalidade em si ainda não existe no código.
INSERT INTO public.saas_features (chave, nome, descricao, ativo_por_padrao) VALUES
  ('checklist_avancado', 'Checklist Avançado', 'Funcionalidade futura.', false),
  ('ia', 'IA', 'Funcionalidade futura.', false),
  ('api', 'API', 'Funcionalidade futura.', false),
  ('portal_cliente', 'Portal do Cliente', 'Funcionalidade futura.', false),
  ('relatorios_premium', 'Relatórios Premium', 'Funcionalidade futura.', false);
