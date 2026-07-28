-- Fase 8.B — o picker de legislações (ChecklistModeloPicker, hoje desmontado)
-- precisa mostrar nome + descrição de aplicabilidade por modelo, mas
-- checklist_modelos (Fase 7) só tem "nome". Coluna aditiva, nullable — sem
-- impacto em RLS/triggers (que operam por linha, não por coluna) nem na
-- imutabilidade de versões já publicadas (a coluna vive em checklist_modelos,
-- não em checklist_modelo_versoes/secoes/itens).
ALTER TABLE public.checklist_modelos
  ADD COLUMN descricao text;

-- Preenche a descrição da RDC 275 já cadastrada. RDC 275/2002 dispõe sobre
-- Procedimentos Operacionais Padronizados e a Lista de Verificação das Boas
-- Práticas de Fabricação (BPF) para ESTABELECIMENTOS PRODUTORES/
-- INDUSTRIALIZADORES DE ALIMENTOS — não tem relação com "serviços de saúde"
-- (esse é o escopo de exclusão citado na própria RDC 216, item 1.2, não o
-- escopo da 275).
UPDATE public.checklist_modelos
  SET descricao = 'Boas Práticas de Fabricação (BPF) e Procedimentos Operacionais Padronizados para estabelecimentos produtores e industrializadores de alimentos.'
  WHERE codigo = 'RDC_275_2002_PADRAO';
