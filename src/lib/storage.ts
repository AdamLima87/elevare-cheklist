import { supabase } from "@/integrations/supabase/client";
import { useSyncStore } from "@/hooks/useSyncStore";
import { isCloudNewer } from "./conflict";
import { findOrCreateCliente } from "@/hooks/useClientes";
import { checklistSections } from "./checklist-data";

export type Resposta = "S" | "N" | "NA" | null;

export interface Estabelecimento {
  razaoSocial: string;
  nomeFantasia: string;
  atividade: string;
  cnpj: string;
  endereco: string;
  bairro: string;
  respLegalNome: string;
  respLegalCpf: string;
  respTecNome: string;
  respTecCpf: string;
  respTecConselho: string;
  respTecRegistro: string;
  dataHora: string;
  email: string;
  respLegalEmail: string;
  cep?: string;
  municipio?: string;
  uf?: string;
}

export interface Funcionario {
  nome: string;
  idade: string;
  escolaridade: string;
  carteiraAssinada: string;
  cursoBMP: string;
  respostas: Record<string, string>;
}

export interface QuestionarioEstab {
  receptividade: string;
  numTrabalhadores: string;
  refeicoesPeriodo: string;
  alimentosCardapio: string;
  instrucoesFuncionarios: string;
  instrucoesQual: string;
  cursosTreinamentos: string;
  avaliacaoPos: string;
  fornecimentoUniformeFreq: string;
  uniformeItens: string[];
  comissao: string;
  alteracoesDesejadas: string;
}

export interface AcaoCorretiva {
  texto: string;
  /** ISO date (YYYY-MM-DD) */
  prazo: string;
  concluido?: boolean;
  /** ISO date (YYYY-MM-DD), setado quando concluido vira true */
  dataResolucao?: string;
}

export interface Inspecao {
  id: string;
  numero_sequencial: number;
  status: "em_andamento" | "concluida";
  estabelecimento: string;
  dataInicio: string;
  dataConclusao: string | null;
  progresso: number;
  conformidade: number | null;
  dados: {
    estabelecimento: Estabelecimento;
    questionario: QuestionarioEstab;
    funcionarios: Funcionario[];
    fotos: Record<string, string[]>;
    /** Corrective action plan per non-conforming item, keyed by checklist item id. */
    planoAcao?: Record<string, AcaoCorretiva>;
  };
  respostas: Record<string, Resposta>;
  /** Last `updated_at` this client saw from the cloud row, used to detect concurrent edits. Local bookkeeping only, not a DB column. */
  cloudUpdatedAt?: string;
}

export const HISTORICO_KEY = "elevare_inspecoes";
const RASCUNHO_KEY = "elevare_rascunho";

export function emptyEstabelecimento(): Estabelecimento {
  return {
    razaoSocial: "",
    nomeFantasia: "",
    atividade: "",
    cnpj: "",
    endereco: "",
    bairro: "",
    respLegalNome: "",
    respLegalCpf: "",
    respTecNome: "",
    respTecCpf: "",
    respTecConselho: "",
    respTecRegistro: "",
    dataHora: new Date().toISOString().slice(0, 16),
    email: "",
    respLegalEmail: "",
  };
}

export function emptyQuestionario(): QuestionarioEstab {
  return {
    receptividade: "",
    numTrabalhadores: "",
    refeicoesPeriodo: "",
    alimentosCardapio: "",
    instrucoesFuncionarios: "",
    instrucoesQual: "",
    cursosTreinamentos: "",
    avaliacaoPos: "",
    fornecimentoUniformeFreq: "",
    uniformeItens: [],
    comissao: "",
    alteracoesDesejadas: "",
  };
}

export function emptyFuncionario(): Funcionario {
  return {
    nome: "",
    idade: "",
    escolaridade: "",
    carteiraAssinada: "",
    cursoBMP: "",
    respostas: {},
  };
}

// Números não são reciclados: uma inspeção apagada não devolve seu número
// ao pool (lacunas na sequência são aceitáveis para um documento de
// compliance; duplicatas não são). A contagem é atômica e por empresa —
// resolvida no banco via get_minha_empresa(), nunca por um empresa_id
// enviado pelo cliente.
async function getNextNumero(): Promise<number> {
  const { data, error } = await supabase.rpc("get_next_numero_inspecao" as any);
  if (error || data == null) {
    console.error("Erro ao obter próximo número de inspeção:", error);
    throw error ?? new Error("Não foi possível obter o número da inspeção.");
  }
  return data as number;
}

export function formatNumero(n: number) {
  return `#${(n || 0).toString().padStart(3, "0")}`;
}

export async function createNewInspecao(): Promise<Inspecao> {
  const num = await getNextNumero();
  return {
    id: crypto.randomUUID(),
    numero_sequencial: num,
    status: "em_andamento",
    estabelecimento: "",
    dataInicio: new Date().toISOString(),
    dataConclusao: null,
    progresso: 0,
    conformidade: null,
    dados: {
      estabelecimento: emptyEstabelecimento(),
      questionario: emptyQuestionario(),
      funcionarios: [],
      fotos: {},
    },
    respostas: {},
  };
}

export function loadRascunho(): Inspecao | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(RASCUNHO_KEY);
    return raw ? (JSON.parse(raw) as Inspecao) : null;
  } catch {
    return null;
  }
}

export async function saveRascunho(insp: Inspecao) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(RASCUNHO_KEY, JSON.stringify(insp));

  // In the current architecture, saveToHistorico handles cloud sync
  // to avoid duplication and inconsistencies.
  // saveRascunho is now strictly for local persistence of the current active session.
}

export async function clearRascunho() {
  if (typeof localStorage === "undefined") return;
  const rascunho = loadRascunho();
  localStorage.removeItem(RASCUNHO_KEY);

  // Note: We don't necessarily want to delete from Cloud when clearing local draft
  // but if the draft ID is deleted from history, that's handled in deleteFromHistorico
}

export async function loadHistoricoFromCloud(): Promise<Inspecao[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return [];

  const { data, error } = await supabase
    .from("inspecoes")
    .select("*")
    .order("data_inicio", { ascending: false });

  if (error || !data) {
    console.error("Erro ao buscar histórico do cloud:", error);
    return [];
  }

  return data.map((item) => ({
    id: item.id,
    numero_sequencial: item.numero_sequencial as number,
    status: item.status as any,
    estabelecimento: item.estabelecimento_nome || "",
    dataInicio: item.data_inicio,
    dataConclusao: item.data_conclusao,
    progresso: item.progresso,
    conformidade: item.conformidade ? Number(item.conformidade) : null,
    dados: item.dados as any,
    respostas: item.respostas as any,
  }));
}

export function loadHistorico(): Inspecao[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORICO_KEY);
    const list = raw ? (JSON.parse(raw) as Inspecao[]) : [];
    // Ensure data integrity on load
    return list.map((item) => ({
      ...item,
      dados: item.dados || {
        estabelecimento: emptyEstabelecimento(),
        questionario: emptyQuestionario(),
        funcionarios: [],
        fotos: {},
      },
      respostas: item.respostas || {},
    }));
  } catch {
    return [];
  }
}

export async function saveToHistorico(insp: Inspecao): Promise<string | undefined> {
  if (typeof localStorage === "undefined") return undefined;
  const list = loadHistorico();
  const idx = list.findIndex((i) => i.id === insp.id);

  if (insp.dados?.estabelecimento) {
    insp.estabelecimento =
      insp.dados.estabelecimento.nomeFantasia || insp.dados.estabelecimento.razaoSocial || "";
  }

  if (idx >= 0) list[idx] = insp;
  else list.unshift(insp);

  localStorage.setItem(HISTORICO_KEY, JSON.stringify(list));

  // Sync to Cloud
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.user) {
    try {
      const { data: cloudRow } = await supabase
        .from("inspecoes")
        .select("updated_at")
        .eq("id", insp.id)
        .maybeSingle();

      if (cloudRow && isCloudNewer(insp.cloudUpdatedAt, cloudRow.updated_at)) {
        // Someone else (another device/tab, or an admin edit) updated this inspection
        // since we last synced it. Don't clobber their edit with our stale copy —
        // flag it and let the next pull keep the cloud version.
        useSyncStore.getState().addConflict(insp.id);
        return undefined;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("empresa_id")
        .eq("id", session.user.id)
        .single();
      const empresaId = profile?.empresa_id;
      if (!empresaId) {
        console.error("Usuário sem empresa associada, não é possível sincronizar a inspeção.");
        return undefined;
      }

      const cnpj = insp.dados?.estabelecimento?.cnpj || null;
      const cleanCnpj = cnpj ? cnpj.replace(/\D/g, "") : null;

      let clienteId: string | null = null;
      if (insp.estabelecimento) {
        try {
          const cliente = await findOrCreateCliente({
            empresa_id: empresaId,
            nome: insp.estabelecimento,
            cnpj: cleanCnpj,
          });
          clienteId = cliente.id;
        } catch (err) {
          console.error("Failed to find/create cliente:", err);
        }
      }

      const { data: upserted, error } = await supabase
        .from("inspecoes")
        .upsert({
          id: insp.id,
          empresa_id: empresaId,
          cliente_id: clienteId,
          consultor_id: session.user.id,
          numero_sequencial: insp.numero_sequencial,
          status: insp.status,
          estabelecimento_nome: insp.estabelecimento,
          cnpj: cleanCnpj,
          data_inicio: insp.dataInicio,
          data_conclusao: insp.dataConclusao,
          progresso: insp.progresso,
          conformidade: insp.conformidade,
          dados: insp.dados as any,
          respostas: insp.respostas as any,
        })
        .select("updated_at")
        .single();
      if (error) throw error;

      if (upserted) {
        const freshList = loadHistorico();
        const freshIdx = freshList.findIndex((i) => i.id === insp.id);
        if (freshIdx >= 0) {
          freshList[freshIdx] = { ...freshList[freshIdx], cloudUpdatedAt: upserted.updated_at };
          localStorage.setItem(HISTORICO_KEY, JSON.stringify(freshList));
        }

        // Also refresh the active rascunho (if it's this same inspection) so a
        // later loadRascunho() doesn't read the pre-save timestamp. Callers that
        // keep their own in-memory copy (e.g. the checklist page) still need to
        // apply the returned cloudUpdatedAt themselves — otherwise every save
        // after the first one falsely looks like a conflict with itself and gets
        // silently dropped.
        const currentRascunho = loadRascunho();
        if (currentRascunho && currentRascunho.id === insp.id) {
          currentRascunho.cloudUpdatedAt = upserted.updated_at;
          localStorage.setItem(RASCUNHO_KEY, JSON.stringify(currentRascunho));
        }
      }

      // If status changed to concluded, check for client creation
      if (insp.status === "concluida") {
        const legalEmail =
          insp.dados?.estabelecimento?.respLegalEmail || insp.dados?.estabelecimento?.email;
        const legalName = insp.dados?.estabelecimento?.respLegalNome;

        if (legalEmail && cleanCnpj) {
          // Call Edge Function to create client
          supabase.functions
            .invoke("admin-manage-users", {
              body: {
                action: "create_client",
                userData: {
                  email: legalEmail,
                  password: cleanCnpj, // CNPJ only numbers as password
                  nome: legalName || insp.estabelecimento,
                  perfil: "cliente",
                  cnpj: cleanCnpj,
                },
              },
            })
            .then(({ data }) => {
              if (data && !data.error) {
                // Custom event to be caught by toast if UI is listening, or just silent
                console.log("Acesso do cliente garantido na conclusão");
              }
            })
            .catch((err: unknown) => {
              console.error("Failed to ensure client access:", err);
            });
        }
      }

      return upserted?.updated_at;
    } catch (err) {
      console.error("Failed to sync to Cloud:", err);
      return undefined;
    }
  }
  return undefined;
}

export async function deleteFromHistorico(id: string) {
  if (typeof localStorage === "undefined") return;
  const list = loadHistorico();
  const rascunho = loadRascunho();
  if (rascunho && rascunho.id === id) {
    await clearRascunho();
  }
  const filtered = list.filter((i) => i.id !== id);
  localStorage.setItem(HISTORICO_KEY, JSON.stringify(filtered));

  // Sync to Cloud
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.user) {
    try {
      await supabase.from("inspecoes").delete().eq("id", id);
    } catch (err) {
      console.error("Failed to delete from Cloud:", err);
    }
  }
}

export function calcularPercentual(respostas: Record<string, Resposta>): {
  sim: number;
  nao: number;
  na: number;
  aplicavel: number;
  percentual: number;
} {
  let sim = 0,
    nao = 0,
    na = 0;

  // Contabilizar as respostas presentes
  if (respostas) {
    Object.values(respostas).forEach((r) => {
      if (r === "S") sim++;
      else if (r === "N") nao++;
      else if (r === "NA") na++;
    });
  }

  // O total de itens do checklist é 112.
  // A conformidade positiva é calculada em relação aos itens aplicáveis (S + N).
  // Itens marcados como NA são removidos do denominador.
  const aplicavel = sim + nao;
  const percentual = aplicavel === 0 ? 0 : (sim / aplicavel) * 100;

  return { sim, nao, na, aplicavel, percentual };
}

export function classificacao(
  pct: number,
  ncCriticas: number = 0,
): {
  label: string;
  emoji: string;
  tone: "success" | "warning" | "destructive";
  limitadaPorCritico?: boolean;
} {
  if (pct >= 76) {
    // Uma não conformidade em item crítico (água, pragas, temperatura etc.)
    // impede a classificação BOM, mesmo com percentual alto: 94% de
    // conformidade sem água potável não é um estabelecimento "BOM".
    if (ncCriticas > 0) {
      return { label: "REGULAR", emoji: "⚠️", tone: "warning", limitadaPorCritico: true };
    }
    return { label: "BOM", emoji: "✅", tone: "success" };
  }
  if (pct >= 51) return { label: "REGULAR", emoji: "⚠️", tone: "warning" };
  return { label: "RUIM", emoji: "❌", tone: "destructive" };
}

export interface SecaoScore {
  id: string;
  title: string;
  sim: number;
  nao: number;
  na: number;
  aplicavel: number;
  // null quando a seção inteira é "não se aplica" (sem denominador)
  percentual: number | null;
}

// Conformidade por seção com o MESMO critério da nota geral:
// NA sai do denominador. Fonte única para a tela de resultado e o PDF.
export function calcularSecoes(respostas: Record<string, Resposta>): SecaoScore[] {
  return checklistSections.map((sec) => {
    let sim = 0,
      nao = 0,
      na = 0;
    sec.items.forEach((item) => {
      const r = respostas?.[item.id];
      if (r === "S") sim++;
      else if (r === "N") nao++;
      else if (r === "NA") na++;
    });
    const aplicavel = sim + nao;
    return {
      id: sec.id,
      title: sec.title,
      sim,
      nao,
      na,
      aplicavel,
      percentual: aplicavel === 0 ? null : (sim / aplicavel) * 100,
    };
  });
}
