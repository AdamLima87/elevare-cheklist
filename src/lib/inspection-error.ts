// Reconhece os erros de negócio esperados especificamente no fluxo de
// Diagnóstico do CRM. Não é um sistema genérico — deliberadamente pequeno e
// escopado. Fora daqui, o padrão atual (toast com error.message cru)
// continua valendo no resto do app.
export function describeInspectionSaveError(error: unknown): string {
  const e = error as { code?: string; message?: string } | null;
  if (e?.code === "23503") {
    return "Esta oportunidade não foi encontrada ou foi removida. Recarregue a página.";
  }
  if (e?.code === "23514") {
    return "Não foi possível salvar: combinação de tipo de execução inválida. Contate o suporte.";
  }
  if (e?.code === "23505") {
    return "Já existe um diagnóstico para esta oportunidade. Recarregue a página.";
  }
  if (e?.code === "PGRST116") {
    return "Diagnóstico não encontrado, ou você não tem permissão para acessá-lo.";
  }
  return e?.message || "Erro ao salvar o diagnóstico. Verifique sua conexão e tente novamente.";
}
