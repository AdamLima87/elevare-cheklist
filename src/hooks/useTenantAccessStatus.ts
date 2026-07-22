import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TenantAccessStatus =
  | "active"
  | "trialing"
  | "trial_expired"
  | "past_due_warning"
  | "blocked"
  | "canceled"
  | "no_subscription";

export interface TenantAccessStatusResult {
  status: TenantAccessStatus;
  plano_codigo: string | null;
  periodicidade: "mensal" | "anual" | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  past_due_since: string | null;
  dias_atraso: number | null;
  dias_para_bloqueio: number | null;
  blocked_at: string | null;
}

// Única fonte de verdade de "o tenant pode usar o sistema?" — nunca
// reimplementar essa lógica (trial/atraso/bloqueio) direto numa tela;
// sempre via get_tenant_access_status() (RPC SECURITY DEFINER).
export function useTenantAccessStatus() {
  return useQuery({
    queryKey: ["tenant-access-status"],
    queryFn: async (): Promise<TenantAccessStatusResult> => {
      const { data, error } = await supabase.rpc("get_tenant_access_status").single();
      if (error) throw error;
      return data as TenantAccessStatusResult;
    },
    staleTime: 60 * 1000,
  });
}
