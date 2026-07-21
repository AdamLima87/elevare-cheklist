// CRM Comercial — Buscar Leads: rate limit de busca por tenant. Mesmo
// formato de checkSignupRateLimit (_shared/rate-limit.ts) — tabela +
// contagem por janela de tempo via created_at — só que a chave é
// empresa_id (tenant autenticado), não IP, porque quem pode abusar aqui já
// passou pela autenticação.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const MAX_BUSCAS_POR_MINUTO = 10;

export async function checkLeadSearchRateLimit(
  admin: SupabaseClient,
  empresaId: string,
): Promise<{ allowed: boolean }> {
  const { count } = await admin
    .from("crm_leads_busca_tentativas")
    .select("id", { count: "exact", head: true })
    .eq("empresa_id", empresaId)
    .gte("created_at", new Date(Date.now() - 60 * 1000).toISOString());

  return { allowed: (count ?? 0) < MAX_BUSCAS_POR_MINUTO };
}

export async function logLeadSearchAttempt(admin: SupabaseClient, empresaId: string): Promise<void> {
  const { error } = await admin.from("crm_leads_busca_tentativas").insert({ empresa_id: empresaId });
  if (error) console.error("Failed to log lead search attempt", error);
}
