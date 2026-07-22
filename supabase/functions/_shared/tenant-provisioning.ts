import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type ProvisionStatus = "created" | "already_provisioned" | "inconsistent_state";

export interface ProvisionResult {
  status: ProvisionStatus;
  empresaId: string | null;
}

interface ProvisionParams {
  ownerId: string;
  ownerEmail: string;
  empresaNome: string;
  ownerNome: string;
  whatsapp: string;
  plano: string;
  status: string;
  trialEndsAt: string | null;
  origem: Record<string, unknown>;
}

async function provisionTenant(admin: SupabaseClient, params: ProvisionParams): Promise<ProvisionResult> {
  const { data, error } = await admin.rpc("provision_tenant", {
    p_owner_id: params.ownerId,
    p_owner_email: params.ownerEmail,
    p_empresa_nome: params.empresaNome,
    p_owner_nome: params.ownerNome,
    p_whatsapp: params.whatsapp,
    p_plano: params.plano,
    p_status: params.status,
    p_trial_ends_at: params.trialEndsAt,
    p_origem: params.origem,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return { status: row.status, empresaId: row.empresa_id };
}

// Signup público: sempre trial de 14 dias — o cliente público nunca decide
// esses valores. trialEndsAt é calculado aqui (não omitido), porque a RPC
// só aplica seu DEFAULT quando o parâmetro é OMITIDO da chamada, não
// quando é passado como null.
export async function provisionTrialTenant(
  admin: SupabaseClient,
  params: {
    ownerId: string;
    ownerEmail: string;
    empresaNome: string;
    ownerNome: string;
    whatsapp: string;
    origem: Record<string, unknown>;
  },
): Promise<ProvisionResult> {
  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const result = await provisionTenant(admin, {
    ...params,
    plano: "trial",
    status: "ativo",
    trialEndsAt,
    origem: { ...params.origem, provisioning_source: "public_signup" },
  });

  // Assinatura local trialing — get_tenant_access_status() e a tela de
  // Plano e Cobrança dependem dela existir, não só de empresas.trial_ends_at.
  // "created" ou "already_provisioned" (corrida benigna) podem chegar aqui
  // sem essa linha ainda existir; nunca duplica (checa antes de inserir).
  if (result.empresaId && (result.status === "created" || result.status === "already_provisioned")) {
    const { data: existente } = await admin
      .from("saas_assinaturas")
      .select("id")
      .eq("empresa_id", result.empresaId)
      .maybeSingle();
    if (!existente) {
      await admin.from("saas_assinaturas").insert({
        empresa_id: result.empresaId,
        owner_id: params.ownerId,
        plano_codigo: "trial",
        periodicidade: null,
        status: "trialing",
        trial_ends_at: trialEndsAt,
      });
    }
  }

  return result;
}

// Ativação pós-pagamento (webhook Asaas): plano pago, sem trial. Só é
// chamada depois que o webhook confirma o pagamento — nunca antes.
export function provisionPaidTenant(
  admin: SupabaseClient,
  params: {
    ownerId: string;
    ownerEmail: string;
    empresaNome: string;
    ownerNome: string;
    whatsapp: string;
    origem: Record<string, unknown>;
  },
): Promise<ProvisionResult> {
  return provisionTenant(admin, {
    ...params,
    plano: "pro",
    status: "ativo",
    trialEndsAt: null,
    origem: { ...params.origem, provisioning_source: "asaas_webhook" },
  });
}

// create_empresa (super admin): plano/status/trial vêm do formulário
// administrativo, não de um valor fixo — a mesma função SQL, chamada com
// parâmetros diferentes.
export function provisionAdminTenant(
  admin: SupabaseClient,
  params: {
    ownerId: string;
    ownerEmail: string;
    empresaNome: string;
    ownerNome: string;
    whatsapp: string;
    plano: string;
    status: string;
    trialEndsAt?: string | null;
    origem: Record<string, unknown>;
  },
): Promise<ProvisionResult> {
  return provisionTenant(admin, {
    ...params,
    trialEndsAt: params.trialEndsAt ?? null,
    origem: { ...params.origem, provisioning_source: "super_admin" },
  });
}
