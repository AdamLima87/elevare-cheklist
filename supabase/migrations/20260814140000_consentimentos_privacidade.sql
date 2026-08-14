-- LGPD item 2: registro de aceite da política de privacidade, com data,
-- hora e versão. Só faz sentido como "consentimento" na tela onde a
-- própria pessoa está presente (cadastro) — dados de terceiros inseridos
-- por um consultor (representante legal, responsável técnico) usam outra
-- base legal e não passam por aqui.
CREATE TABLE public.consentimentos_privacidade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text NOT NULL,
  tela text NOT NULL,
  politica_versao text NOT NULL,
  aceito_em timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text
);

CREATE INDEX idx_consentimentos_privacidade_email ON public.consentimentos_privacidade (lower(email));
CREATE INDEX idx_consentimentos_privacidade_user_id ON public.consentimentos_privacidade (user_id);

ALTER TABLE public.consentimentos_privacidade ENABLE ROW LEVEL SECURITY;
-- Sem policy de SELECT/INSERT/UPDATE/DELETE para authenticated/anon —
-- mesmo padrão de audit_log/signup_attempts: só service_role (Edge
-- Functions) grava, só RPC SECURITY DEFINER (item 3, próxima migration)
-- ou super_admin lê.
CREATE POLICY consentimentos_privacidade_select_super_admin ON public.consentimentos_privacidade
  FOR SELECT USING (public.is_super_admin());
