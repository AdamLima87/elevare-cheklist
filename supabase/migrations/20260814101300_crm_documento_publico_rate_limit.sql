-- Fase B — tabela de rate limiting da Edge Function pública
-- crm-documento-publico. Log-only (sem RLS de leitura pra client nenhum —
-- só a Edge Function com service role escreve/lê), mesma disciplina de
-- signup_attempts: nunca guarda o token bruto, só o hash já calculado pela
-- Edge Function (o mesmo SHA-256 usado pra resolver o documento).
CREATE TABLE public.crm_documento_publico_tentativas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip text,
  token_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX crm_documento_publico_tentativas_ip_idx ON public.crm_documento_publico_tentativas (ip, created_at);
CREATE INDEX crm_documento_publico_tentativas_token_idx ON public.crm_documento_publico_tentativas (token_hash, created_at);

ALTER TABLE public.crm_documento_publico_tentativas ENABLE ROW LEVEL SECURITY;
-- Nenhuma policy de SELECT/INSERT pra "authenticated" nem "anon" — só
-- service_role (Edge Function) acessa esta tabela.
GRANT ALL ON public.crm_documento_publico_tentativas TO service_role;

-- Retenção: reaproveita o mesmo padrão de limpeza de signup_attempts, se
-- existir um cron de retenção já configurado; caso contrário, esta tabela
-- cresce de forma limitada (linha por tentativa de acesso público) e pode
-- ganhar um cron dedicado depois, sem urgência pra este volume.
