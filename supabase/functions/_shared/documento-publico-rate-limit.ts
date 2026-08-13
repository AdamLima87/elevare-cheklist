import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// Fase B — rate limiting da resolução de token público, seguindo o mesmo
// idioma de _shared/rate-limit.ts (signup), mas keyed por IP e por
// token_hash (nunca pelo token bruto — só o hash já calculado pelo
// chamador). Janela deslizante via created_at, mesma técnica.
const MAX_POR_IP_POR_HORA = 20;
const MAX_POR_TOKEN_POR_HORA = 10;

export function getClientIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return null;
}

export interface DocumentoRateLimitCheck {
  allowed: boolean;
}

export async function checkDocumentoPublicoRateLimit(
  admin: SupabaseClient,
  ip: string | null,
  tokenHash: string,
): Promise<DocumentoRateLimitCheck> {
  const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  if (ip) {
    const { count } = await admin
      .from("crm_documento_publico_tentativas")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("created_at", umaHoraAtras);
    if ((count ?? 0) >= MAX_POR_IP_POR_HORA) return { allowed: false };
  }

  const { count: countToken } = await admin
    .from("crm_documento_publico_tentativas")
    .select("id", { count: "exact", head: true })
    .eq("token_hash", tokenHash)
    .gte("created_at", umaHoraAtras);
  if ((countToken ?? 0) >= MAX_POR_TOKEN_POR_HORA) return { allowed: false };

  return { allowed: true };
}

export async function logDocumentoPublicoTentativa(admin: SupabaseClient, ip: string | null, tokenHash: string): Promise<void> {
  const { error } = await admin.from("crm_documento_publico_tentativas").insert({ ip, token_hash: tokenHash });
  if (error) console.error("Failed to log documento publico attempt", error);
}
