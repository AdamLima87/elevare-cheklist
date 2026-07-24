-- Fase 7.3 — vincula toda inspeção/diagnóstico ao modelo de checklist exato
-- usado. Mesmo padrão staged já usado para tipo_execucao (Fase 2): nullable
-- -> backfill -> validar -> NOT NULL.

ALTER TABLE public.inspecoes
  ADD COLUMN checklist_modelo_versao_id uuid REFERENCES public.checklist_modelo_versoes(id);

ALTER TABLE public.inspecoes
  ADD COLUMN inspecao_origem_id uuid REFERENCES public.inspecoes(id);
-- Nullable e sem backfill — nenhuma linha existente hoje é origem de nada
-- (reinspeção não existe como fluxo ainda, Fase 7.9). Só passa a ser
-- preenchida quando iniciar_reinspecao() de fato criar uma linha nova.

-- Backfill: toda linha existente (inspecao_legada + diagnostico) foi
-- respondida contra o mesmo checklist hardcoded que virou o seed da RDC 275
-- v1 — usa a mesma função de resolução que o restante do sistema vai usar
-- daqui pra frente, não uma constante solta.
UPDATE public.inspecoes
  SET checklist_modelo_versao_id = public.resolver_checklist_modelo_padrao()
  WHERE checklist_modelo_versao_id IS NULL;

DO $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count FROM public.inspecoes WHERE checklist_modelo_versao_id IS NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Backfill incompleto — % linha(s) de inspecoes sem checklist_modelo_versao_id', v_count;
  END IF;
END $$;

ALTER TABLE public.inspecoes
  ALTER COLUMN checklist_modelo_versao_id SET NOT NULL;

CREATE INDEX inspecoes_checklist_modelo_versao_idx ON public.inspecoes (checklist_modelo_versao_id);
CREATE INDEX inspecoes_inspecao_origem_idx ON public.inspecoes (inspecao_origem_id) WHERE inspecao_origem_id IS NOT NULL;

-- Pré-requisito para a Fase 7.8: reinspecao_programacoes vai referenciar
-- inspecoes via FK composta (id, empresa_id), mesmo padrão tenant-safe já
-- usado para clientes/profiles desde 20260718100300_tenant_safe_foreign_keys.sql
-- e 20260720100000_profiles_tenant_safe_unique.sql.
ALTER TABLE public.inspecoes ADD CONSTRAINT inspecoes_id_empresa_unique UNIQUE (id, empresa_id);
