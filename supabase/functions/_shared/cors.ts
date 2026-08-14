// Achado de auditoria: funções internas/autenticadas usavam
// Access-Control-Allow-Origin: '*' sem necessidade — o bearer token não é
// enviado automaticamente pelo browser como um cookie seria, então CORS
// aberto aqui não habilita CSRF clássico, mas remove uma camada de defesa
// à toa. Restringe ao domínio real do app (PUBLIC_APP_URL) + localhost em
// dev. Uso: só para funções autenticadas/internas — funções genuinamente
// públicas (crm-documento-publico, asaas-webhook, public-signup) continuam
// com '*' de propósito, sem usar este helper.
const DEV_ORIGINS = ["http://localhost:8080", "http://localhost:5173", "http://127.0.0.1:8080"];

export function buildCorsHeaders(req: Request): Record<string, string> {
  const appUrl = Deno.env.get("PUBLIC_APP_URL")?.replace(/\/+$/, "");
  const allowedOrigins = [...(appUrl ? [appUrl] : []), ...DEV_ORIGINS];
  const requestOrigin = req.headers.get("Origin") ?? "";
  const allowOrigin = allowedOrigins.includes(requestOrigin) ? requestOrigin : (appUrl ?? DEV_ORIGINS[0]);

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}
