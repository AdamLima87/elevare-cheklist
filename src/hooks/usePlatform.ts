import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getDashboardMetrics,
  getEmpresasResumo,
  atualizarEmpresaStatus,
  atualizarEmpresaPlano,
  estenderTrial,
  definirOverrideLimite,
  listPlanos,
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
