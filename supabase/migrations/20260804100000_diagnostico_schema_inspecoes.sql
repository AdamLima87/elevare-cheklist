-- Fase 2 (Diagnóstico no CRM) — fundação aditiva em inspecoes. Zero mudança de
-- comportamento visível: só novas colunas nullable/com default seguro, novos
-- índices e uma constraint NOT VALID. Nenhum código do frontend lê essas colunas
-- ainda (isso é Fase 4). Pré-validação (scripts/prevalidacao-diagnostico-crm.mjs)
-- rodada antes desta migration: staging está vazio (0 linhas em inspecoes e
-- crm_oportunidades), sem nenhum bloqueador.

-- 1. Vínculo comercial: nasce preenchido no diagnóstico (Fase 4), preservado
-- permanentemente após a conversão em cliente (crm_fechar_oportunidade_ganha,
-- ajustada na Fase 3, nunca vai apagar este campo).
ALTER TABLE public.inspecoes
  ADD COLUMN crm_oportunidade_id uuid;

ALTER TABLE public.inspecoes
  ADD CONSTRAINT inspecoes_crm_oportunidade_empresa_fkey
  FOREIGN KEY (crm_oportunidade_id, empresa_id)
  REFERENCES public.crm_oportunidades (id, empresa_id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;
-- ON DELETE NO ACTION (explícito, não o default implícito): apagar fisicamente
-- uma oportunidade com diagnóstico vinculado deve ser IMPEDIDO pelo banco, nunca
-- apagar o diagnóstico em cascata (perderia rastreabilidade) nem desvincular via
-- SET NULL (perderia a origem comercial). Verificado antes desta migration: hoje
-- nenhuma funcionalidade do sistema apaga fisicamente uma crm_oportunidade (só
-- UPDATE, nos hooks e nas RPCs de fechamento). Efeito colateral documentado: a
-- partir de agora, uma oportunidade com diagnóstico vinculado não pode mais ser
-- excluída fisicamente — uma função futura de "excluir oportunidade" vai
-- precisar virar arquivamento/inativação (soft-delete) quando houver diagnóstico
-- vinculado. Não é um problema hoje (não existe delete físico no código atual).

-- 2. Classificação explícita da execução — não inferida por combinação de FKs.
-- Estratégia segura: nullable -> backfill -> NOT NULL -> CHECK.
ALTER TABLE public.inspecoes
  ADD COLUMN tipo_execucao text;

UPDATE public.inspecoes SET tipo_execucao = 'inspecao_legada' WHERE tipo_execucao IS NULL;

ALTER TABLE public.inspecoes
  ALTER COLUMN tipo_execucao SET DEFAULT 'inspecao_legada',
  ALTER COLUMN tipo_execucao SET NOT NULL;

ALTER TABLE public.inspecoes
  ADD CONSTRAINT inspecoes_tipo_execucao_check
  CHECK (tipo_execucao IN ('diagnostico', 'reinspecao', 'inspecao_legada'));
-- Todo registro criado pelo código atual (Fase 4 ainda não mudou storage.ts)
-- continuará recebendo 'inspecao_legada' via DEFAULT, até a Fase 4 passar a
-- atribuir 'diagnostico'/'reinspecao' explicitamente no novo fluxo. Registros
-- pré-existentes NUNCA são reclassificados automaticamente para 'diagnostico'
-- ou 'reinspecao' — não há evidência segura disso hoje.

-- 3. Constraint de contexto: garante só que ao menos um vínculo exista — nunca
-- exclusividade mútua (o mesmo diagnóstico tem os dois campos preenchidos após
-- a conversão comercial). NOT VALID de propósito: não varre linhas existentes
-- agora, mas passa a valer imediatamente para todo INSERT/UPDATE novo a partir
-- daqui. Validação retroativa (VALIDATE CONSTRAINT) fica fora do escopo desta
-- fase — decisão para a Fase 3, condicionada ao relatório de pré-validação.
ALTER TABLE public.inspecoes
  ADD CONSTRAINT inspecoes_tem_origem_check
  CHECK (cliente_id IS NOT NULL OR crm_oportunidade_id IS NOT NULL)
  NOT VALID;

-- 4. Índices — só os dois com uso real já previsto (Fase 3/4: listar diagnósticos
-- de uma oportunidade; filtrar por tipo_execucao em relatórios/reincidência).
CREATE INDEX inspecoes_empresa_crm_oportunidade_idx
  ON public.inspecoes (empresa_id, crm_oportunidade_id)
  WHERE crm_oportunidade_id IS NOT NULL;

CREATE INDEX inspecoes_empresa_cliente_tipo_idx
  ON public.inspecoes (empresa_id, cliente_id, tipo_execucao);
