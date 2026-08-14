import { createClient } from "@supabase/supabase-js";
import { createFileRoute } from "@tanstack/react-router";
import { enqueueTransactionalEmail } from "@/lib/email-templates/enqueue";

// Fase C — solicitação de código de verificação (OTP) pra assinatura
// eletrônica de contrato. Roda como rota de servidor (Node, não Deno) porque
// o envio de e-mail precisa de enqueueTransactionalEmail (@react-email/
// components), que não roda no runtime Deno da Edge Function
// crm-documento-publico. A resolução de token/estado/rate-limit segue
// exatamente o mesmo idioma daquela Edge Function (token_hash, nunca o
// token bruto persistido; mesma mensagem genérica de erro).
//
// Segurança: o código OTP bruto nunca é logado nem incluído no
// idempotencyKey — só passa em memória daqui até o corpo do e-mail.

const MAX_SOLICITAR_POR_TOKEN = 3;
const JANELA_SOLICITAR_MINUTOS = 15;

function genericError() {
  return Response.json({ error: "Não foi possível gerar o código. Tente novamente mais tarde." }, { status: 400 });
}

function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return "***";
  return `${user.slice(0, 1)}***@${domain}`;
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const Route = createFileRoute("/documento/otp/solicitar")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !supabaseServiceKey) {
          console.error("Missing required environment variables");
          return Response.json({ error: "Server configuration error" }, { status: 500 });
        }

        let body: any;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Corpo da requisição inválido." }, { status: 400 });
        }

        const token = typeof body.token === "string" ? body.token.trim() : "";
        if (!token || token.length < 16) return genericError();

        const admin = createClient(supabaseUrl, supabaseServiceKey);
        const tokenHash = await sha256Hex(token);

        // Rate limit por token_hash — só solicitar (mais restrito que verificar).
        const desde = new Date(Date.now() - JANELA_SOLICITAR_MINUTOS * 60 * 1000).toISOString();
        const { count } = await admin
          .from("crm_assinatura_otp_tentativas")
          .select("id", { count: "exact", head: true })
          .eq("token_hash", tokenHash)
          .eq("tipo", "solicitar")
          .gte("created_at", desde);
        if ((count ?? 0) >= MAX_SOLICITAR_POR_TOKEN) {
          return Response.json({ error: "Muitas tentativas. Tente novamente mais tarde." }, { status: 429 });
        }
        const { error: logError } = await admin.from("crm_assinatura_otp_tentativas").insert({ token_hash: tokenHash, tipo: "solicitar" });
        if (logError) console.error("Failed to log OTP solicitar attempt", logError);

        const { data: link, error: linkError } = await admin
          .from("crm_documentos_links")
          .select("id, empresa_id, tipo, contrato_id, expira_em, revogado_em")
          .eq("token_hash", tokenHash)
          .maybeSingle();
        if (linkError || !link || link.tipo !== "contrato" || link.revogado_em !== null || new Date(link.expira_em).getTime() < Date.now()) {
          return genericError();
        }

        const { data: contrato, error: contratoError } = await admin
          .from("crm_contratos")
          .select("id, empresa_id, assinatura_email_solicitado")
          .eq("id", link.contrato_id)
          .maybeSingle();
        if (contratoError || !contrato || !contrato.assinatura_email_solicitado) return genericError();

        const { data: codigo, error: rpcError } = await admin.rpc("crm_solicitar_otp_assinatura", {
          p_contrato_id: contrato.id,
        });
        if (rpcError || !codigo) {
          console.error("Falha ao gerar OTP de assinatura", rpcError);
          return genericError();
        }

        const { data: config } = await admin
          .from("configuracoes")
          .select("nome_empresa")
          .eq("empresa_id", contrato.empresa_id)
          .maybeSingle();

        const emailResult = await enqueueTransactionalEmail({
          supabase: admin,
          templateName: "contrato-codigo-verificacao",
          recipientEmail: contrato.assinatura_email_solicitado,
          templateData: { codigo, consultoria_nome: config?.nome_empresa || "sua consultoria" },
          idempotencyKey: crypto.randomUUID(),
        });
        if (!emailResult.success && emailResult.reason !== "email_suppressed") {
          console.error("Falha ao enfileirar e-mail de código de verificação", emailResult.reason);
          return genericError();
        }

        return Response.json({ success: true, emailMascarado: maskEmail(contrato.assinatura_email_solicitado) });
      },
    },
  },
});
