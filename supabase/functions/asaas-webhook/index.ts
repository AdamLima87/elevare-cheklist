import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { processarEventoAsaas, type AsaasWebhookBody } from "../_shared/asaas-event-processor.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, asaas-access-token",
};

// Fonte de verdade financeira. Só service_role escreve em saas_pagamentos/
// saas_assinaturas/empresas — nenhuma dessas escritas é alcançável por um
// usuário autenticado comum. Autenticação do webhook: header
// asaas-access-token comparado contra ASAAS_WEBHOOK_TOKEN (configurado na
// criação do Webhook no painel Asaas com o mesmo valor). A lógica de
// processamento de cada tipo de evento mora em _shared/asaas-event-
// processor.ts, compartilhada com o reprocessamento manual (Fase 8).

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

  const expectedToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
  const receivedToken = req.headers.get("asaas-access-token");
  if (!expectedToken || receivedToken !== expectedToken) {
    return new Response(JSON.stringify({ error: "Token inválido." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 401,
    });
  }

  const rawBody = await req.text();
  let body: AsaasWebhookBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: "Payload inválido." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }

  const eventType = body.event ?? "UNKNOWN";
  const payloadHash = await sha256Hex(rawBody);

  const { data: existingEvento } = await admin
    .from("saas_webhook_eventos")
    .select("id, status")
    .eq("payload_hash", payloadHash)
    .maybeSingle();

  let eventoId: string;
  if (existingEvento) {
    if (existingEvento.status === "processado") {
      // Reentrega exata de um evento já processado — confirma 200 sem
      // repetir nenhum efeito colateral.
      return new Response(JSON.stringify({ ok: true, deduplicated: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    eventoId = existingEvento.id;
  } else {
    const { data: inserted, error: insertErr } = await admin
      .from("saas_webhook_eventos")
      .insert({ provider: "asaas", event_type: eventType, payload: body, payload_hash: payloadHash, status: "recebido" })
      .select("id")
      .single();
    if (insertErr || !inserted) {
      console.error("Falha ao registrar webhook_evento", insertErr);
      return new Response(JSON.stringify({ error: "Falha ao registrar evento." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }
    eventoId = inserted.id;
  }

  try {
    await processarEventoAsaas(admin, eventType, body);

    await admin
      .from("saas_webhook_eventos")
      .update({ status: "processado", processed_at: new Date().toISOString(), error: null })
      .eq("id", eventoId);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Erro ao processar webhook Asaas", eventType, message);
    await admin
      .from("saas_webhook_eventos")
      .update({ status: "erro", error: message })
      .eq("id", eventoId);
    // 500 proposital: o Asaas reenvia em retry, e o reprocessamento é
    // seguro (idempotente) pela lógica acima.
    return new Response(JSON.stringify({ error: "Falha ao processar evento." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
