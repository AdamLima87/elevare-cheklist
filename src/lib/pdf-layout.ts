import type jsPDF from "jspdf";
import { BRAND } from "./brand";
import logoUrl from "@/assets/rdcheck-logo-full.png";

// Layout/paleta compartilhados entre todos os geradores de PDF do produto
// (checklist, proposta, contrato) — extraído de pdf.ts na Fase B pra não
// duplicar cabeçalho/rodapé/cores em cada gerador novo. Sem mudança de
// comportamento no PDF de checklist existente.
export const BRAND_BLUE: [number, number, number] = [24, 72, 120]; // #184878
export const BRAND_GREEN: [number, number, number] = [24, 168, 96]; // #18a860

export interface MarcaRelatorio {
  nome?: string;
  contato?: string;
}

// Faixa colorida no topo + rodapé com marca/paginação — presente em todas
// as páginas de qualquer PDF do produto.
export function addLayoutElements(
  doc: jsPDF,
  pageIndex: number,
  totalPages: number,
  marcaNome: string,
  marcaContato: string,
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setPage(pageIndex);

  doc.setFillColor(...BRAND_BLUE);
  doc.rect(0, 0, pageWidth, 8, "F");

  doc.setDrawColor(...BRAND_BLUE);
  doc.setLineWidth(0.5);
  doc.line(20, pageHeight - 40, pageWidth - 20, pageHeight - 40);

  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.setFont("helvetica", "normal");
  doc.text(`${marcaNome} · ${marcaContato}`, 20, pageHeight - 25);
  doc.text(`Página ${pageIndex} de ${totalPages}`, pageWidth - 20, pageHeight - 25, { align: "right" });
}

export function aplicarLayoutEmTodasAsPaginas(doc: jsPDF, marcaNome: string, marcaContato: string) {
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    addLayoutElements(doc, i, totalPages, marcaNome, marcaContato);
  }
}

export function resolverMarca(marca?: MarcaRelatorio) {
  return {
    nome: marca?.nome?.trim() || BRAND.name,
    contato: marca?.contato?.trim() || BRAND.defaultRemetente.contato,
  };
}

// Carrega o logo local (asset do produto — não há logo por-tenant, task #59
// segue bloqueada) como data URL, pra uso com doc.addImage. Nunca lança:
// devolve "" em caso de falha, e quem chama cai no fallback de texto.
export async function carregarLogoDataUrl(): Promise<string> {
  try {
    const response = await fetch(logoUrl);
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn("Não foi possível carregar o logo para o PDF", error);
    return "";
  }
}
