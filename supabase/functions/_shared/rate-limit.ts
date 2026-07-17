import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const MAX_PER_IP_PER_HOUR = 5;
const MAX_PER_EMAIL_PER_DAY = 3;

// Supabase Edge Functions rodam atrás do proxy da própria plataforma, que
// popula x-forwarded-for de forma confiável (não é um header que o cliente
// final consiga forjar arbitrariamente nesse ambiente) — validado na
// prática ao implementar esta function (ver comentário de verificação
// junto ao primeiro deploy). Se o comportamento divergir, ajustar aqui,
// num único lugar.
export function getClientIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return null;
}

export interface RateLimitCheck {
  allowed: boolean;
  reason?: "rate_limited_ip" | "rate_limited_email";
}

export async function checkSignupRateLimit(
  admin: SupabaseClient,
  ip: string | null,
  email: string,
): Promise<RateLimitCheck> {
  if (ip) {
    const { count } = await admin
      .from("signup_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
    if ((count ?? 0) >= MAX_PER_IP_PER_HOUR) {
      return { allowed: false, reason: "rate_limited_ip" };
    }
  }

  const { count: emailCount } = await admin
    .from("signup_attempts")
    .select("id", { count: "exact", head: true })
    .ilike("email", email)
    .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  if ((emailCount ?? 0) >= MAX_PER_EMAIL_PER_DAY) {
    return { allowed: false, reason: "rate_limited_email" };
  }

  return { allowed: true };
}

export interface SignupAttemptLog {
  ip: string | null;
  email: string;
  success: boolean;
  reason: string;
}

// Nunca loga senha, token ou payload completo — só o necessário para
// contar tentativas e investigar abuso.
export async function logSignupAttempt(admin: SupabaseClient, params: SignupAttemptLog): Promise<void> {
  const { error } = await admin.from("signup_attempts").insert({
    ip: params.ip,
    email: params.email,
    success: params.success,
    reason: params.reason,
  });
  if (error) console.error("Failed to log signup attempt", error);
}
