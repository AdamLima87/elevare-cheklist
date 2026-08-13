// Fase B — espelha em TypeScript puro a tabela-verdade que
// crm_fechar_oportunidade_ganha aplica em SQL (extensão de
// 20260814100900_crm_fechar_oportunidade_ganha_ganha_exige.sql). Serve de
// documentação viva e de pré-checagem client-side pra UI mostrar o motivo
// do bloqueio antes de chamar a RPC — a RPC continua sendo a única fonte de
// verdade (esta função nunca decide o fechamento sozinha).
export type CrmGanhaExige = "proposta_aceita" | "contrato_assinado";

export interface ResolverGanhaGatingInput {
  ganhaExige: CrmGanhaExige;
  diagnosticoRequerido: boolean;
  diagnosticoConcluido: boolean;
  propostaAceita: boolean;
  contratoAssinado: boolean;
}

export type ResultadoGanhaGating =
  | { liberado: true }
  | { liberado: false; motivo: "DIAGNOSTICO_NAO_CONCLUIDO"; mensagem: string }
  | { liberado: false; motivo: "PROPOSTA_NAO_ACEITA"; mensagem: string }
  | { liberado: false; motivo: "CONTRATO_NAO_ASSINADO"; mensagem: string };

// Mesma ordem de checagem da RPC: diagnóstico primeiro (regra já existente
// desde a Fase 5), depois proposta aceita (sempre exigida), depois contrato
// assinado (só quando ganhaExige='contrato_assinado'). Sem opção de "nenhuma
// exigência" — proposta aceita é sempre o piso mínimo.
export function resolverGanhaGating(input: ResolverGanhaGatingInput): ResultadoGanhaGating {
  if (input.diagnosticoRequerido && !input.diagnosticoConcluido) {
    return {
      liberado: false,
      motivo: "DIAGNOSTICO_NAO_CONCLUIDO",
      mensagem: "O Diagnóstico Inicial desta oportunidade não foi concluído.",
    };
  }

  if (!input.propostaAceita) {
    return {
      liberado: false,
      motivo: "PROPOSTA_NAO_ACEITA",
      mensagem: "Esta oportunidade não tem nenhuma proposta comercial aceita.",
    };
  }

  if (input.ganhaExige === "contrato_assinado" && !input.contratoAssinado) {
    return {
      liberado: false,
      motivo: "CONTRATO_NAO_ASSINADO",
      mensagem: "Esta oportunidade exige um contrato assinado antes de ser fechada como ganha.",
    };
  }

  return { liberado: true };
}
