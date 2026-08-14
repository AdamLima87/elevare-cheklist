import { createClient } from "@supabase/supabase-js";
import { createFileRoute } from "@tanstack/react-router";

// Fase C — verificação do código OTP + assinatura do contrato. A
// comparação do código em si acontece dentro do Postgres
// (crm_verificar_e_assinar_otp), nunca aqui em JS — esta rota só resolve o
// token, aplica rate-limit, e repassa (token→contrato, código, nome) pras
// duas RPCs (tentativa + verificar/assinar), sempre respondendo com uma
// mensagem genérica idêntica em qualquer cenário de falha.

const MAX_VERIFICAR_POR_TOKEN = 8;
const JANELA_VERIFICAR_MINUTOS = 60;

function genericError() {
  return Response.json({ error: "Código inválido ou expirado." }, { status: 400 });
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return null;
}

export const Route = createFileRoute("/documento/otp/verificar")({
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
        const codigo = typeof body.codigo === "string" ? body.codigo.trim() : "";
        const nomeSignatario = typeof body.nomeSignatario === "string" ? body.nomeSignatario.trim() : "";
        if (!token || token.length < 16 || !codigo || !nomeSignatario) return genericError();

        const admin = createClient(supabaseUrl, supabaseServiceKey);
        const tokenHash = await sha256Hex(token);

        const desde = new Date(Date.now() - JANELA_VERIFICAR_MINUTOS * 60 * 1000).toISOString();
        const { count } = await admin
          .from("crm_assinatura_otp_tentativas")
          .select("id", { count: "exact", head: true })
          .eq("token_hash", tokenHash)
          .eq("tipo", "verificar")
          .gte("created_at", desde);
        if ((count ?? 0) >= MAX_VERIFICAR_POR_TOKEN) {
          return Response.json({ error: "Muitas tentativas. Tente novamente mais tarde." }, { status: 429 });
        }
        const { error: logError } = await admin.from("crm_assinatura_otp_tentativas").insert({ token_hash: tokenHash, tipo: "verificar" });
        if (logError) console.error("Failed to log OTP verificar attempt", logError);

        const { data: link, error: linkError } = await admin
          .from("crm_documentos_links")
          .select("id, tipo, contrato_id, expira_em, revogado_em")
          .eq("token_hash", tokenHash)
          .maybeSingle();
        if (linkError || !link || link.tipo !== "contrato" || link.revogado_em !== null || new Date(link.expira_em).getTime() < Date.now()) {
          return genericError();
        }

        // Etapa 1: incrementa a tentativa em transação própria, sempre
        // commita — independe do resultado da verificação a seguir.
        const { error: tentativaError } = await admin.rpc("crm_registrar_tentativa_otp_assinatura", {
          p_contrato_id: link.contrato_id,
        });
        if (tentativaError) console.error("Falha ao registrar tentativa de OTP", tentativaError);

        // Etapa 2: verifica + assina, atomicamente, dentro do Postgres.
        const { error: verificarError } = await admin.rpc("crm_verificar_e_assinar_otp", {
          p_contrato_id: link.contrato_id,
          p_codigo: codigo,
          p_nome_signatario: nomeSignatario,
          p_ip: getClientIp(request),
          p_user_agent: request.headers.get("user-agent"),
        });
        if (verificarError) {
          return genericError();
        }

        return Response.json({ success: true });
      },
    },
  },
});
