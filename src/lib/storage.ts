import { supabase } from "@/integrations/supabase/client";
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
  respLegalEmail: string;
  respTecNome: string;
  respTecCpf: string;
  respTecConselho: string;
  respTecRegistro: string;
  dataHora: string;
  email: string;
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
  };
  respostas: Record<string, Resposta>;
}

const RASCUNHO_KEY = "elevare_rascunho";

export function emptyEstabelecimento(): Estabelecimento {
  return {
    razaoSocial: "", nomeFantasia: "", atividade: "", cnpj: "",
    endereco: "", bairro: "", respLegalNome: "", respLegalCpf: "",
    respLegalEmail: "", respTecNome: "", respTecCpf: "", respTecConselho: "",
    respTecRegistro: "", dataHora: new Date().toISOString().slice(0, 16),
    email: "", cep: "", municipio: "", uf: "",
  };
}

export function emptyQuestionario(): QuestionarioEstab {
  return {
    receptividade: "", numTrabalhadores: "", refeicoesPeriodo: "",
    alimentosCardapio: "", instrucoesFuncionarios: "", instrucoesQual: "",
    cursosTreinamentos: "", avaliacaoPos: "", fornecimentoUniformeFreq: "",
    uniformeItens: [], comissao: "", alteracoesDesejadas: "",
  };
}

export function emptyFuncionario(): Funcionario {
  return { nome: "", idade: "", escolaridade: "", carteiraAssinada: "", cursoBMP: "", respostas: {} };
}

export function calcularPercentual(respostas: Record<string, Resposta>) {
  const total = checklistSections.reduce((a, s) => a + s.items.length, 0);
  const respondidos = Object.values(respostas).filter(v => v !== null).length;
  const conformes = Object.values(respostas).filter(v => v === "S").length;
  const naoAplicaveis = Object.values(respostas).filter(v => v === "NA").length;
  const aplicaveis = respondidos - naoAplicaveis;
  const percentual = aplicaveis > 0 ? (conformes / aplicaveis) * 100 : 0;
  const progresso = Math.round((respondidos / total) * 100);
  return { percentual, conformes, naoConformes: aplicaveis - conformes, naoAplicaveis, respondidos, total, progresso };
}

export function classificacao(percentual: number) {
  if (percentual >= 76) return { label: "BOM", tone: "success", color: "#3B6D11", bg: "#EAF3DE" };
  if (percentual >= 51) return { label: "REGULAR", tone: "warning", color: "#854F0B", bg: "#FAEEDA" };
  return { label: "RUIM", tone: "destructive", color: "#A32D2D", bg: "#FCEBEB" };
}

export function loadRascunho(): Inspecao | null {
  try {
    const raw = localStorage.getItem(RASCUNHO_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export async function saveRascunho(insp: Inspecao): Promise<void> {
  localStorage.setItem(RASCUNHO_KEY, JSON.stringify(insp));
  try {
    await supabase.from("inspecoes").upsert({
      id: insp.id,
      numero_sequencial: insp.numero_sequencial,
      consultor_id: (await supabase.auth.getSession()).data.session?.user.id,
      estabelecimento_nome: insp.estabelecimento,
      cnpj: insp.dados.estabelecimento.cnpj.replace(/\D/g, ""),
      status: insp.status,
      progresso: insp.progresso,
      conformidade: insp.conformidade,
      dados: insp.dados as any,
      respostas: insp.respostas as any,
      data_inicio: insp.dataInicio,
      data_conclusao: insp.dataConclusao,
    });
  } catch (e) { console.error("Erro ao salvar no Supabase:", e); }
}

export async function saveToHistorico(insp: Inspecao): Promise<void> {
  await saveRascunho(insp);
}

export function clearRascunho(): void {
  localStorage.removeItem(RASCUNHO_KEY);
}

export async function createNewInspecao(): Promise<Inspecao> {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user.id;

  let numero = 1;
  try {
    const { data: num } = await supabase.from("numeracao_inspecoes").select("*").eq("id", 1).single();
    if (num) {
      numero = (num.numeros_disponiveis?.length > 0) ? num.numeros_disponiveis[0] : (num.ultimo_numero || 0) + 1;
      const novosDisponiveis = num.numeros_disponiveis?.length > 0 ? num.numeros_disponiveis.slice(1) : [];
      await supabase.from("numeracao_inspecoes").update({ ultimo_numero: Math.max(numero, num.ultimo_numero || 0), numeros_disponiveis: novosDisponiveis }).eq("id", 1);
    }
  } catch (e) { console.error("Erro ao buscar numeração:", e); }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const insp: Inspecao = {
    id,
    numero_sequencial: numero,
    status: "em_andamento",
    estabelecimento: "",
    dataInicio: now,
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

  await supabase.from("inspecoes").insert({
    id,
    numero_sequencial: numero,
    consultor_id: userId,
    estabelecimento_nome: "",
    cnpj: "",
    status: "em_andamento",
    progresso: 0,
    dados: insp.dados as any,
    respostas: {} as any,
    data_inicio: now,
  });

  return insp;
}

export async function deleteFromHistorico(id: string): Promise<void> {
  localStorage.removeItem(RASCUNHO_KEY);
  const { data: insp } = await supabase.from("inspecoes").select("numero_sequencial, status").eq("id", id).single();
  await supabase.from("inspecoes").delete().eq("id", id);
  if (insp?.status === "em_andamento") {
    const { data: num } = await supabase.from("numeracao_inspecoes").select("*").eq("id", 1).single();
    if (num) {
      const disponiveis = [...(num.numeros_disponiveis || []), insp.numero_sequencial].sort((a, b) => a - b);
      await supabase.from("numeracao_inspecoes").update({ numeros_disponiveis: disponiveis }).eq("id", 1);
    }
  }
}
