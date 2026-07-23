// Fase 2 (Diagnóstico no CRM) — classificação explícita de uma execução de
// checklist, espelhando inspecoes.tipo_execucao (CHECK no banco). Nenhum
// código de runtime usa este tipo ainda — o fluxo atual (storage.ts) continua
// gravando via DEFAULT 'inspecao_legada' até a Fase 4 introduzir o novo fluxo.
export type TipoExecucao = "diagnostico" | "reinspecao" | "inspecao_legada";
