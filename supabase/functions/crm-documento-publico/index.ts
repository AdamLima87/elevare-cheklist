import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.0";
import { checkDocumentoPublicoRateLimit, getClientIp, logDocumentoPublicoTentativa } from "../_shared/documento-publico-rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Endpoint público (sem login) que resolve um token de proposta/contrato.
// Regras de segurança obrigatórias (ver plano aprovado):
// - nunca revelar qual dos 3 motivos causou a falha (inexistente/expirado/
//   revogado) — sempre a mesma mensagem genérica, mesmo status;
// - rate limiting por IP e por token_hash;
// - registra 'documento_link_acessado' (NUNCA 'documento_visualizado' — um
//   GET só prova acesso, não leitura);
// - 'baixar' registra 'documento_pdf_baixado' à parte;
// - o PDF em si é gerado no navegador do cliente (pdf-proposta.ts/
//   pdf-contrato.ts reaproveitados) — esta function só devolve os dados.

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

function genericInvalidToken() {
  return jsonResponse({ error: "Link inválido, expirado ou revogado." }, 404);
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const ip = getClientIp(req);

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Corpo da requisição inválido." }, 400);
    }

    const token = typeof body.token === "string" ? body.token.trim() : "";
    const action = body.action === "baixar" ? "baixar" : "acessar";
    if (!token || token.length < 16) return genericInvalidToken();

    const tokenHash = await sha256Hex(token);

    const rate = await checkDocumentoPublicoRateLimit(admin, ip, tokenHash);
    if (!rate.allowed) {
      return jsonResponse({ error: "Muitas tentativas. Tente novamente mais tarde." }, 429);
    }
    await logDocumentoPublicoTentativa(admin, ip, tokenHash);

    const { data: link, error: linkError } = await admin
      .from("crm_documentos_links")
      .select("id, empresa_id, tipo, proposta_id, contrato_id, expira_em, revogado_em")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (linkError) {
      console.error("Erro ao resolver token público", linkError);
      return genericInvalidToken();
    }
    // Mesma resposta pra inexistente, expirado e revogado — nunca revelar
    // qual dos três é o motivo real.
    if (!link) return genericInvalidToken();
    if (link.revogado_em !== null) return genericInvalidToken();
    if (new Date(link.expira_em).getTime() < Date.now()) return genericInvalidToken();

    let payload: Record<string, unknown> = {};
    let crmOportunidadeId: string | null = null;
    let crmEmpresaId: string;

    if (link.tipo === "proposta") {
      const { data: proposta, error: propostaErr } = await admin
        .from("crm_propostas")
        .select("id, crm_oportunidade_id, crm_empresa_id, numero_revisao, status, valor_total")
        .eq("id", link.proposta_id)
        .single();
      if (propostaErr || !proposta) return genericInvalidToken();
      crmOportunidadeId = proposta.crm_oportunidade_id;
      crmEmpresaId = proposta.crm_empresa_id;

      const { data: itens } = await admin
        .from("crm_proposta_itens")
        .select("nome, descricao, valor, ordem")
        .eq("proposta_id", proposta.id)
        .order("ordem");
      const { data: crmEmpresa } = await admin
        .from("crm_empresas")
        .select("razao_social, nome_completo_pf, tipo_pessoa")
        .eq("id", proposta.crm_empresa_id)
        .single();
      const { data: config } = await admin
        .from("configuracoes")
        .select("nome_empresa, email_contato")
        .eq("empresa_id", link.empresa_id)
        .maybeSingle();

      payload = {
        tipo: "proposta",
        numeroRevisao: proposta.numero_revisao,
        status: proposta.status,
        valorTotal: proposta.valor_total,
        clienteNome: crmEmpresa?.tipo_pessoa === "fisica" ? crmEmpresa?.nome_completo_pf : crmEmpresa?.razao_social,
        itens: itens ?? [],
        marca: { nome: config?.nome_empresa, contato: config?.email_contato },
      };
    } else {
      const { data: contrato, error: contratoErr } = await admin
        .from("crm_contratos")
        .select(
          "id, crm_oportunidade_id, crm_empresa_id, status, dados, assinatura_email_solicitado, " +
            "assinatura_signatario_nome, assinatura_signatario_email, assinado_em, assinatura_hash_conteudo, origem_assinatura",
        )
        .eq("id", link.contrato_id)
        .single();
      if (contratoErr || !contrato) return genericInvalidToken();
      crmOportunidadeId = contrato.crm_oportunidade_id;
      crmEmpresaId = contrato.crm_empresa_id;

      const dados = contrato.dados as { cliente?: Record<string, unknown>; conteudo_renderizado?: unknown } | null;
      const clienteDados = dados?.cliente as { tipo_pessoa?: string; razao_social?: string; nome_completo_pf?: string } | undefined;
      const { data: config } = await admin
        .from("configuracoes")
        .select("nome_empresa, email_contato")
        .eq("empresa_id", link.empresa_id)
        .maybeSingle();

      // Assinatura eletrônica: só expõe um booleano + e-mail MASCARADO — o
      // e-mail completo e qualquer hash/token internos nunca vão pro client.
      const emailSolicitado = contrato.assinatura_email_solicitado as string | null;
      const emailMascarado = emailSolicitado
        ? (() => {
            const [user, domain] = emailSolicitado.split("@");
            return domain ? `${user.slice(0, 1)}***@${domain}` : "***";
          })()
        : null;

      // Depois de assinado, expõe a evidência (nome/e-mail mascarado/data-
      // hora/hash) pra qualquer um com o link — mas nunca antes disso, e
      // nunca o e-mail completo.
      const assinaturaEletronica =
        contrato.status === "assinado" && contrato.origem_assinatura === "assinatura_eletronica"
          ? {
              nome: contrato.assinatura_signatario_nome,
              emailMascarado,
              assinadoEm: contrato.assinado_em,
              hash: contrato.assinatura_hash_conteudo,
            }
          : null;

      payload = {
        tipo: "contrato",
        status: contrato.status,
        clienteNome: clienteDados?.tipo_pessoa === "fisica" ? clienteDados?.nome_completo_pf : clienteDados?.razao_social,
        secoes: dados?.conteudo_renderizado ?? [],
        marca: { nome: config?.nome_empresa, contato: config?.email_contato },
        podeAssinarEletronicamente: contrato.status === "enviado" && emailSolicitado !== null,
        emailMascarado,
        assinaturaEletronica,
      };
    }

    const eventoTipo = action === "baixar" ? "documento_pdf_baixado" : "documento_link_acessado";
    const { error: timelineError } = await admin.from("crm_timeline").insert({
      empresa_id: link.empresa_id,
      crm_empresa_id: crmEmpresaId,
      crm_oportunidade_id: crmOportunidadeId,
      origem: "sistema",
      evento_tipo: eventoTipo,
      descricao: action === "baixar" ? "PDF do documento baixado via link público." : "Link público de documento acessado.",
      metadata: { token_id: link.id },
    });
    if (timelineError) console.error("Falha ao registrar evento de timeline do link público", timelineError);

    return jsonResponse({ success: true, ...payload });
  } catch (err) {
    console.error("Erro inesperado em crm-documento-publico", err);
    return genericInvalidToken();
  }
});
