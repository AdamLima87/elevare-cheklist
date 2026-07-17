import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type SignupState =
  | "new" // e-mail não existe em auth.users
  | "unconfirmed_no_profile" // órfão de uma tentativa anterior que falhou antes de terminar
  | "unconfirmed_with_profile" // tenant já provisionado, só falta confirmar o e-mail
  | "confirmed_with_profile" // conta completa e utilizável — não mexer
  | "confirmed_no_profile"; // confirmada mas nunca virou tenant — precisa provar controle antes de provisionar

export interface LookupResult {
  state: SignupState;
  userId: string | null;
}

// Usa a função SQL auth_user_id_by_email (lookup exato, normalizado) em
// vez do filtro solto da REST Admin API — ver justificativa na migration
// que a criou.
export async function lookupSignupState(admin: SupabaseClient, email: string): Promise<LookupResult> {
  const { data, error } = await admin.rpc("auth_user_id_by_email", { p_email: email });
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.user_id) {
    return { state: "new", userId: null };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("id", row.user_id)
    .maybeSingle();

  if (row.email_confirmed) {
    return { state: profile ? "confirmed_with_profile" : "confirmed_no_profile", userId: row.user_id };
  }
  return { state: profile ? "unconfirmed_with_profile" : "unconfirmed_no_profile", userId: row.user_id };
}
