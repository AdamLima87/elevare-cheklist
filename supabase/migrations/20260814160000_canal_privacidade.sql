-- LGPD item 5: canal de contato de privacidade — em vez de só um mailto,
-- um formulário público que registra o pedido numa fila real, visível pro
-- super_admin em /plataforma/privacidade. Reduz o risco de um pedido de
-- titular se perder numa caixa de e-mail.
CREATE TABLE public.solicitacoes_privacidade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  identificador text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('exportar', 'excluir', 'duvida')),
  mensagem text,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'concluida')),
  created_at timestamptz NOT NULL DEFAULT now(),
  atendida_em timestamptz,
  atendida_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX idx_solicitacoes_privacidade_status ON public.solicitacoes_privacidade (status, created_at);

ALTER TABLE public.solicitacoes_privacidade ENABLE ROW LEVEL SECURITY;
CREATE POLICY solicitacoes_privacidade_select_super_admin ON public.solicitacoes_privacidade
  FOR SELECT USING (public.is_super_admin());

-- Insert só via RPC (público, sem login) — com limite simples anti-spam:
-- no máx. 3 solicitações por identificador em 24h.
CREATE OR REPLACE FUNCTION public.registrar_solicitacao_privacidade(
  p_nome text,
  p_identificador text,
  p_tipo text,
  p_mensagem text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_recentes int;
BEGIN
  IF trim(coalesce(p_nome, '')) = '' OR trim(coalesce(p_identificador, '')) = '' THEN
    RAISE EXCEPTION 'Nome e e-mail/CPF são obrigatórios.' USING ERRCODE = '22023';
  END IF;
  IF p_tipo NOT IN ('exportar', 'excluir', 'duvida') THEN
    RAISE EXCEPTION 'Tipo de solicitação inválido.' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO v_recentes
  FROM public.solicitacoes_privacidade
  WHERE lower(identificador) = lower(trim(p_identificador))
    AND created_at > now() - interval '24 hours';
  IF v_recentes >= 3 THEN
    RAISE EXCEPTION 'Muitas solicitações recentes. Tente novamente mais tarde.' USING ERRCODE = '42901';
  END IF;

  INSERT INTO public.solicitacoes_privacidade (nome, identificador, tipo, mensagem)
    VALUES (trim(p_nome), trim(p_identificador), p_tipo, p_mensagem);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.registrar_solicitacao_privacidade(text, text, text, text) TO anon, authenticated;

-- Admin marca status ao atender o pedido (ex.: depois de usar
-- platform_exportar_dados_titular / platform_anonimizar_titular).
CREATE OR REPLACE FUNCTION public.platform_atualizar_status_solicitacao_privacidade(p_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Acesso restrito à administração da plataforma.' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('pendente', 'em_andamento', 'concluida') THEN
    RAISE EXCEPTION 'Status inválido.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.solicitacoes_privacidade
  SET status = p_status,
      atendida_em = CASE WHEN p_status = 'concluida' THEN now() ELSE atendida_em END,
      atendida_por = CASE WHEN p_status = 'concluida' THEN auth.uid() ELSE atendida_por END
  WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação não encontrada.' USING ERRCODE = 'P0002';
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.platform_atualizar_status_solicitacao_privacidade(uuid, text) TO authenticated;
