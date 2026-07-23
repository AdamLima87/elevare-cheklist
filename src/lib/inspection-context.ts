// Contexto de negócio de uma execução de checklist — decide COMO ela é
// persistida em `inspecoes` (cliente_id / crm_oportunidade_id / tipo_execucao).
// É metadado de fluxo, nunca inferido pela ausência de outro dado: todo
// call site que persiste uma Inspecao precisa declarar explicitamente qual
// dos dois é.
export type InspectionContext =
  | { kind: "cliente"; clienteId?: string }
  | { kind: "diagnostico_crm"; crmOportunidadeId: string };

export function tipoExecucaoFor(context: InspectionContext): "inspecao_legada" | "diagnostico" {
  return context.kind === "diagnostico_crm" ? "diagnostico" : "inspecao_legada";
}
