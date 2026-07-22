import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type Periodicidade = "mensal" | "anual";

// Mensal/anual nunca provisionam tenant antes do pagamento — criam essa
// intenção, que carrega tudo que provision_tenant vai precisar quando o
// webhook confirmar (Fase 4). Idempotente por design: reaproveita uma
// intenção aberta existente em vez de criar duplicada a cada novo clique/
// resubmit, e o índice único parcial em saas_checkout_intencoes garante
// isso mesmo sob corrida.
export async function upsertCheckoutIntent(
  admin: SupabaseClient,
  params: {
    authUserId: string;
    email: string;
    periodicidade: Periodicidade;
    empresaNome: string;
    ownerNome: string;
    whatsapp: string;
    origem: Record<string, unknown>;
  },
): Promise<{ id: string }> {
  const { data: existing } = await admin
    .from("saas_checkout_intencoes")
    .select("id")
    .eq("auth_user_id", params.authUserId)
    .eq("plano_codigo", "pro")
    .eq("periodicidade", params.periodicidade)
    .in("status", ["pendente", "aguardando_pagamento"])
    .maybeSingle();

  if (existing) return { id: existing.id };

  const { data, error } = await admin
    .from("saas_checkout_intencoes")
    .insert({
      auth_user_id: params.authUserId,
      email: params.email,
      plano_codigo: "pro",
      periodicidade: params.periodicidade,
      origem: {
        ...params.origem,
        empresa_nome: params.empresaNome,
        owner_nome: params.ownerNome,
        whatsapp: params.whatsapp,
      },
    })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id };
}

// Usado no ramo "confirmed_no_profile": decide o redirect do magic link
// só com base em estado real do banco, nunca em dado enviado pelo cliente
// nesta chamada (um resend não reenvia plano/empresa).
export async function findOpenCheckoutIntent(
  admin: SupabaseClient,
  authUserId: string,
): Promise<{ id: string; periodicidade: Periodicidade } | null> {
  const { data } = await admin
    .from("saas_checkout_intencoes")
    .select("id, periodicidade")
    .eq("auth_user_id", authUserId)
    .in("status", ["pendente", "aguardando_pagamento"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as { id: string; periodicidade: Periodicidade } | null;
}
