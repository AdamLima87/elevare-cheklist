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

// tipo_desconto vem sempre do banco (aplicar_cupom_checkout), nunca do
// cliente. primeiro_periodo_gratis: clamp em R$0,01 — Asaas não aceita
// cobrança de R$0 num checkout.
function aplicarDesconto(valorBase: number, tipoDesconto: string, valor: number): number {
  if (tipoDesconto === "percentual") return Math.max(0.01, Math.round(valorBase * (1 - valor / 100) * 100) / 100);
  if (tipoDesconto === "valor_fixo") return Math.max(0.01, Math.round((valorBase - valor) * 100) / 100);
  if (tipoDesconto === "primeiro_periodo_gratis") return 0.01;
  return valorBase;
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

    // Cliente no contexto do PRÓPRIO usuário (não service_role) — usado só
    // pra RPCs que dependem de auth.uid() internamente (aplicar_cupom_checkout).
    // Nunca usar pra nada que precise bypassar RLS.
    const asUser = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });

    let body: { periodicidade?: string; cupomCodigo?: string } = {};
    try {
      body = await req.json();
    } catch {
      // corpo vazio é válido (checkout de uma intenção já pendente, sem upgrade nem cupom novo)
    }

    let { data: intencao, error: intencaoError } = await admin
      .from("saas_checkout_intencoes")
      .select("id, plano_codigo, periodicidade, provider_checkout_id, checkout_url, status, updated_at, origem")
      .eq("auth_user_id", user.id)
      .in("status", ["pendente", "aguardando_pagamento"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (intencaoError) return jsonError("Erro ao buscar contratação pendente.", 500);

    // Upgrade de trial: sem intenção pendente (nunca passou pelo /cadastro
    // com plano pago), mas com plano/periodicidade explícitos no corpo —
    // usado pela tela de trial expirado. Cria a intenção agora, com os
    // dados do tenant já existente (não do formulário público).
    if (!intencao) {
      const periodicidade = body.periodicidade === "mensal" || body.periodicidade === "anual" ? body.periodicidade : null;
      if (!periodicidade) {
        return jsonError("Nenhuma contratação pendente encontrada para esta conta.", 404);
      }

      const { data: profile } = await admin
        .from("profiles")
        .select("empresa_id, nome, telefone, empresas(nome)")
        .eq("id", user.id)
        .maybeSingle();
      if (!profile?.empresa_id) return jsonError("Conta sem empresa associada.", 400);

      const { data: novaIntencao, error: novaIntencaoError } = await admin
        .from("saas_checkout_intencoes")
        .insert({
          auth_user_id: user.id,
          email: user.email ?? "",
          plano_codigo: "pro",
          periodicidade,
          origem: {
            upgrade_de_trial: true,
            empresa_nome: (profile as any).empresas?.nome ?? "",
            owner_nome: profile.nome ?? "",
            whatsapp: profile.telefone ?? "",
          },
        })
        .select("id, plano_codigo, periodicidade, provider_checkout_id, checkout_url, status, updated_at, origem")
        .single();
      if (novaIntencaoError || !novaIntencao) return jsonError("Não foi possível iniciar a contratação.", 500);
      intencao = novaIntencao;
    }

    // Reaproveita a sessão de checkout existente enquanto ainda estiver
    // dentro da janela de validade do Asaas — evita criar uma sessão nova
    // a cada refresh da página, e mantém o link que o usuário já pode ter
    // aberto em outra aba. Nunca reaproveita se um cupom novo foi enviado
    // nesta chamada — precisa recalcular o valor com o desconto.
    const bufferMinutos = 5;
    const aindaValido =
      !body.cupomCodigo &&
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

    let precoMensal = limites.find((l) => l.limite_key === "preco_mensal")?.valor;
    let precoAnual = limites.find((l) => l.limite_key === "preco_anual")?.valor;

    // Cupom: valida e RESERVA atomicamente (RPC, contexto do próprio
    // usuário). O desconto é sempre calculado aqui a partir do que o
    // banco retornou — nunca a partir de nada enviado pelo cliente.
    if (body.cupomCodigo) {
      const { data: cupomAplicado, error: cupomError } = await asUser
        .rpc("aplicar_cupom_checkout", { p_codigo: body.cupomCodigo, p_checkout_intencao_id: intencao.id })
        .single();
      if (cupomError || !cupomAplicado) {
        return jsonError(cupomError?.message || "Não foi possível aplicar o cupom.", 400);
      }
      const { out_tipo_desconto, out_valor } = cupomAplicado as { out_tipo_desconto: string; out_valor: number };
      if (typeof precoMensal === "number") precoMensal = aplicarDesconto(precoMensal, out_tipo_desconto, out_valor);
      if (typeof precoAnual === "number") precoAnual = aplicarDesconto(precoAnual, out_tipo_desconto, out_valor);
    }

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
    return jsonError("Não foi possível iniciar o pagamento. Tente novamente.", 500);
  }
});
