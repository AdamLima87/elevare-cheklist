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
export function provisionTrialTenant(
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
  return provisionTenant(admin, {
    ...params,
    plano: "trial",
    status: "ativo",
    trialEndsAt,
    origem: { ...params.origem, provisioning_source: "public_signup" },
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
