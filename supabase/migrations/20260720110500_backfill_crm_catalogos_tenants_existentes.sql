-- CRM Comercial — aplica o seed padrão de catálogos a todo tenant que já
-- existir no momento desta migration. Idempotente (crm_seed_catalogos_padrao
-- só insere o que ainda não existe), então é seguro rodar de novo.
DO $$
DECLARE
  v_empresa_id uuid;
BEGIN
  FOR v_empresa_id IN SELECT id FROM public.empresas LOOP
    PERFORM public.crm_seed_catalogos_padrao(v_empresa_id);
  END LOOP;
END $$;
