import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface RankingResponsavel {
  responsavel_id: string;
  nome: string;
  oportunidadesGanhas: number;
  valorGanho: number;
  oportunidadesAbertas: number;
}

interface MotivoPerdaContagem {
  nome: string;
  quantidade: number;
}

interface OrigemContagem {
  nome: string;
  quantidade: number;
}

export interface CrmDashboardStats {
  totalLeads: number;
  valorPipeline: number;
  valorPipelinePonderado: number;
  winRate: number;
  ticketMedio: number;
  tempoMedioFechamentoDias: number | null;
  motivosPerda: MotivoPerdaContagem[];
  origensLead: OrigemContagem[];
  rankingResponsaveis: RankingResponsavel[];
}

// Segue o padrão de src/routes/dashboard.tsx: busca as tabelas cruas e
// agrega no client (dataset de um CRM comercial não justifica view/RPC
// dedicada só pra isso).
export function useCrmDashboard() {
  return useQuery({
    queryKey: ["crm-dashboard"],
    queryFn: async (): Promise<CrmDashboardStats> => {
      const [
        { data: oportunidades, error: errOportunidades },
        { data: etapas, error: errEtapas },
        { data: motivos, error: errMotivos },
        { data: contas, error: errContas },
        { data: origens, error: errOrigens },
        { data: responsaveis, error: errResponsaveis },
      ] = await Promise.all([
        supabase.from("crm_oportunidades").select("*"),
        supabase.from("crm_etapas").select("id, tipo"),
        supabase.from("crm_motivos_perda").select("id, nome"),
        supabase.from("crm_empresas").select("id, origem_id"),
        supabase.from("crm_origens_lead").select("id, nome"),
        supabase.from("profiles").select("id, nome"),
      ]);

      const error = errOportunidades || errEtapas || errMotivos || errContas || errOrigens || errResponsaveis;
      if (error) throw error;

      const etapaTipoPorId = new Map((etapas ?? []).map((e) => [e.id, e.tipo]));
      const nomeMotivoPorId = new Map((motivos ?? []).map((m) => [m.id, m.nome]));
      const nomeOrigemPorId = new Map((origens ?? []).map((o) => [o.id, o.nome]));
      const nomeResponsavelPorId = new Map((responsaveis ?? []).map((p) => [p.id, p.nome]));

      const todasOportunidades = oportunidades ?? [];
      const abertas = todasOportunidades.filter((o) => etapaTipoPorId.get(o.etapa_id) === "aberta");
      const ganhas = todasOportunidades.filter((o) => etapaTipoPorId.get(o.etapa_id) === "ganho");
      const perdidas = todasOportunidades.filter((o) => etapaTipoPorId.get(o.etapa_id) === "perdido");

      const valorPipeline = abertas.reduce((soma, o) => soma + (o.valor_estimado ?? 0), 0);
      const valorPipelinePonderado = abertas.reduce(
        (soma, o) => soma + (o.valor_estimado ?? 0) * ((o.probabilidade ?? 0) / 100),
        0,
      );

      const totalFechadas = ganhas.length + perdidas.length;
      const winRate = totalFechadas > 0 ? (ganhas.length / totalFechadas) * 100 : 0;

      const ticketMedio =
        ganhas.length > 0
          ? ganhas.reduce((soma, o) => soma + (o.valor_estimado ?? 0), 0) / ganhas.length
          : 0;

      const temposFechamentoDias = ganhas
        .filter((o) => o.fechada_em)
        .map((o) => (new Date(o.fechada_em!).getTime() - new Date(o.created_at).getTime()) / 86_400_000);
      const tempoMedioFechamentoDias =
        temposFechamentoDias.length > 0
          ? temposFechamentoDias.reduce((soma, d) => soma + d, 0) / temposFechamentoDias.length
          : null;

      const motivosPerdaContagem = new Map<string, number>();
      for (const o of perdidas) {
        const nome = o.motivo_perda_id ? nomeMotivoPorId.get(o.motivo_perda_id) ?? "Outro" : "Não informado";
        motivosPerdaContagem.set(nome, (motivosPerdaContagem.get(nome) ?? 0) + 1);
      }
      const motivosPerda = Array.from(motivosPerdaContagem, ([nome, quantidade]) => ({ nome, quantidade })).sort(
        (a, b) => b.quantidade - a.quantidade,
      );

      const origensContagem = new Map<string, number>();
      for (const c of contas ?? []) {
        const nome = c.origem_id ? nomeOrigemPorId.get(c.origem_id) ?? "Outro" : "Não informado";
        origensContagem.set(nome, (origensContagem.get(nome) ?? 0) + 1);
      }
      const origensLead = Array.from(origensContagem, ([nome, quantidade]) => ({ nome, quantidade })).sort(
        (a, b) => b.quantidade - a.quantidade,
      );

      const rankingMap = new Map<string, RankingResponsavel>();
      for (const o of todasOportunidades) {
        const tipo = etapaTipoPorId.get(o.etapa_id);
        if (tipo !== "ganho" && tipo !== "aberta") continue;
        const existente = rankingMap.get(o.responsavel_id) ?? {
          responsavel_id: o.responsavel_id,
          nome: nomeResponsavelPorId.get(o.responsavel_id) ?? "—",
          oportunidadesGanhas: 0,
          valorGanho: 0,
          oportunidadesAbertas: 0,
        };
        if (tipo === "ganho") {
          existente.oportunidadesGanhas += 1;
          existente.valorGanho += o.valor_estimado ?? 0;
        } else {
          existente.oportunidadesAbertas += 1;
        }
        rankingMap.set(o.responsavel_id, existente);
      }
      const rankingResponsaveis = Array.from(rankingMap.values()).sort((a, b) => b.valorGanho - a.valorGanho);

      return {
        totalLeads: (contas ?? []).length,
        valorPipeline,
        valorPipelinePonderado,
        winRate,
        ticketMedio,
        tempoMedioFechamentoDias,
        motivosPerda,
        origensLead,
        rankingResponsaveis,
      };
    },
  });
}
