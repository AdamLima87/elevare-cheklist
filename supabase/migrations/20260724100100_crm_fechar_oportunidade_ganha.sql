-- CRM Comercial — Etapa 7: fecha uma oportunidade como GANHA, movendo
-- etapa, criando/vinculando o cliente operacional (casando por CNPJ quando
-- disponível) e registrando a timeline, tudo numa transação só (ajuste do
-- usuário: substitui o fluxo em dois passos por uma RPC atômica).
--
-- SECURITY INVOKER (padrão) de propósito: cada escrita desta função
-- (UPDATE crm_oportunidades, UPDATE crm_empresas, INSERT clientes) passa
-- pela RLS normal do usuário chamador. Isso é o que faz "perfil cliente
-- não consegue fechar oportunidade" funcionar de graça, sem código extra
-- — o INSERT em clientes já falha por RLS antes de qualquer lógica de
-- negócio rodar. O log na timeline sai de graça também: o UPDATE de
-- etapa_id dispara o trigger da Etapa 2/7 (SECURITY DEFINER), que já
-- sabe distinguir "ganho" de uma troca de etapa comum.
--
-- CNPJ ausente não bloqueia o fechamento — UX: forçar CNPJ no momento de
-- fechar contrato é atrito desnecessário. Sem CNPJ, sempre cria cliente
-- novo (não há como casar com um cliente existente de forma confiável).
-- Idempotente: se a Conta já está vinculada a um cliente (cliente_id
-- preenchido), reaproveita — uma 2ª oportunidade da mesma Conta fechando
-- não duplica o cliente.
CREATE OR REPLACE FUNCTION public.crm_fechar_oportunidade_ganha(p_oportunidade_id uuid)
RETURNS TABLE (oportunidade_id uuid, cliente_id uuid, cliente_criado boolean)
LANGUAGE plpgsql
AS $function$
DECLARE
  v_oportunidade public.crm_oportunidades;
  v_crm_empresa public.crm_empresas;
  v_etapa_ganho_id uuid;
  v_cliente_id uuid;
  v_cliente_criado boolean := false;
BEGIN
  SELECT * INTO v_oportunidade FROM public.crm_oportunidades WHERE id = p_oportunidade_id FOR UPDATE;
  IF v_oportunidade.id IS NULL THEN
    RAISE EXCEPTION 'Oportunidade não encontrada ou sem permissão para fechá-la.';
  END IF;
  IF v_oportunidade.fechada_em IS NOT NULL THEN
    RAISE EXCEPTION 'Esta oportunidade já está fechada.';
  END IF;

  SELECT id INTO v_etapa_ganho_id FROM public.crm_etapas WHERE pipeline_id = v_oportunidade.pipeline_id AND tipo = 'ganho' LIMIT 1;
  IF v_etapa_ganho_id IS NULL THEN
    RAISE EXCEPTION 'O pipeline desta oportunidade não tem uma etapa de tipo "ganho" configurada.';
  END IF;

  SELECT * INTO v_crm_empresa FROM public.crm_empresas WHERE id = v_oportunidade.crm_empresa_id FOR UPDATE;

  IF v_crm_empresa.cliente_id IS NOT NULL THEN
    v_cliente_id := v_crm_empresa.cliente_id;
  ELSIF v_crm_empresa.cnpj IS NOT NULL THEN
    SELECT id INTO v_cliente_id FROM public.clientes
      WHERE empresa_id = v_oportunidade.empresa_id AND cnpj = v_crm_empresa.cnpj;
  END IF;

  IF v_cliente_id IS NULL THEN
    INSERT INTO public.clientes (empresa_id, nome, cnpj, status, responsavel_id, origem)
      VALUES (
        v_oportunidade.empresa_id,
        coalesce(v_crm_empresa.nome_fantasia, v_crm_empresa.razao_social),
        v_crm_empresa.cnpj,
        'ativo',
        v_oportunidade.responsavel_id,
        'crm'
      )
      RETURNING id INTO v_cliente_id;
    v_cliente_criado := true;
  END IF;

  IF v_crm_empresa.cliente_id IS DISTINCT FROM v_cliente_id THEN
    UPDATE public.crm_empresas SET cliente_id = v_cliente_id, status = 'ativa' WHERE id = v_crm_empresa.id;
  END IF;

  UPDATE public.crm_oportunidades SET etapa_id = v_etapa_ganho_id WHERE id = p_oportunidade_id;

  RETURN QUERY SELECT p_oportunidade_id, v_cliente_id, v_cliente_criado;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.crm_fechar_oportunidade_ganha(uuid) TO authenticated;
