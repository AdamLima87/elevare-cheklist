import { useQuery } from "@tanstack/react-query";

// Lista fixa de UFs — são 27, não mudam, não justificam uma chamada de API
// só pra isso. Cidades por estado vêm da API pública do IBGE (gratuita,
// sem chave, é a fonte oficial de municípios do Brasil).
export const UFS = [
  { sigla: "AC", nome: "Acre" },
  { sigla: "AL", nome: "Alagoas" },
  { sigla: "AP", nome: "Amapá" },
  { sigla: "AM", nome: "Amazonas" },
  { sigla: "BA", nome: "Bahia" },
  { sigla: "CE", nome: "Ceará" },
  { sigla: "DF", nome: "Distrito Federal" },
  { sigla: "ES", nome: "Espírito Santo" },
  { sigla: "GO", nome: "Goiás" },
  { sigla: "MA", nome: "Maranhão" },
  { sigla: "MT", nome: "Mato Grosso" },
  { sigla: "MS", nome: "Mato Grosso do Sul" },
  { sigla: "MG", nome: "Minas Gerais" },
  { sigla: "PA", nome: "Pará" },
  { sigla: "PB", nome: "Paraíba" },
  { sigla: "PR", nome: "Paraná" },
  { sigla: "PE", nome: "Pernambuco" },
  { sigla: "PI", nome: "Piauí" },
  { sigla: "RJ", nome: "Rio de Janeiro" },
  { sigla: "RN", nome: "Rio Grande do Norte" },
  { sigla: "RS", nome: "Rio Grande do Sul" },
  { sigla: "RO", nome: "Rondônia" },
  { sigla: "RR", nome: "Roraima" },
  { sigla: "SC", nome: "Santa Catarina" },
  { sigla: "SP", nome: "São Paulo" },
  { sigla: "SE", nome: "Sergipe" },
  { sigla: "TO", nome: "Tocantins" },
] as const;

export function useIbgeCidades(uf: string | undefined) {
  return useQuery({
    queryKey: ["ibge-cidades", uf],
    queryFn: async () => {
      const res = await fetch(
        `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`,
      );
      if (!res.ok) throw new Error("Não foi possível carregar as cidades desse estado.");
      const data = await res.json();
      return (data as Array<{ nome: string }>)
        .map((c) => c.nome)
        .sort((a, b) => a.localeCompare(b, "pt-BR"));
    },
    enabled: !!uf,
    staleTime: 24 * 60 * 60 * 1000, // municípios não mudam de um dia pro outro
  });
}
