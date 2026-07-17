import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { provisionTrialTenant } from "../_shared/tenant-provisioning.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Endpoint AUTENTICADO — chamado por /concluir-cadastro, quando um usuário
// clicou num magic link (prova de controle da conta) e chegou logado, mas
// ainda sem profile/empresa. Nunca aceita um ownerId do corpo da
// requisição: sempre resolve via o Bearer token verificado.
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await admin.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Sessão inválida." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Corpo da requisição inválido." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const nomeCompleto = typeof body.nomeCompleto === "string" ? body.nomeCompleto.trim() : "";
    const whatsapp = typeof body.whatsapp === "string" ? body.whatsapp.trim() : "";
    const empresaNome = typeof body.empresaNome === "string" ? body.empresaNome.trim() : "";

    if (nomeCompleto.length < 2) {
      return new Response(JSON.stringify({ error: "Nome completo é obrigatório." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }
    if (empresaNome.length < 2) {
      return new Response(JSON.stringify({ error: "Nome da empresa é obrigatório." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const provisioned = await provisionTrialTenant(admin, {
      ownerId: user.id, // sempre do token verificado, nunca do body
      ownerEmail: user.email ?? "",
      empresaNome,
      ownerNome: nomeCompleto,
      whatsapp,
      origem: { completed_via: "concluir-cadastro" },
    });

    if (provisioned.status === "inconsistent_state") {
      await admin.from("audit_log").insert({
        empresa_id: provisioned.empresaId,
        actor_id: user.id,
        event_type: "signup_inconsistent_state",
        metadata: { via: "complete-provisioning" },
      });
      return new Response(
        JSON.stringify({
          error: "Não foi possível concluir seu cadastro. Nossa equipe foi notificada — fale com o suporte.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
      );
    }

    return new Response(JSON.stringify({ success: true, empresaId: provisioned.empresaId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("Erro inesperado em complete-provisioning", err);
    return new Response(JSON.stringify({ error: "Não foi possível concluir o cadastro. Tente novamente." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
