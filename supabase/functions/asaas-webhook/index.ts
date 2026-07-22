import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { provisionPaidTenant } from "../_shared/tenant-provisioning.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, asaas-access-token",
};

// Fonte de verdade financeira. Só service_role escreve em saas_pagamentos/
// saas_assinaturas/empresas — nenhuma dessas escritas é alcançável por um
// usuário autenticado comum. Autenticação do webhook: header
// asaas-access-token comparado contra ASAAS_WEBHOOK_TOKEN (configurado na
// criação do Webhook no painel Asaas com o mesmo valor).

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type AdminClient = ReturnType<typeof createClient>;

interface AsaasPayment {
  id: string;
  value: number;
  billingType: string;
  status: string;
  externalReference: string | null;
  subscription: string | null;
  installment: string | null;
  paymentDate: string | null;
  invoiceUrl: string | null;
}

function periodoFim(periodicidade: string, inicio: Date): Date {
  const fim = new Date(inicio);
  if (periodicidade === "mensal") fim.setMonth(fim.getMonth() + 1);
  else fim.setFullYear(fim.getFullYear() + 1); // anual = 12 meses de acesso
  return fim;
}

async function enqueuePagamentoConfirmadoEmail(admin: AdminClient, email: string, nome: string) {
  const safeName = (nome || "Olá").replace(/[<>&"]/g, "");
  const messageId = crypto.randomUUID();
  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5; padding: 24px;">
      <h1 style="font-size: 22px; margin: 0 0 16px;">Pagamento confirmado</h1>
      <p>${safeName}, seu pagamento foi confirmado e sua conta no RDCheck já está liberada.</p>
      <p>Acesse <a href="https://app.elevareconsultoria.com/login">app.elevareconsultoria.com</a> para começar.</p>
    </div>
  `;
  const { error: logError } = await admin.from("email_send_log").insert({
    message_id: messageId,
    template_name: "pagamento_confirmado",
    recipient_email: email,
    status: "pending",
  });
  if (logError) console.error("Failed to log pagamento_confirmado email", logError);

  const { error } = await admin.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      message_id: messageId,
      to: email,
      from: "RDCheck <noreply@notify.elevareconsultoria.com>",
      sender_domain: "notify.elevareconsultoria.com",
      subject: "Pagamento confirmado — RDCheck",
      html,
      text: `${safeName}, seu pagamento foi confirmado. Acesse https://app.elevareconsultoria.com/login`,
      purpose: "transactional",
      label: "pagamento_confirmado",
      queued_at: new Date().toISOString(),
      idempotency_key: messageId,
      unsubscribe_token: messageId,
    },
  });
  if (error) {
    await admin.from("email_send_log").insert({
      message_id: messageId,
      template_name: "pagamento_confirmado",
      recipient_email: email,
      status: "failed",
      error_message: error.message,
    });
  }
}

// Correlaciona o pagamento com uma intenção de checkout local. Primeiro
// via externalReference (campo que definimos na criação do Checkout —
// Asaas documenta como a referência recomendada pra reconciliar o evento
// com o pedido original, e a usamos assim). Se não bater (ex: cobrança
// de renovação mensal gerada pela assinatura, que pode não repetir o
// externalReference original), cai pro fallback via provider_subscription_id,
// que aponta direto pra assinatura local já criada no primeiro pagamento.
async function resolverIntencao(admin: AdminClient, payment: AsaasPayment) {
  if (payment.externalReference) {
    const { data } = await admin
      .from("saas_checkout_intencoes")
      .select("*")
      .eq("id", payment.externalReference)
      .maybeSingle();
    if (data) return data;
  }
  if (payment.subscription) {
    const { data } = await admin
      .from("saas_assinaturas")
      .select("checkout_intencao_id")
      .eq("provider_subscription_id", payment.subscription)
      .maybeSingle();
    if (data?.checkout_intencao_id) {
      const { data: intencao } = await admin
        .from("saas_checkout_intencoes")
        .select("*")
        .eq("id", data.checkout_intencao_id)
        .maybeSingle();
      if (intencao) return intencao;
    }
  }
  return null;
}

// Núcleo da Fase 4/6: nunca confia cegamente no payload — sempre resolve
// a intenção local antes de agir, e todo o resto (empresa, plano,
// valores) vem do banco, não do payload.
async function ativarPagamento(admin: AdminClient, payment: AsaasPayment) {
  const intencao = await resolverIntencao(admin, payment);
  if (!intencao) {
    throw new Error(
      `Pagamento ${payment.id} sem correlação possível (externalReference=${payment.externalReference}, subscription=${payment.subscription}).`,
    );
  }

  // Idempotência: se este pagamento específico já foi processado, só
  // garante o status atualizado e não repete provisionamento/e-mail.
  const { data: pagamentoExistente } = await admin
    .from("saas_pagamentos")
    .select("id, status")
    .eq("provider", "asaas")
    .eq("provider_payment_id", payment.id)
    .maybeSingle();
  const jaProcessado = pagamentoExistente && ["confirmado", "recebido"].includes(pagamentoExistente.status);

  const origem = (intencao.origem ?? {}) as Record<string, unknown>;

  // Resolve o tenant: reaproveita se o profile já existe (upgrade de
  // trial, ou reprocessamento) — nunca provisiona um novo tenant pra
  // quem já tem um.
  const { data: profileExistente } = await admin
    .from("profiles")
    .select("empresa_id")
    .eq("id", intencao.auth_user_id)
    .maybeSingle();

  let empresaId: string | null = profileExistente?.empresa_id ?? null;

  if (!empresaId) {
    const provisioned = await provisionPaidTenant(admin, {
      ownerId: intencao.auth_user_id,
      ownerEmail: intencao.email,
      empresaNome: typeof origem.empresa_nome === "string" ? origem.empresa_nome : "Empresa RDCheck",
      ownerNome: typeof origem.owner_nome === "string" ? origem.owner_nome : intencao.email,
      whatsapp: typeof origem.whatsapp === "string" ? origem.whatsapp : "",
      origem: { checkout_intencao_id: intencao.id, asaas_payment_id: payment.id },
    });
    if (provisioned.status === "inconsistent_state") {
      throw new Error(`provision_tenant retornou inconsistent_state pra intenção ${intencao.id}`);
    }
    empresaId = provisioned.empresaId;
  } else {
    // Upgrade de trial (ou qualquer mudança de plano associada a esta
    // intenção): tenant já existe, só muda de plano/status.
    const { error: empresaUpdateErr } = await admin
      .from("empresas")
      .update({ plano: "pro", status: "ativo" })
      .eq("id", empresaId);
    if (empresaUpdateErr) throw empresaUpdateErr;
  }
  if (!empresaId) throw new Error("Falha ao resolver empresa_id após provisionamento.");

  const agora = new Date();
  const periodoInicio = agora;
  const periodoFimData = periodoFim(intencao.periodicidade, agora);

  // Upsert de saas_assinaturas por EMPRESA (não por checkout_intencao_id):
  // uma empresa só pode ter uma linha "viva" por vez (índice único parcial
  // em saas_assinaturas_ativa_por_empresa_idx) — reaproveitar a linha
  // existente (seja a trial expirando num upgrade, seja a mensal/anual
  // numa renovação) evita colidir com esse índice e violar silenciosamente
  // a constraint numa segunda linha nunca seria criada mesmo.
  const { data: assinaturaAtual } = await admin
    .from("saas_assinaturas")
    .select("id")
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (assinaturaAtual) {
    const { error: assinaturaUpdateErr } = await admin
      .from("saas_assinaturas")
      .update({
        checkout_intencao_id: intencao.id,
        plano_codigo: intencao.plano_codigo,
        periodicidade: intencao.periodicidade,
        status: "active",
        current_period_start: periodoInicio.toISOString(),
        current_period_end: periodoFimData.toISOString(),
        provider_subscription_id: payment.subscription ?? undefined,
        past_due_since: null,
        blocked_at: null,
        canceled_at: null,
      })
      .eq("id", assinaturaAtual.id);
    if (assinaturaUpdateErr) throw assinaturaUpdateErr;
  } else {
    const { error: assinaturaInsertErr } = await admin.from("saas_assinaturas").insert({
      empresa_id: empresaId,
      owner_id: intencao.auth_user_id,
      checkout_intencao_id: intencao.id,
      plano_codigo: intencao.plano_codigo,
      periodicidade: intencao.periodicidade,
      provider: "asaas",
      provider_subscription_id: payment.subscription,
      status: "active",
      current_period_start: periodoInicio.toISOString(),
      current_period_end: periodoFimData.toISOString(),
    });
    if (assinaturaInsertErr) throw assinaturaInsertErr;
  }

  // valor_base = preço de tabela do plano (referência); valor_cobrado =
  // o que essa transação específica cobrou (pode ser uma parcela, no
  // caso do anual parcelado — não o valor total do plano).
  const { data: limites } = await admin
    .from("saas_plano_limites")
    .select("limite_key, valor, saas_planos!inner(codigo)")
    .eq("saas_planos.codigo", intencao.plano_codigo)
    .in("limite_key", ["preco_mensal", "preco_anual"]);
  const valorBase =
    intencao.periodicidade === "mensal"
      ? limites?.find((l) => l.limite_key === "preco_mensal")?.valor
      : limites?.find((l) => l.limite_key === "preco_anual")?.valor;

  // Upsert de saas_pagamentos por (provider, provider_payment_id).
  const statusPagamento = payment.status === "RECEIVED" ? "recebido" : "confirmado";
  const pagamentoRow = {
    empresa_id: empresaId,
    checkout_intencao_id: intencao.id,
    provider: "asaas",
    provider_payment_id: payment.id,
    valor_base: valorBase ?? payment.value,
    valor_cobrado: payment.value,
    forma_pagamento: payment.billingType,
    parcelas: 1,
    status: statusPagamento,
    paid_at: payment.paymentDate ?? agora.toISOString(),
    invoice_url: payment.invoiceUrl,
  };
  if (pagamentoExistente) {
    const { error } = await admin.from("saas_pagamentos").update(pagamentoRow).eq("id", pagamentoExistente.id);
    if (error) throw error;
  } else {
    const { error } = await admin.from("saas_pagamentos").insert(pagamentoRow);
    if (error) throw error;
  }

  if (intencao.status !== "pago") {
    const { error } = await admin.from("saas_checkout_intencoes").update({ status: "pago" }).eq("id", intencao.id);
    if (error) throw error;
  }

  if (!jaProcessado) {
    await admin.from("audit_log").insert({
      empresa_id: empresaId,
      actor_id: intencao.auth_user_id,
      event_type: "pagamento_confirmado",
      metadata: { provider: "asaas", payment_id: payment.id, periodicidade: intencao.periodicidade, valor: payment.value },
    });
    await enqueuePagamentoConfirmadoEmail(
      admin,
      intencao.email,
      typeof origem.owner_nome === "string" ? origem.owner_nome : intencao.email,
    );
  }
}

async function marcarPagamentoStatus(admin: AdminClient, payment: AsaasPayment, status: string) {
  await admin
    .from("saas_pagamentos")
    .update({ status })
    .eq("provider", "asaas")
    .eq("provider_payment_id", payment.id);
}

// Dispara a contagem de inadimplência (Fase 6). Só marca past_due_since
// na primeira vez que uma cobrança desta assinatura vence sem pagar — o
// cron (20260802100000) é quem observa essa data e move status adiante
// nos dias 7/15. Se não achar a assinatura (evento não correlacionável),
// só loga o pagamento como atrasado — não é motivo pra falhar o webhook.
async function marcarAtrasado(admin: AdminClient, payment: AsaasPayment) {
  await marcarPagamentoStatus(admin, payment, "atrasado");

  const intencao = await resolverIntencao(admin, payment);
  if (!intencao) return;

  const { data: assinatura } = await admin
    .from("saas_assinaturas")
    .select("id, past_due_since")
    .eq("checkout_intencao_id", intencao.id)
    .maybeSingle();
  if (assinatura && !assinatura.past_due_since) {
    await admin.from("saas_assinaturas").update({ past_due_since: new Date().toISOString() }).eq("id", assinatura.id);
  }
}

async function marcarAssinaturaCancelada(admin: AdminClient, subscriptionId: string) {
  await admin
    .from("saas_assinaturas")
    .update({ status: "canceled", canceled_at: new Date().toISOString() })
    .eq("provider_subscription_id", subscriptionId)
    .neq("status", "canceled");
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
  let body: { event?: string; payment?: AsaasPayment; subscription?: { id: string } };
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
    switch (eventType) {
      case "PAYMENT_CONFIRMED":
      case "PAYMENT_RECEIVED":
        if (!body.payment) throw new Error("Evento de pagamento sem objeto payment.");
        await ativarPagamento(admin, body.payment);
        break;
      case "PAYMENT_OVERDUE":
        if (body.payment) await marcarAtrasado(admin, body.payment);
        break;
      case "PAYMENT_REFUNDED":
      case "PAYMENT_PARTIALLY_REFUNDED":
        if (body.payment) await marcarPagamentoStatus(admin, body.payment, "estornado");
        break;
      case "PAYMENT_CHARGEBACK_REQUESTED":
        if (body.payment) await marcarPagamentoStatus(admin, body.payment, "chargeback");
        break;
      case "PAYMENT_DELETED":
        if (body.payment) await marcarPagamentoStatus(admin, body.payment, "cancelado");
        break;
      case "SUBSCRIPTION_DELETED":
        if (body.subscription?.id) await marcarAssinaturaCancelada(admin, body.subscription.id);
        break;
      default:
        // Evento reconhecido pelo Asaas mas sem ação mapeada nesta fase
        // (ex: eventos de assinatura fora do fluxo de ativação, split,
        // etc.) — registrado como ignorado, não é erro.
        break;
    }

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
