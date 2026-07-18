// Domínio público do app, usado em qualquer lugar do front que monta URL
// manualmente. Fallback pra window.location.origin (nunca um domínio de
// produção hardcoded) — em staging, esquecer de configurar a env var faz
// o app usar a própria origem que está servindo a página, nunca
// redirecionar silenciosamente pra produção.
export function getAppUrl(): string {
  const configured = import.meta.env.VITE_APP_URL as string | undefined;
  if (configured) return configured.replace(/\/+$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}
