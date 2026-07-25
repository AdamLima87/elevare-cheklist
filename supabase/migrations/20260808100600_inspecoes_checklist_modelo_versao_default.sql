-- Fase 7.11 — achado durante a suíte de testes: checklist_modelo_versao_id
-- ficou NOT NULL sem DEFAULT (diferente de tipo_execucao, que tem
-- DEFAULT 'inspecao_legada' desde a Fase 2). Qualquer INSERT que não passe
-- explicitamente por pushInspecaoToCloud/crm_obter_ou_criar_diagnostico/
-- iniciar_reinspecao (todos já setam o campo) falharia com NOT NULL
-- violation. Mesmo padrão de robustez do resto do schema: DEFAULT via a
-- mesma função de resolução usada no backfill original.
ALTER TABLE public.inspecoes
  ALTER COLUMN checklist_modelo_versao_id SET DEFAULT public.resolver_checklist_modelo_padrao();
