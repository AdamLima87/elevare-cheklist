// Contexto de negócio de uma execução de checklist — decide COMO ela é
// persistida em `inspecoes` (cliente_id / crm_oportunidade_id / tipo_execucao).
// É metadado de fluxo, nunca inferido pela ausência de outro dado: todo
// call site que persiste uma Inspecao precisa declarar explicitamente qual
// dos três é.
export type InspectionContext =
  | { kind: "cliente"; clienteId?: string }
  | { kind: "diagnostico_crm"; crmOportunidadeId: string }
  | { kind: "reinspecao"; clienteId?: string };

export function tipoExecucaoFor(
  context: InspectionContext,
): "inspecao_legada" | "diagnostico" | "reinspecao" {
  if (context.kind === "diagnostico_crm") return "diagnostico";
  if (context.kind === "reinspecao") return "reinspecao";
  return "inspecao_legada";
}
