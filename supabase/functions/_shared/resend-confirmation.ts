import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type ResendResult =
  | { ok: true; actionLink: string; hashedToken: string }
  | { ok: false; reason: string };

/**
 * Reenvia o link de confirmação para um usuário já existente e não
 * confirmado. Depende de um comportamento hoje NÃO documentado
 * oficialmente do Supabase Auth Admin API, verificado manualmente numa
 * investigação isolada antes de implementar este fluxo: chamar
 * generateLink(type:'signup') de novo para um e-mail que já existe NÃO
 * altera a senha efetiva (a definida na primeira chamada continua válida)
 * — só reemite um novo token de confirmação. Isso pode mudar em versões
 * futuras da API sem aviso.
 *
 * Por isso, este é o ÚNICO lugar do sistema que gera uma senha
 * descartável para essa chamada — nenhuma outra parte do código replica
 * esse comportamento. A senha nunca é exposta nem reaproveitada, e depois
 * da chamada validamos que o usuário retornado tem o MESMO id esperado —
 * se algo vier diferente (ex.: a API passar a tratar isso como criação de
 * conta nova), a função falha explicitamente em vez de seguir
 * silenciosamente.
 */
export async function resendSignupConfirmation(
  admin: SupabaseClient,
  email: string,
  expectedUserId: string,
  redirectTo: string,
): Promise<ResendResult> {
  const throwawayPassword = crypto.randomUUID() + crypto.randomUUID();

  const { data, error } = await admin.auth.admin.generateLink({
    type: "signup",
    email,
    password: throwawayPassword,
    options: { redirectTo },
  });

  if (error || !data) {
    return { ok: false, reason: error?.message ?? "generateLink não retornou dados" };
  }

  if (!data.user || data.user.id !== expectedUserId) {
    return {
      ok: false,
      reason: "Comportamento inesperado da API de reenvio: id retornado não corresponde ao esperado",
    };
  }

  const actionLink = data.properties?.action_link;
  const hashedToken = data.properties?.hashed_token;
  if (!actionLink || !hashedToken) {
    return { ok: false, reason: "Resposta sem action_link/hashed_token" };
  }

  return { ok: true, actionLink, hashedToken };
}
