import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CrmMesaLead {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  responsavel_id: string;
  created_at: string;
}

export interface CrmMesaAtividade {
  id: string;
  crm_empresa_id: string;
  crm_oportunidade_id: string | null;
  responsavel_id: string;
  vencimento: string;
  crm_empresas: { razao_social: string; nome_fantasia: string | null } | null;
  crm_tipos_atividade: { nome: string } | null;
}

export interface CrmMesaOportunidade {
  id: string;
  nome: string;
  crm_empresa_id: string;
  responsavel_id: string;
  valor_estimado: number | null;
  etapa_alterada_em: string;
  crm_empresas: { razao_social: string; nome_fantasia: string | null } | null;
}

export interface CrmMesaDeTrabalho {
  leadsSemContato: CrmMesaLead[];
  atividadesAtrasadas: CrmMesaAtividade[];
  followUpsHoje: CrmMesaAtividade[];
  oportunidadesSemProximaAcao: CrmMesaOportunidade[];
  propostasAguardando: CrmMesaOportunidade[];
  negociacoesEstagnadas: CrmMesaOportunidade[];
}

// Landing screen do CRM — 6 listas independentes de triagem diária, cada
// uma sua própria busca (não uma agregação SQL gigante). O toggle
// "minhas"/"equipe" é aplicado no client (useCrmMesaDeTrabalho não recebe
// escopo — a página filtra por responsavel_id ao renderizar).
export function useCrmMesaDeTrabalho() {
  return useQuery({
    queryKey: ["crm-mesa-de-trabalho"],
    queryFn: async (): Promise<CrmMesaDeTrabalho> => {
      const hojeInicio = new Date();
      hojeInicio.setHours(0, 0, 0, 0);
      const hojeFim = new Date();
      hojeFim.setHours(23, 59, 59, 999);

      const [
        { data: leads, error: errLeads },
        { data: comContato, error: errContato },
        { data: atividadesAtrasadas, error: errAtrasadas },
        { data: followUpsHoje, error: errFollowUps },
        { data: oportunidadesAbertas, error: errOportunidades },
        { data: atividadesPendentesAbertas, error: errPendentes },
        { data: saude, error: errSaude },
      ] = await Promise.all([
        supabase.from("crm_empresas").select("id, razao_social, nome_fantasia, responsavel_id, created_at").eq("status", "lead"),
        supabase.from("crm_timeline").select("crm_empresa_id"),
        supabase
          .from("crm_atividades")
          .select("*, crm_empresas(razao_social, nome_fantasia), crm_tipos_atividade(nome)")
          .eq("status", "pendente")
          .lt("vencimento", hojeInicio.toISOString()),
        supabase
          .from("crm_atividades")
          .select("*, crm_empresas(razao_social, nome_fantasia), crm_tipos_atividade(nome)")
          .eq("status", "pendente")
          .gte("vencimento", hojeInicio.toISOString())
          .lte("vencimento", hojeFim.toISOString()),
        supabase
          .from("crm_oportunidades")
          .select("*, crm_empresas(razao_social, nome_fantasia), crm_etapas(nome, tipo)")
          .is("fechada_em", null),
        supabase.from("crm_atividades").select("crm_oportunidade_id").eq("status", "pendente"),
        supabase
          .from("crm_oportunidades_saude")
          .select("*, crm_empresas(razao_social, nome_fantasia)")
          .eq("saude", "vermelho"),
      ]);

      const error =
        errLeads || errContato || errAtrasadas || errFollowUps || errOportunidades || errPendentes || errSaude;
      if (error) throw error;

      const contasComContato = new Set((comContato ?? []).map((t) => t.crm_empresa_id));
      const leadsSemContato = (leads ?? []).filter((l) => !contasComContato.has(l.id));

      const oportunidadesComAtividadePendente = new Set(
        (atividadesPendentesAbertas ?? []).map((a) => a.crm_oportunidade_id).filter(Boolean),
      );
      const oportunidadesSemProximaAcao = (oportunidadesAbertas ?? []).filter(
        (o: any) => o.crm_etapas?.tipo === "aberta" && !oportunidadesComAtividadePendente.has(o.id),
      );

      const propostasAguardando = (oportunidadesAbertas ?? []).filter((o: any) =>
        o.crm_etapas?.nome?.toLowerCase().includes("proposta"),
      );

      const negociacoesEstagnadas = (saude ?? []).filter((o: any) => !o.tem_atividade_vencida);

      return {
        leadsSemContato,
        atividadesAtrasadas: (atividadesAtrasadas ?? []) as CrmMesaAtividade[],
        followUpsHoje: (followUpsHoje ?? []) as CrmMesaAtividade[],
        oportunidadesSemProximaAcao: oportunidadesSemProximaAcao as unknown as CrmMesaOportunidade[],
        propostasAguardando: propostasAguardando as unknown as CrmMesaOportunidade[],
        negociacoesEstagnadas: negociacoesEstagnadas as unknown as CrmMesaOportunidade[],
      };
    },
  });
}
