import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { BRAND_BLUE, aplicarLayoutEmTodasAsPaginas, carregarLogoDataUrl, resolverMarca, type MarcaRelatorio } from "./pdf-layout";

// Fase B — PDF da proposta comercial. Recebe dados já carregados (nunca
// consulta o Supabase) pra poder rodar tanto na área autenticada quanto na
// futura página pública /documento/$token. Identifica claramente o número
// da revisão no cabeçalho — nunca "a proposta" de forma genérica.
export interface PropostaPdfItem {
  nome: string;
  descricao?: string | null;
  valor: number;
}

export interface PropostaPdfData {
  numeroRevisao: number;
  clienteNome: string;
  itens: PropostaPdfItem[];
  valorTotal: number;
  condicoes?: string | null;
  validade?: string | null;
  observacoes?: string | null;
  status?: string | null;
  marca?: MarcaRelatorio;
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export async function gerarPdfProposta(data: PropostaPdfData): Promise<Blob> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const { nome: marcaNome, contato: marcaContato } = resolverMarca(data.marca);
  const pageWidth = doc.internal.pageSize.getWidth();
  const logoData = await carregarLogoDataUrl();

  let y = 60;
  if (logoData) {
    doc.addImage(logoData, "PNG", 20, 22, 101, 37.5, undefined, "FAST");
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(...BRAND_BLUE);
    doc.text(marcaNome.toUpperCase(), 20, 45);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(50, 50, 50);
  doc.text("Proposta Comercial", pageWidth - 20, 45, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Revisão ${data.numeroRevisao}`, pageWidth - 20, 60, { align: "right" });

  y = 100;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BRAND_BLUE);
  doc.text("CLIENTE", 20, y);
  y += 5;
  doc.setDrawColor(200);
  doc.line(20, y, pageWidth - 20, y);
  y += 15;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  doc.text(data.clienteNome || "-", 20, y);
  y += 30;

  const rows = data.itens.map((item) => [item.nome, item.descricao || "", formatarMoeda(item.valor)]);
  autoTable(doc, {
    startY: y,
    head: [["Serviço", "Descrição", "Valor"]],
    body: rows,
    headStyles: { fillColor: [...BRAND_BLUE], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    styles: { fontSize: 9, cellPadding: 8, overflow: "linebreak", font: "helvetica" },
    columnStyles: { 2: { halign: "right", cellWidth: 90 } },
    margin: { left: 20, right: 20 },
  });

  let finalY = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 20;
  const pageHeight = doc.internal.pageSize.getHeight();
  if (finalY > pageHeight - 150) {
    doc.addPage();
    finalY = 60;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...BRAND_BLUE);
  doc.text(`Valor total: ${formatarMoeda(data.valorTotal)}`, pageWidth - 20, finalY, { align: "right" });
  finalY += 25;

  if (data.condicoes) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...BRAND_BLUE);
    doc.text("CONDIÇÕES", 20, finalY);
    finalY += 15;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    const linhas = doc.splitTextToSize(data.condicoes, pageWidth - 40);
    doc.text(linhas, 20, finalY);
    finalY += linhas.length * 12 + 15;
  }

  if (data.validade) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Validade: ${data.validade}`, 20, finalY);
    finalY += 15;
  }

  if (data.observacoes) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...BRAND_BLUE);
    doc.text("OBSERVAÇÕES", 20, finalY);
    finalY += 15;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    const linhasObs = doc.splitTextToSize(data.observacoes, pageWidth - 40);
    doc.text(linhasObs, 20, finalY);
  }

  aplicarLayoutEmTodasAsPaginas(doc, marcaNome, marcaContato);
  return doc.output("blob");
}
