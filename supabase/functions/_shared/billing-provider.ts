import { asaasRequest } from "./asaas-client.ts";

// Abstração de provider de pagamento — hoje só Asaas, mas isola quem
// chama (a Edge Function de checkout) da API específica do gateway.
// Só expõe o que a Fase 3 realmente usa (criação de checkout); métodos
// como cancelamento/consulta de status entram quando as fases que os
// chamam (5/6) forem implementadas — evita superfície morta agora.
//
// Usa exclusivamente o Checkout hospedado do Asaas (POST /v3/checkouts):
// o formulário de cartão roda inteiramente na página do Asaas, dados de
// cartão nunca trafegam pelo backend do RDCheck. Validado em Sandbox que
// o Checkout hospedado NÃO permite repassar juros de parcelamento ao
// comprador (decisão de produto: preço anual já embute essa margem, ver
// migration 20260801100000_saas_plano_precos.sql).

export interface CheckoutCallbackUrls {
  successUrl: string;
  cancelUrl: string;
  expiredUrl: string;
}

export interface BillingCheckout {
  providerCheckoutId: string;
  checkoutUrl: string;
}

interface AsaasCheckoutResponse {
  id: string;
  link: string;
  status: string;
}

export interface BillingProvider {
  createMonthlyCheckout(input: {
    valorMensal: number;
    externalReference: string;
    callback: CheckoutCallbackUrls;
  }): Promise<BillingCheckout>;

  createAnnualCheckout(input: {
    valorAnual: number;
    maxParcelas: number;
    externalReference: string;
    callback: CheckoutCallbackUrls;
  }): Promise<BillingCheckout>;
}

// minutesToExpire da sessão de checkout do Asaas — /pagamento/pendente
// reaproveita a mesma sessão enquanto ela ainda estiver dentro desta
// janela, e cria uma nova depois disso (ver checkout-session.ts).
export const CHECKOUT_MINUTES_TO_EXPIRE = 60;

class AsaasBillingProvider implements BillingProvider {
  async createMonthlyCheckout(input: {
    valorMensal: number;
    externalReference: string;
    callback: CheckoutCallbackUrls;
  }): Promise<BillingCheckout> {
    const nextDueDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const data = await asaasRequest<AsaasCheckoutResponse>("POST", "/checkouts", {
      billingTypes: ["CREDIT_CARD"],
      chargeTypes: ["RECURRENT"],
      minutesToExpire: CHECKOUT_MINUTES_TO_EXPIRE,
      externalReference: input.externalReference,
      callback: input.callback,
      items: [
        {
          name: "RDCheck — Plano Mensal",
          description: "Assinatura mensal do RDCheck",
          quantity: 1,
          value: input.valorMensal,
        },
      ],
      subscription: { cycle: "MONTHLY", nextDueDate },
      // Sem customerData: o RDCheck não coleta CPF/endereço no cadastro, e
      // o Asaas exige o objeto completo (CPF, endereço, CEP) se qualquer
      // campo dele for enviado. O próprio Checkout hospedado coleta os
      // dados do pagador quando customerData é omitido.
    });
    return { providerCheckoutId: data.id, checkoutUrl: data.link };
  }

  async createAnnualCheckout(input: {
    valorAnual: number;
    maxParcelas: number;
    externalReference: string;
    callback: CheckoutCallbackUrls;
  }): Promise<BillingCheckout> {
    const data = await asaasRequest<AsaasCheckoutResponse>("POST", "/checkouts", {
      billingTypes: ["CREDIT_CARD"],
      // DETACHED + INSTALLMENT juntos: o próprio Asaas mostra "à vista"
      // e "parcelar em até Nx" como opções na página de checkout dele.
      chargeTypes: ["DETACHED", "INSTALLMENT"],
      minutesToExpire: CHECKOUT_MINUTES_TO_EXPIRE,
      externalReference: input.externalReference,
      callback: input.callback,
      items: [
        {
          name: "RDCheck — Plano Anual",
          description: "Assinatura anual do RDCheck",
          quantity: 1,
          value: input.valorAnual,
        },
      ],
      installment: { maxInstallmentCount: input.maxParcelas },
    });
    return { providerCheckoutId: data.id, checkoutUrl: data.link };
  }
}

export const billingProvider: BillingProvider = new AsaasBillingProvider();
