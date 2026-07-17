// Identidade da MARCA DO PRODUTO (o sistema para consultores).
// Fonte única de verdade — não confundir com a marca de cada consultoria
// (tenant), que é o timbre configurado por empresa em Configurações e usado
// no relatório/e-mail enviado ao cliente final.
export const BRAND = {
  name: "RDCheck",
  tagline: "Checklists digitais. Segurança de verdade.",
  legal: "RDC 216 & 275 ANVISA",
  // Fallback do timbre quando a consultoria (tenant) ainda não configurou o seu.
  defaultRemetente: {
    nome: "RDCheck",
    contato: "rdcheck.com.br",
  },
} as const;
