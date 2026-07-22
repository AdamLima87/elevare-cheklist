import { createContext, useContext, type ReactNode } from "react";

// Separação lógica entre o ambiente do tenant (empresa/consultoria — RLS
// via empresa_id/get_minha_empresa(), inalterado) e o ambiente da
// plataforma (o próprio RDCheck como SaaS — só super_admin, sem noção de
// tenant ativo). Este provider só envolve a árvore de rotas /plataforma/*;
// o app do tenant não usa nem depende disso.
//
// `mode` tem só 2 valores nesta etapa — "impersonating" (visualizar como
// um tenant específico, sem trocar profiles.empresa_id) é um caso futuro
// que ainda não existe; o shape já está pronto pra receber isso sem
// quebrar quem consome o contexto hoje.
export type TenantAccessMode = "platform" | "my_company";

interface TenantAccessValue {
  mode: TenantAccessMode;
}

const TenantAccessContext = createContext<TenantAccessValue | null>(null);

export function TenantAccessProvider({ mode, children }: { mode: TenantAccessMode; children: ReactNode }) {
  return <TenantAccessContext.Provider value={{ mode }}>{children}</TenantAccessContext.Provider>;
}

export function usePlatformAccess(): TenantAccessValue {
  const ctx = useContext(TenantAccessContext);
  if (!ctx) {
    throw new Error("usePlatformAccess() só pode ser usado dentro de <TenantAccessProvider mode=\"platform\">.");
  }
  return ctx;
}
