// Domínio público do app, usado para montar todo redirectTo gerado pelas
// Edge Functions (confirmação de e-mail, magic link, etc). Sem fallback:
// um servidor não tem "origem atual" para cair como default seguro
// (diferente do browser) — gerar um link com destino errado é pior que
// falhar explicitamente. Se PUBLIC_APP_URL não estiver configurada, a
// function recusa gerar link em vez de usar produção como default.
export function getAppUrl(): string {
  const url = Deno.env.get("PUBLIC_APP_URL");
  if (!url) {
    throw new Error(
      "PUBLIC_APP_URL não configurada neste ambiente — recusando gerar link sem domínio confiável.",
    );
  }
  return url.replace(/\/+$/, "");
}
