// Camada central de autorização. O dono de uma empresa continua com
// perfil "admin" hoje (não existe "owner" ainda) — mas o código que
// PRECISA saber "quem pode fazer o quê" consulta hasPermission()/os
// helpers abaixo, nunca `perfil === "admin"` diretamente. Isso permite
// introduzir "owner" no futuro (com permissões exclusivas de cobrança,
// exclusão de empresa e transferência de propriedade) só adicionando uma
// entrada nova em PERMISSIONS e realocando 3 chaves — sem varrer o
// sistema. Os ~15 pontos existentes que já checam `perfil === "admin"`
// diretamente não foram varridos; só os pontos novos/tocados por este
// trabalho usam esta camada.
export type Perfil = "super_admin" | "admin" | "consultor" | "cliente";

export type Permission =
  | "manage_users"
  | "manage_billing"
  | "manage_company_settings"
  | "manage_clients"
  | "manage_inspections"
  | "delete_company"
  | "transfer_ownership"
  | "manage_crm"
  | "manage_crm_integracoes";

const PERMISSIONS: Record<Perfil, ReadonlySet<Permission>> = {
  super_admin: new Set([
    "manage_users",
    "manage_billing",
    "manage_company_settings",
    "manage_clients",
    "manage_inspections",
    "delete_company",
    "transfer_ownership",
    "manage_crm",
    "manage_crm_integracoes",
  ]),
  // Hoje o admin É o dono da empresa — por isso recebe também as
  // permissões "exclusivas de owner". Quando o papel owner existir de
  // fato, essas três saem daqui e vão só para ele.
  admin: new Set([
    "manage_users",
    "manage_billing",
    "manage_company_settings",
    "manage_clients",
    "manage_inspections",
    "delete_company",
    "transfer_ownership",
    "manage_crm",
    "manage_crm_integracoes",
  ]),
  consultor: new Set(["manage_clients", "manage_inspections", "manage_crm"]),
  cliente: new Set([]),
};

export interface ProfileLike {
  perfil?: string | null;
}

export function hasPermission(profile: ProfileLike | null | undefined, permission: Permission): boolean {
  const perfil = profile?.perfil as Perfil | undefined;
  if (!perfil || !(perfil in PERMISSIONS)) return false;
  return PERMISSIONS[perfil].has(permission);
}

export function canManageUsers(profile: ProfileLike | null | undefined): boolean {
  return hasPermission(profile, "manage_users");
}

export function canManageBilling(profile: ProfileLike | null | undefined): boolean {
  return hasPermission(profile, "manage_billing");
}

export function canManageCompanySettings(profile: ProfileLike | null | undefined): boolean {
  return hasPermission(profile, "manage_company_settings");
}

export function canManageClients(profile: ProfileLike | null | undefined): boolean {
  return hasPermission(profile, "manage_clients");
}

export function canManageInspections(profile: ProfileLike | null | undefined): boolean {
  return hasPermission(profile, "manage_inspections");
}

export function canDeleteCompany(profile: ProfileLike | null | undefined): boolean {
  return hasPermission(profile, "delete_company");
}

export function canTransferOwnership(profile: ProfileLike | null | undefined): boolean {
  return hasPermission(profile, "transfer_ownership");
}

export function canManageCrm(profile: ProfileLike | null | undefined): boolean {
  return hasPermission(profile, "manage_crm");
}

export function canManageCrmIntegracoes(profile: ProfileLike | null | undefined): boolean {
  return hasPermission(profile, "manage_crm_integracoes");
}
