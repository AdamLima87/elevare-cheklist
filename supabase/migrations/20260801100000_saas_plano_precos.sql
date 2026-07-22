-- Preços do plano "pro" (mensal/anual), como limites de catálogo — mesma
-- tabela/mecanismo já usado pra crm_leads_total/crm_leads_mensal, editável
-- via /plataforma/planos sem precisar de deploy. O backend do checkout
-- (Fase 3) sempre lê o preço daqui, nunca aceita valor vindo do frontend.
--
-- Decisão comercial: anual R$ 1.250 (não R$ 1.150) — ajustado depois de
-- confirmar que o Checkout hospedado do Asaas não permite repassar juros
-- de parcelamento ao comprador (validado em Sandbox na Fase 3); o preço
-- já embute a margem que se perderia com a taxa de parcelamento do Asaas,
-- que o RDCheck absorve.
INSERT INTO public.saas_plano_limites (plano_id, limite_key, valor)
  SELECT id, 'preco_mensal', 120 FROM public.saas_planos WHERE codigo = 'pro'
  UNION ALL
  SELECT id, 'preco_anual', 1250 FROM public.saas_planos WHERE codigo = 'pro'
ON CONFLICT (plano_id, limite_key) DO UPDATE SET valor = EXCLUDED.valor;
