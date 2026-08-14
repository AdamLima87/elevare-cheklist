-- Fase C: assinatura eletrônica própria (OTP por e-mail) para contratos.
-- Coexiste com o fluxo manual existente (crm_marcar_contrato_assinado) —
-- nenhuma coluna/constraint antiga é removida, só estendida.

ALTER TABLE public.crm_contratos
  ADD COLUMN assinatura_email_solicitado text,
  ADD COLUMN assinatura_signatario_nome text,
  ADD COLUMN assinatura_signatario_email text,
  ADD COLUMN assinatura_ip text,
  ADD COLUMN assinatura_user_agent text,
  ADD COLUMN assinatura_hash_conteudo text;

-- Terceiro caminho válido de evidência de assinatura, ao lado de
-- arquivo_assinado_path/justificativa_sem_arquivo (fluxo manual).
ALTER TABLE public.crm_contratos
  DROP CONSTRAINT crm_contratos_assinatura_evidencia_check;

ALTER TABLE public.crm_contratos
  ADD CONSTRAINT crm_contratos_assinatura_evidencia_check CHECK (
    status <> 'assinado'
    OR arquivo_assinado_path IS NOT NULL
    OR justificativa_sem_arquivo IS NOT NULL
    OR (origem_assinatura = 'assinatura_eletronica' AND assinatura_hash_conteudo IS NOT NULL)
  );

-- Um único OTP ativo por vez por contrato: cada `crm_solicitar_otp_assinatura`
-- supera (expira) qualquer OTP anterior não-verificado do mesmo contrato antes
-- de gerar um novo, então nunca há ambiguidade sobre qual código é o vigente.
CREATE TABLE public.crm_assinatura_otp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL,
  empresa_id uuid NOT NULL,
  codigo_hash text NOT NULL,
  expira_em timestamptz NOT NULL,
  tentativas int NOT NULL DEFAULT 0,
  verificado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_assinatura_otp_contrato_fk
    FOREIGN KEY (contrato_id, empresa_id) REFERENCES public.crm_contratos (id, empresa_id) ON DELETE CASCADE
);

CREATE INDEX idx_crm_assinatura_otp_contrato_ativo
  ON public.crm_assinatura_otp (contrato_id, verificado_em, expira_em);

-- Sem NENHUMA policy: só o service-role (usado pela Edge Function) toca esta
-- tabela. Nem authenticated nem anon têm qualquer acesso, nem leitura —
-- codigo_hash nunca deve ser alcançável por um client normal.
ALTER TABLE public.crm_assinatura_otp ENABLE ROW LEVEL SECURITY;

-- Rate limiting das ações públicas de solicitar/verificar código, mesmo
-- padrão de crm_documento_publico_tentativas (janela deslizante por
-- token_hash), mas em tabela separada porque os limites são diferentes
-- (solicitar é bem mais restrito que verificar).
CREATE TABLE public.crm_assinatura_otp_tentativas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('solicitar', 'verificar')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_crm_assinatura_otp_tentativas_token
  ON public.crm_assinatura_otp_tentativas (token_hash, tipo, created_at);

ALTER TABLE public.crm_assinatura_otp_tentativas ENABLE ROW LEVEL SECURITY;
