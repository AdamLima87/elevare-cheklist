import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { processarEventoAsaas, type AsaasWebhookBody } from "../_shared/asaas-event-processor.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

// Endpoint AUTENTICADO, só super_admin — botão "Reprocessar" da tela
// Plataforma → Cobranças. Roda exatamente a mesma lógica do webhook
// (_shared/asaas-event-processor.ts) sobre o payload já armazenado, sem
// depender do Asaas reenviar nada.
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonError("Não autenticado.", 401);
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await admin.auth.getUser(token);
    if (userError || !user) return jsonError("Sessão inválida.", 401);

    const { data: profile } = await admin.from("profiles").select("perfil").eq("id", user.id).maybeSingle();
    if (profile?.perfil !== "super_admin") return jsonError("Acesso restrito à administração da plataforma.", 403);

    const { eventoId } = (await req.json().catch(() => ({}))) as { eventoId?: string };
    if (!eventoId) return jsonError("eventoId é obrigatório.", 400);

    const { data: evento, error: eventoError } = await admin
      .from("saas_webhook_eventos")
      .select("id, event_type, payload")
      .eq("id", eventoId)
      .maybeSingle();
    if (eventoError || !evento) return jsonError("Evento não encontrado.", 404);

    try {
      await processarEventoAsaas(admin, evento.event_type, evento.payload as AsaasWebhookBody);
      await admin
        .from("saas_webhook_eventos")
        .update({ status: "processado", processed_at: new Date().toISOString(), error: null })
        .eq("id", eventoId);

      await admin.from("audit_log").insert({
        actor_id: user.id,
        event_type: "webhook_evento_reprocessado",
        metadata: { evento_id: eventoId, event_type: evento.event_type, resultado: "sucesso" },
      });

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } catch (processErr) {
      const message = processErr instanceof Error ? processErr.message : String(processErr);
      await admin.from("saas_webhook_eventos").update({ status: "erro", error: message }).eq("id", eventoId);
      await admin.from("audit_log").insert({
        actor_id: user.id,
        event_type: "webhook_evento_reprocessado",
        metadata: { evento_id: eventoId, event_type: evento.event_type, resultado: "erro", erro: message },
      });
      return jsonError(`Falha ao reprocessar: ${message}`, 500);
    }
  } catch (err) {
    console.error("Erro inesperado em reprocessar-webhook-evento", err);
    return jsonError("Não foi possível reprocessar o evento.", 500);
  }
});
