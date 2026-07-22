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

// Núcleo da Fase 4: correlaciona o pagamento à intenção de checkout via
// externalReference (campo que definimos na criação do Checkout — Asaas
// documenta como referência livre do lojista, propagada pro pagamento/
// assinatura gerados). Nunca confia cegamente: sempre busca a intenção
// local antes de agir, e todo o resto (empresa, plano, valores) vem do
// banco, não do payload.
async function ativarPagamento(admin: AdminClient, payment: AsaasPayment) {
  const checkoutIntencaoId = payment.externalReference;
  if (!checkoutIntencaoId) {
    throw new Error(`Pagamento ${payment.id} sem externalReference — não é possível correlacionar com nenhuma intenção de checkout.`);
  }

  const { data: intencao, error: intencaoErr } = await admin
    .from("saas_checkout_intencoes")
    .select("*")
    .eq("id", checkoutIntencaoId)
    .maybeSingle();
  if (intencaoErr) throw intencaoErr;
  if (!intencao) {
    throw new Error(`Intenção de checkout ${checkoutIntencaoId} não encontrada — referência do payload não corresponde a nenhum registro local.`);
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

  // Empresa: reaproveita se já existe uma assinatura pra esta intenção
  // (reprocessamento/segundo evento), senão provisiona agora.
  const { data: assinaturaExistente } = await admin
    .from("saas_assinaturas")
    .select("id, empresa_id")
    .eq("checkout_intencao_id", intencao.id)
    .maybeSingle();

  let empresaId = assinaturaExistente?.empresa_id ?? null;

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
  }
  if (!empresaId) throw new Error("Falha ao resolver empresa_id após provisionamento.");

  const agora = new Date();
  const periodoInicio = agora;
  const periodoFimData = periodoFim(intencao.periodicidade, agora);

  // Upsert de saas_assinaturas por checkout_intencao_id (chave natural
  // desta intenção — no máximo uma assinatura por intenção).
  if (assinaturaExistente) {
    await admin
      .from("saas_assinaturas")
      .update({
        status: "active",
        current_period_start: periodoInicio.toISOString(),
        current_period_end: periodoFimData.toISOString(),
        provider_subscription_id: payment.subscription ?? undefined,
        past_due_since: null,
        blocked_at: null,
      })
      .eq("id", assinaturaExistente.id);
  } else {
    await admin.from("saas_assinaturas").insert({
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
    await admin.from("saas_pagamentos").update(pagamentoRow).eq("id", pagamentoExistente.id);
  } else {
    await admin.from("saas_pagamentos").insert(pagamentoRow);
  }

  if (intencao.status !== "pago") {
    await admin.from("saas_checkout_intencoes").update({ status: "pago" }).eq("id", intencao.id);
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
        if (body.payment) await marcarPagamentoStatus(admin, body.payment, "atrasado");
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
