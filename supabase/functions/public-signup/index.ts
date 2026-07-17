import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAppUrl } from "../_shared/app-url.ts";
import { verifyCaptcha } from "../_shared/captcha.ts";
import { checkSignupRateLimit, getClientIp, logSignupAttempt } from "../_shared/rate-limit.ts";
import { lookupSignupState, type SignupState } from "../_shared/signup-lookup.ts";
import { provisionTrialTenant } from "../_shared/tenant-provisioning.ts";
import { resendSignupConfirmation } from "../_shared/resend-confirmation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Endpoint público — sem exigir Bearer token. É a ÚNICA superfície de
// escrita deste sistema alcançável por um visitante anônimo; toda a
// lógica administrativa continua isolada em admin-manage-users (que
// segue exigindo autenticação em todas as ações exceto forgot_password).

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

function genericError(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

function successPending() {
  return jsonResponse({ success: true, email_status: "pending" });
}

function successSent() {
  return jsonResponse({ success: true, email_status: "sent" });
}

async function enqueueConfirmationEmail(
  admin: ReturnType<typeof createClient>,
  email: string,
  nome: string,
  actionLink: string,
) {
  const safeName = escapeHtml(nome || "Olá");
  const messageId = crypto.randomUUID();
  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5; padding: 24px;">
      <h1 style="font-size: 22px; margin: 0 0 16px;">Confirme seu cadastro</h1>
      <p>${safeName}, falta só um passo para começar a usar o RDCheck.</p>
      <p>
        <a href="${actionLink}" style="display: inline-block; background: #184878; color: #ffffff; padding: 12px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">
          Confirmar e-mail
        </a>
      </p>
      <p style="font-size: 12px; color: #6b7280; margin-top: 24px;">Se você não fez esse cadastro, ignore este e-mail.</p>
    </div>
  `;
  const text = `${nome || "Olá"}, confirme seu cadastro no RDCheck: ${actionLink}`;

  const { error: logError } = await admin.from("email_send_log").insert({
    message_id: messageId,
    template_name: "signup_confirmation",
    recipient_email: email,
    status: "pending",
  });
  if (logError) console.error("Failed to log signup confirmation email", logError);

  const { error } = await admin.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      message_id: messageId,
      to: email,
      from: "RDCheck <noreply@notify.elevareconsultoria.com>",
      sender_domain: "notify.elevareconsultoria.com",
      subject: "Confirme seu cadastro no RDCheck",
      html,
      text,
      purpose: "transactional",
      label: "signup_confirmation",
      queued_at: new Date().toISOString(),
      idempotency_key: messageId,
      unsubscribe_token: messageId,
    },
  });

  if (error) {
    await admin.from("email_send_log").insert({
      message_id: messageId,
      template_name: "signup_confirmation",
      recipient_email: email,
      status: "failed",
      error_message: error.message,
    });
    throw error;
  }
}

function normalizeEmail(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !trimmed.includes("@")) return null;
  return trimmed;
}

function isUserAlreadyExistsError(message: string | undefined): boolean {
  if (!message) return false;
  return message.includes("already been registered") || message.includes("already registered");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const ip = getClientIp(req);
  let email = "";

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return genericError("Corpo da requisição inválido.");
    }

    // Honeypot: bots preenchem campos ocultos que humanos nunca veem.
    // Resposta de sucesso fake, sem fazer nada de verdade.
    if (typeof body.website === "string" && body.website.trim() !== "") {
      return successSent();
    }

    const normalizedEmail = normalizeEmail(body.email);
    const nomeCompleto = typeof body.nomeCompleto === "string" ? body.nomeCompleto.trim() : "";
    const whatsapp = typeof body.whatsapp === "string" ? body.whatsapp.trim() : "";
    const empresaNome = typeof body.empresaNome === "string" ? body.empresaNome.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const utm = typeof body.utm === "object" && body.utm !== null ? body.utm : {};

    if (!normalizedEmail) return genericError("E-mail inválido.");
    email = normalizedEmail;
    if (nomeCompleto.length < 2) return genericError("Nome completo é obrigatório.");
    if (empresaNome.length < 2) return genericError("Nome da empresa é obrigatório.");
    if (password.length < 8) return genericError("A senha precisa ter pelo menos 8 caracteres.");

    const rateLimit = await checkSignupRateLimit(admin, ip, email);
    if (!rateLimit.allowed) {
      await logSignupAttempt(admin, { ip, email, success: false, reason: rateLimit.reason! });
      return genericError("Muitas tentativas. Tente novamente mais tarde.", 429);
    }

    const captchaOk = await verifyCaptcha(typeof body.captchaToken === "string" ? body.captchaToken : null);
    if (!captchaOk) {
      await logSignupAttempt(admin, { ip, email, success: false, reason: "captcha_failed" });
      return genericError("Não foi possível validar sua solicitação. Tente novamente.");
    }

    const appUrl = getAppUrl();
    let lookup = await lookupSignupState(admin, email);

    // "Já confirmado e com tenant" — nunca mexe em nada, mensagem
    // explícita (o próprio login já é enumeration-safe quanto a senha
    // errada, então direcionar aqui não abre uma superfície nova relevante
    // para este produto B2B).
    if (lookup.state === "confirmed_with_profile") {
      await logSignupAttempt(admin, { ip, email, success: false, reason: "email_exists" });
      return jsonResponse({
        success: false,
        error: "Você já tem uma conta. Faça login ou recupere sua senha.",
      });
    }

    // "Confirmado, sem profile": NUNCA provisiona a partir só do e-mail
    // informado — o endpoint público não tem como provar que quem enviou
    // este request controla essa conta. Gera magic link (a conta já está
    // confirmada) redirecionando para /concluir-cadastro (não /onboarding
    // — tenant/profile ainda não existem). Responde com a MESMA forma de
    // sucesso dos outros ramos, para não revelar que a conta já existe e
    // está incompleta.
    if (lookup.state === "confirmed_no_profile" && lookup.userId) {
      const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo: `${appUrl}/concluir-cadastro` },
      });
      const actionLink = linkData?.properties?.action_link;
      if (linkError || !actionLink) {
        await logSignupAttempt(admin, { ip, email, success: false, reason: "magiclink_failed" });
        return successPending();
      }
      try {
        await enqueueConfirmationEmail(admin, email, nomeCompleto, actionLink);
        await logSignupAttempt(admin, { ip, email, success: true, reason: "magiclink_sent" });
        return successSent();
      } catch (emailErr) {
        console.error("Falha ao enfileirar magic link", emailErr);
        await logSignupAttempt(admin, { ip, email, success: true, reason: "email_send_failed" });
        return successPending();
      }
    }

    // Se o e-mail já existe (não confirmado), pula a criação e vai direto
    // para reenvio de confirmação — sem chamar generateLink(type=signup)
    // de novo (que só é o caminho de CRIAÇÃO).
    let ownerId: string | null = lookup.userId;
    let needsProvisioning = lookup.state === "unconfirmed_no_profile";

    if (lookup.state === "new") {
      const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
        type: "signup",
        email,
        password,
        options: { redirectTo: `${appUrl}/onboarding` },
      });

      if (linkError) {
        // Corrida: outra requisição criou o usuário entre o lookup acima e
        // esta chamada. Não trata como erro — refaz o lookup e segue pelo
        // estado atual, em vez de responder erro genérico/pending.
        if (!isUserAlreadyExistsError(linkError.message)) {
          await logSignupAttempt(admin, { ip, email, success: false, reason: "generate_link_failed" });
          return genericError("Não foi possível concluir o cadastro. Tente novamente.", 500);
        }
        lookup = await lookupSignupState(admin, email);
        ownerId = lookup.userId;
        needsProvisioning = lookup.state === "unconfirmed_no_profile";
        // Cai para o bloco de reenvio abaixo (fora deste if).
      } else if (linkData?.user?.id) {
        ownerId = linkData.user.id;
        const provisioned = await provisionTrialTenant(admin, {
          ownerId,
          ownerEmail: email,
          empresaNome,
          ownerNome: nomeCompleto,
          whatsapp,
          origem: { utm, ip },
        });

        if (provisioned.status === "inconsistent_state") {
          await admin.from("audit_log").insert({
            empresa_id: provisioned.empresaId,
            actor_id: ownerId,
            event_type: "signup_inconsistent_state",
            metadata: { email },
          });
          await logSignupAttempt(admin, { ip, email, success: false, reason: "inconsistent_state" });
          return genericError(
            "Não foi possível concluir seu cadastro. Nossa equipe foi notificada — tente novamente em alguns minutos ou fale com o suporte.",
            500,
          );
        }
        if (provisioned.status !== "created" && provisioned.status !== "already_provisioned") {
          await logSignupAttempt(admin, { ip, email, success: false, reason: "unexpected_provision_status" });
          return genericError("Não foi possível concluir o cadastro. Tente novamente.", 500);
        }

        const actionLink = linkData.properties?.action_link;
        if (!actionLink) {
          await logSignupAttempt(admin, { ip, email, success: true, reason: "provisioned_no_link" });
          return successPending();
        }
        try {
          await enqueueConfirmationEmail(admin, email, nomeCompleto, actionLink);
          await logSignupAttempt(admin, { ip, email, success: true, reason: "ok" });
          return successSent();
        } catch (emailErr) {
          console.error("Falha ao enfileirar e-mail de confirmação", emailErr);
          await logSignupAttempt(admin, { ip, email, success: true, reason: "email_send_failed" });
          // Não desfaz o tenant — a conta é legítima, falha de e-mail não
          // deveria destruir a empresa. Front oferece reenvio.
          return successPending();
        }
      } else {
        await logSignupAttempt(admin, { ip, email, success: false, reason: "unexpected_signup_response" });
        return genericError("Não foi possível concluir o cadastro. Tente novamente.", 500);
      }
    }

    // A partir daqui: usuário não confirmado já existente (estado original
    // era unconfirmed_*, ou virou isso após resolver a corrida acima).
    if (!ownerId) {
      await logSignupAttempt(admin, { ip, email, success: false, reason: "error" });
      return genericError("Não foi possível concluir o cadastro. Tente novamente.", 500);
    }

    if (needsProvisioning) {
      const provisioned = await provisionTrialTenant(admin, {
        ownerId,
        ownerEmail: email,
        empresaNome,
        ownerNome: nomeCompleto,
        whatsapp,
        origem: { utm, ip },
      });
      if (provisioned.status === "inconsistent_state") {
        await logSignupAttempt(admin, { ip, email, success: false, reason: "inconsistent_state" });
        return genericError(
          "Não foi possível concluir seu cadastro. Nossa equipe foi notificada — tente novamente em alguns minutos ou fale com o suporte.",
          500,
        );
      }
    }
    // unconfirmed_with_profile: tenant já provisionado, só reenvia.

    const resent = await resendSignupConfirmation(admin, email, ownerId, `${appUrl}/onboarding`);
    if (!resent.ok) {
      console.error("Falha ao reenviar confirmação", resent.reason);
      await logSignupAttempt(admin, { ip, email, success: true, reason: "resend_failed" });
      return successPending();
    }

    try {
      await enqueueConfirmationEmail(admin, email, nomeCompleto, resent.actionLink);
      await logSignupAttempt(admin, { ip, email, success: true, reason: "resent" });
      return successSent();
    } catch (emailErr) {
      console.error("Falha ao enfileirar reenvio de confirmação", emailErr);
      await logSignupAttempt(admin, { ip, email, success: true, reason: "email_send_failed" });
      return successPending();
    }
  } catch (err) {
    console.error("Erro inesperado no signup público", err);
    if (email) {
      await logSignupAttempt(admin, { ip, email, success: false, reason: "error" }).catch(() => {});
    }
    return genericError("Não foi possível concluir o cadastro. Tente novamente.", 500);
  }
});
