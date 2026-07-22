import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAppUrl } from "../_shared/app-url.ts";
import { billingProvider, CHECKOUT_MINUTES_TO_EXPIRE } from "../_shared/billing-provider.ts";

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

// Endpoint AUTENTICADO — chamado por /pagamento/pendente. Resolve tudo
// (dono, plano, preço) a partir do token verificado e do banco; o corpo
// da requisição não carrega nada que decida preço, plano ou identidade.
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

    const { data: intencao, error: intencaoError } = await admin
      .from("saas_checkout_intencoes")
      .select("id, plano_codigo, periodicidade, provider_checkout_id, checkout_url, status, updated_at, origem")
      .eq("auth_user_id", user.id)
      .in("status", ["pendente", "aguardando_pagamento"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (intencaoError || !intencao) {
      return jsonError("Nenhuma contratação pendente encontrada para esta conta.", 404);
    }

    // Reaproveita a sessão de checkout existente enquanto ainda estiver
    // dentro da janela de validade do Asaas — evita criar uma sessão nova
    // a cada refresh da página, e mantém o link que o usuário já pode ter
    // aberto em outra aba.
    const bufferMinutos = 5;
    const aindaValido =
      intencao.checkout_url &&
      new Date(intencao.updated_at).getTime() > Date.now() - (CHECKOUT_MINUTES_TO_EXPIRE - bufferMinutos) * 60_000;
    if (aindaValido) {
      return new Response(JSON.stringify({ checkoutUrl: intencao.checkout_url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const { data: limites, error: limitesError } = await admin
      .from("saas_plano_limites")
      .select("limite_key, valor, saas_planos!inner(codigo)")
      .eq("saas_planos.codigo", intencao.plano_codigo)
      .in("limite_key", ["preco_mensal", "preco_anual"]);
    if (limitesError || !limites) return jsonError("Não foi possível resolver o preço do plano.", 500);

    const precoMensal = limites.find((l) => l.limite_key === "preco_mensal")?.valor;
    const precoAnual = limites.find((l) => l.limite_key === "preco_anual")?.valor;

    const appUrl = getAppUrl();
    const callback = {
      successUrl: `${appUrl}/pagamento/sucesso`,
      cancelUrl: `${appUrl}/pagamento/pendente`,
      expiredUrl: `${appUrl}/pagamento/falhou`,
    };

    let checkout;
    if (intencao.periodicidade === "mensal") {
      if (typeof precoMensal !== "number") return jsonError("Preço do plano mensal não configurado.", 500);
      checkout = await billingProvider.createMonthlyCheckout({
        valorMensal: precoMensal,
        externalReference: intencao.id,
        callback,
      });
    } else if (intencao.periodicidade === "anual") {
      if (typeof precoAnual !== "number") return jsonError("Preço do plano anual não configurado.", 500);
      checkout = await billingProvider.createAnnualCheckout({
        valorAnual: precoAnual,
        maxParcelas: 10,
        externalReference: intencao.id,
        callback,
      });
    } else {
      return jsonError("Periodicidade da intenção de checkout inválida.", 500);
    }

    const { error: updateError } = await admin
      .from("saas_checkout_intencoes")
      .update({
        provider_checkout_id: checkout.providerCheckoutId,
        checkout_url: checkout.checkoutUrl,
        status: "aguardando_pagamento",
      })
      .eq("id", intencao.id);
    if (updateError) return jsonError("Checkout criado, mas não foi possível salvar. Tente novamente.", 500);

    return new Response(JSON.stringify({ checkoutUrl: checkout.checkoutUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("Erro inesperado em criar-checkout", err);
    return jsonError(`DEBUG: ${err instanceof Error ? err.message : String(err)}`, 500);
  }
});
