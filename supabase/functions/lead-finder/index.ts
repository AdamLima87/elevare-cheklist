// CRM Comercial — Buscar Leads. Toda comunicação com o Google Places
// acontece aqui, nunca no browser — a chave (do RDCheck ou do tenant)
// nunca é exposta ao frontend. Actions: search, get_details, import,
// get_usage, save_credential, test_credential, remove_credential.
//
// Conformidade com os termos da Places API: `search`/`get_details` nunca
// gravam nada no banco — são leitura/exibição temporária. Só `import`
// persiste, e só o que o usuário confirmou no formulário (crm_importar_
// lead_google já garante isso no lado do banco).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { googlePlacesProvider } from "../_shared/company-search/google-places-provider.ts";
import { decryptApiKey, encryptApiKey } from "../_shared/lead-credential-crypto.ts";
import { checkLeadSearchRateLimit, logLeadSearchAttempt } from "../_shared/lead-search-rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

interface CredentialRow {
  api_key_ciphertext: string;
  api_key_iv: string;
  status: string;
  ultimo_teste_em: string | null;
}

async function resolveApiKey(
  admin: ReturnType<typeof createClient>,
  empresaId: string,
): Promise<{ apiKey: string; origem: "tenant" | "rdcheck" }> {
  const { data } = await admin
    .from("crm_leads_credenciais")
    .select("api_key_ciphertext, api_key_iv, status")
    .eq("empresa_id", empresaId)
    .maybeSingle<CredentialRow>();

  if (data?.status === "conectado") {
    const masterKey = Deno.env.get("CRM_LEADS_ENC_KEY") ?? "";
    const apiKey = await decryptApiKey(data.api_key_ciphertext, data.api_key_iv, masterKey);
    return { apiKey, origem: "tenant" };
  }

  const rdcheckKey = Deno.env.get("GOOGLE_PLACES_API_KEY") ?? "";
  if (!rdcheckKey) throw new Error("Integração com Google Places não configurada no servidor.");
  return { apiKey: rdcheckKey, origem: "rdcheck" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse("Não autenticado.", 401);

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await admin.auth.getUser(token);
    if (userError || !user) return errorResponse("Não autenticado.", 401);

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("perfil, empresa_id")
      .eq("id", user.id)
      .single();
    if (profileError || !profile?.empresa_id) return errorResponse("Usuário sem empresa associada.", 403);

    const empresaId = profile.empresa_id as string;
    const perfil = profile.perfil as string;
    const podeBuscarImportar = perfil === "admin" || perfil === "consultor" || perfil === "super_admin";
    const podeConfigurarIntegracao = perfil === "admin" || perfil === "super_admin";

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return errorResponse("Corpo da requisição inválido.");
    }
    const { action } = body;

    // --- Busca e importação (admin/consultor/super_admin) ---
    if (action === "search") {
      if (!podeBuscarImportar) return errorResponse("Sem permissão.", 403);
      const { textQuery, pageToken } = body;
      if (typeof textQuery !== "string" || !textQuery.trim()) {
        return errorResponse("Informe o que buscar (ex: restaurantes em Campinas).");
      }

      const rate = await checkLeadSearchRateLimit(admin, empresaId);
      if (!rate.allowed) return errorResponse("Muitas buscas em pouco tempo. Aguarde um minuto e tente de novo.", 429);
      await logLeadSearchAttempt(admin, empresaId);

      const { apiKey } = await resolveApiKey(admin, empresaId);
      const result = await googlePlacesProvider.search(
        { textQuery: textQuery.trim(), pageToken: typeof pageToken === "string" ? pageToken : undefined },
        apiKey,
      );

      // "Já está no CRM": marca os place_ids já importados neste tenant,
      // sem gravar nada novo — só uma consulta de leitura.
      const placeIds = result.resultados.map((r) => r.placeId);
      const { data: existentes } = await admin
        .from("crm_empresas")
        .select("google_place_id")
        .eq("empresa_id", empresaId)
        .in("google_place_id", placeIds);
      const jaExistentes = new Set((existentes ?? []).map((e: any) => e.google_place_id));

      return jsonResponse({
        resultados: result.resultados.map((r) => ({ ...r, jaExisteNoCrm: jaExistentes.has(r.placeId) })),
        proximaPagina: result.proximaPagina,
      });
    }

    if (action === "get_details") {
      if (!podeBuscarImportar) return errorResponse("Sem permissão.", 403);
      const { placeId } = body;
      if (typeof placeId !== "string" || !placeId) return errorResponse("place_id é obrigatório.");

      const rate = await checkLeadSearchRateLimit(admin, empresaId);
      if (!rate.allowed) return errorResponse("Muitas buscas em pouco tempo. Aguarde um minuto e tente de novo.", 429);
      await logLeadSearchAttempt(admin, empresaId);

      const { apiKey } = await resolveApiKey(admin, empresaId);
      const details = await googlePlacesProvider.getPlaceDetails(placeId, apiKey);
      return jsonResponse({ detalhes: details });
    }

    if (action === "import") {
      if (!podeBuscarImportar) return errorResponse("Sem permissão.", 403);
      const {
        placeId,
        razaoSocial,
        nomeFantasia,
        cidade,
        estado,
        site,
        whatsapp,
        pipelineId,
        etapaId,
        responsavelId,
      } = body;

      // A RPC roda como o próprio usuário autenticado (não service_role),
      // pra que get_minha_empresa()/auth.uid() resolvam o tenant a partir
      // da sessão real — o frontend nunca informa o tenant.
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: authHeader } } },
      );

      const { data, error } = await userClient.rpc("crm_importar_lead_google", {
        p_place_id: placeId,
        p_razao_social: razaoSocial,
        p_nome_fantasia: nomeFantasia ?? null,
        p_cidade: cidade ?? null,
        p_estado: estado ?? null,
        p_site: site ?? null,
        p_whatsapp: whatsapp ?? null,
        p_pipeline_id: pipelineId,
        p_etapa_id: etapaId,
        p_responsavel_id: responsavelId,
      });

      if (error) return errorResponse(error.message, 400);
      const row = Array.isArray(data) ? data[0] : data;
      return jsonResponse({
        crmEmpresaId: row?.crm_empresa_id,
        crmOportunidadeId: row?.crm_oportunidade_id,
        jaExistia: row?.ja_existia ?? false,
      });
    }

    if (action === "get_usage") {
      if (!podeBuscarImportar) return errorResponse("Sem permissão.", 403);

      const userClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data, error } = await userClient.rpc("crm_leads_resolver_limite");
      if (error) return errorResponse(error.message, 400);
      const limite = Array.isArray(data) ? data[0] : data;

      const { data: credencial } = await admin
        .from("crm_leads_credenciais")
        .select("status, ultimo_teste_em")
        .eq("empresa_id", empresaId)
        .maybeSingle();

      return jsonResponse({
        limite,
        credencial: credencial ?? { status: "nao_configurado", ultimo_teste_em: null },
      });
    }

    // --- Configuração da chave BYO (só admin/super_admin) ---
    if (action === "save_credential") {
      if (!podeConfigurarIntegracao) return errorResponse("Sem permissão.", 403);
      const { apiKey } = body;
      if (typeof apiKey !== "string" || apiKey.trim().length < 10) {
        return errorResponse("Chave inválida.");
      }

      const masterKey = Deno.env.get("CRM_LEADS_ENC_KEY") ?? "";
      const { ciphertext, iv } = await encryptApiKey(apiKey.trim(), masterKey);

      const { error } = await admin.from("crm_leads_credenciais").upsert({
        empresa_id: empresaId,
        api_key_ciphertext: ciphertext,
        api_key_iv: iv,
        status: "nao_configurado",
        ultimo_teste_em: null,
        criado_por: user.id,
      });
      if (error) return errorResponse(error.message, 400);

      return jsonResponse({ success: true });
    }

    if (action === "test_credential") {
      if (!podeConfigurarIntegracao) return errorResponse("Sem permissão.", 403);

      const { data: cred } = await admin
        .from("crm_leads_credenciais")
        .select("api_key_ciphertext, api_key_iv")
        .eq("empresa_id", empresaId)
        .maybeSingle<CredentialRow>();
      if (!cred) return errorResponse("Nenhuma chave configurada.", 404);

      const masterKey = Deno.env.get("CRM_LEADS_ENC_KEY") ?? "";
      const apiKey = await decryptApiKey(cred.api_key_ciphertext, cred.api_key_iv, masterKey);

      let novoStatus: "conectado" | "invalido" = "conectado";
      try {
        await googlePlacesProvider.search({ textQuery: "teste de conexão" }, apiKey);
      } catch {
        novoStatus = "invalido";
      }

      await admin
        .from("crm_leads_credenciais")
        .update({ status: novoStatus, ultimo_teste_em: new Date().toISOString() })
        .eq("empresa_id", empresaId);

      return jsonResponse({ status: novoStatus });
    }

    if (action === "remove_credential") {
      if (!podeConfigurarIntegracao) return errorResponse("Sem permissão.", 403);
      const { error } = await admin.from("crm_leads_credenciais").delete().eq("empresa_id", empresaId);
      if (error) return errorResponse(error.message, 400);
      return jsonResponse({ success: true });
    }

    return errorResponse("Ação inválida.");
  } catch (err) {
    console.error("Erro inesperado no lead-finder", err);
    return errorResponse(err instanceof Error ? err.message : "Erro inesperado.", 500);
  }
});
