import { describe, expect, it } from "vitest";
import {
  canDeleteCompany,
  canManageBilling,
  canManageUsers,
  canTransferOwnership,
  hasPermission,
} from "./permissions";

describe("hasPermission", () => {
  it("returns false for null/undefined profile", () => {
    expect(hasPermission(null, "manage_users")).toBe(false);
    expect(hasPermission(undefined, "manage_users")).toBe(false);
  });

  it("returns false for an unknown perfil", () => {
    expect(hasPermission({ perfil: "nao_existe" }, "manage_users")).toBe(false);
  });

  it("returns false for a profile without perfil set", () => {
    expect(hasPermission({}, "manage_users")).toBe(false);
  });

  it("cliente has no permissions", () => {
    const cliente = { perfil: "cliente" };
    expect(hasPermission(cliente, "manage_clients")).toBe(false);
    expect(hasPermission(cliente, "manage_inspections")).toBe(false);
    expect(canManageUsers(cliente)).toBe(false);
  });

  it("consultor can manage clients and inspections but not users/billing", () => {
    const consultor = { perfil: "consultor" };
    expect(hasPermission(consultor, "manage_clients")).toBe(true);
    expect(hasPermission(consultor, "manage_inspections")).toBe(true);
    expect(canManageUsers(consultor)).toBe(false);
    expect(canManageBilling(consultor)).toBe(false);
  });

  it("admin has every permission today, including owner-exclusive ones", () => {
    const admin = { perfil: "admin" };
    expect(canManageUsers(admin)).toBe(true);
    expect(canManageBilling(admin)).toBe(true);
    expect(canDeleteCompany(admin)).toBe(true);
    expect(canTransferOwnership(admin)).toBe(true);
  });

  it("super_admin has every permission", () => {
    const superAdmin = { perfil: "super_admin" };
    expect(canManageUsers(superAdmin)).toBe(true);
    expect(canManageBilling(superAdmin)).toBe(true);
    expect(canDeleteCompany(superAdmin)).toBe(true);
  });
});
