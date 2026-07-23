import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getDashboardMetrics,
  getEmpresasResumo,
  atualizarEmpresaStatus,
  atualizarEmpresaPlano,
  estenderTrial,
  definirOverrideLimite,
  listPlanos,
  listPlanosComLimites,
  criarPlano,
  atualizarPlanoAtivo,
  definirPlanoLimite,
  removerPlanoLimite,
  getGooglePlacesConsumo,
  getAuditLog,
  getBillingDashboard,
  getAssinaturasLista,
  bloquearAssinatura,
  desbloquearAssinatura,
  reprocessarWebhookEvento,
  listCupons,
  criarCupom,
  atualizarCupomAtivo,
} from "@/lib/platform/platformService";

export function usePlatformDashboardMetrics() {
  return useQuery({
    queryKey: ["platform", "dashboard-metrics"],
    queryFn: getDashboardMetrics,
  });
}

export function usePlatformEmpresas() {
  return useQuery({
    queryKey: ["platform", "empresas"],
    queryFn: getEmpresasResumo,
  });
}

export function usePlatformPlanos() {
  return useQuery({
    queryKey: ["platform", "planos"],
    queryFn: listPlanos,
  });
}

export function usePlatformPlanosComLimites() {
  return useQuery({
    queryKey: ["platform", "planos-com-limites"],
    queryFn: listPlanosComLimites,
  });
}

function useInvalidatePlatformPlanos() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["platform", "planos-com-limites"] });
    queryClient.invalidateQueries({ queryKey: ["platform", "planos"] });
  };
}

export function useCriarPlano() {
  const invalidate = useInvalidatePlatformPlanos();
  return useMutation({
    mutationFn: criarPlano,
    onSuccess: invalidate,
  });
}

export function useAtualizarPlanoAtivo() {
  const invalidate = useInvalidatePlatformPlanos();
  return useMutation({
    mutationFn: (input: { planoId: string; ativo: boolean }) => atualizarPlanoAtivo(input.planoId, input.ativo),
    onSuccess: invalidate,
  });
}

export function useDefinirPlanoLimite() {
  const invalidate = useInvalidatePlatformPlanos();
  return useMutation({
    mutationFn: definirPlanoLimite,
    onSuccess: invalidate,
  });
}

export function useRemoverPlanoLimite() {
  const invalidate = useInvalidatePlatformPlanos();
  return useMutation({
    mutationFn: removerPlanoLimite,
    onSuccess: invalidate,
  });
}

export function usePlatformGooglePlacesConsumo() {
  return useQuery({
    queryKey: ["platform", "google-places-consumo"],
    queryFn: getGooglePlacesConsumo,
  });
}

export function usePlatformAuditLog() {
  return useQuery({
    queryKey: ["platform", "audit-log"],
    queryFn: getAuditLog,
  });
}

function useInvalidatePlatformEmpresas() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["platform", "empresas"] });
    queryClient.invalidateQueries({ queryKey: ["platform", "dashboard-metrics"] });
  };
}

export function useAtualizarEmpresaStatus() {
  const invalidate = useInvalidatePlatformEmpresas();
  return useMutation({
    mutationFn: (input: { empresaId: string; status: "ativo" | "inativo" }) =>
      atualizarEmpresaStatus(input.empresaId, input.status),
    onSuccess: invalidate,
  });
}

export function useAtualizarEmpresaPlano() {
  const invalidate = useInvalidatePlatformEmpresas();
  return useMutation({
    mutationFn: (input: { empresaId: string; plano: string }) => atualizarEmpresaPlano(input.empresaId, input.plano),
    onSuccess: invalidate,
  });
}

export function useEstenderTrial() {
  const invalidate = useInvalidatePlatformEmpresas();
  return useMutation({
    mutationFn: (input: { empresaId: string; novoTrialEndsAt: string }) =>
      estenderTrial(input.empresaId, input.novoTrialEndsAt),
    onSuccess: invalidate,
  });
}

export function useDefinirOverrideLimite() {
  const invalidate = useInvalidatePlatformEmpresas();
  return useMutation({
    mutationFn: definirOverrideLimite,
    onSuccess: invalidate,
  });
}

function useInvalidatePlatformBilling() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["platform", "billing-dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["platform", "assinaturas"] });
  };
}

export function usePlatformBillingDashboard() {
  return useQuery({
    queryKey: ["platform", "billing-dashboard"],
    queryFn: getBillingDashboard,
  });
}

export function usePlatformAssinaturas() {
  return useQuery({
    queryKey: ["platform", "assinaturas"],
    queryFn: getAssinaturasLista,
  });
}

export function useBloquearAssinatura() {
  const invalidate = useInvalidatePlatformBilling();
  return useMutation({
    mutationFn: (input: { empresaId: string; motivo: string }) => bloquearAssinatura(input.empresaId, input.motivo),
    onSuccess: invalidate,
  });
}

export function useDesbloquearAssinatura() {
  const invalidate = useInvalidatePlatformBilling();
  return useMutation({
    mutationFn: (input: { empresaId: string; motivo: string }) => desbloquearAssinatura(input.empresaId, input.motivo),
    onSuccess: invalidate,
  });
}

export function useReprocessarWebhookEvento() {
  const invalidate = useInvalidatePlatformBilling();
  return useMutation({
    mutationFn: reprocessarWebhookEvento,
    onSuccess: invalidate,
  });
}

export function usePlatformCupons() {
  return useQuery({
    queryKey: ["platform", "cupons"],
    queryFn: listCupons,
  });
}

function useInvalidatePlatformCupons() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["platform", "cupons"] });
}

export function useCriarCupom() {
  const invalidate = useInvalidatePlatformCupons();
  return useMutation({
    mutationFn: criarCupom,
    onSuccess: invalidate,
  });
}

export function useAtualizarCupomAtivo() {
  const invalidate = useInvalidatePlatformCupons();
  return useMutation({
    mutationFn: (input: { cupomId: string; ativo: boolean }) => atualizarCupomAtivo(input.cupomId, input.ativo),
    onSuccess: invalidate,
  });
}
