import jsPDF from "jspdf";
import { BRAND_BLUE, aplicarLayoutEmTodasAsPaginas, carregarLogoDataUrl, resolverMarca, type MarcaRelatorio } from "./pdf-layout";

// Fase B — PDF do contrato. Usa SÓ o snapshot já renderizado
// (crm_contratos.dados.conteudo_renderizado) — nunca relê dados atuais do
// cliente/template. Um contrato já gerado tem que produzir sempre o mesmo
// PDF, para sempre, mesmo que a Conta ou o template mudem depois.
export interface ContratoPdfSecao {
  titulo: string;
  corpo: string;
}

export interface ContratoPdfAssinaturaEletronica {
  nome: string;
  emailMascarado: string;
  assinadoEm: string;
  hash: string;
}

export interface ContratoPdfData {
  clienteNome: string;
  secoes: ContratoPdfSecao[];
  status?: string | null;
  marca?: MarcaRelatorio;
  assinaturaEletronica?: ContratoPdfAssinaturaEletronica | null;
}

export async function gerarPdfContrato(data: ContratoPdfData): Promise<Blob> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const { nome: marcaNome, contato: marcaContato } = resolverMarca(data.marca);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
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
  doc.text("Contrato de Prestação de Serviços", pageWidth - 20, 45, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(data.clienteNome || "-", pageWidth - 20, 60, { align: "right" });

  y = 100;
  for (const secao of data.secoes) {
    if (y > pageHeight - 100) {
      doc.addPage();
      y = 60;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...BRAND_BLUE);
    doc.text(secao.titulo, 20, y);
    y += 16;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);
    const linhas = doc.splitTextToSize(secao.corpo || "", pageWidth - 40);
    for (const linha of linhas) {
      if (y > pageHeight - 60) {
        doc.addPage();
        y = 60;
      }
      doc.text(linha, 20, y);
      y += 12;
    }
    y += 15;
  }

  if (y > pageHeight - 140) {
    doc.addPage();
    y = 80;
  }
  y += 30;

  if (data.assinaturaEletronica) {
    // Assinatura eletrônica simples (MP 2.200-2/2001, art. 10 §2º) — o hash
    // aqui é o mesmo calculado server-side em crm_verificar_e_assinar_otp,
    // sempre derivado do snapshot já congelado, nunca de nada montado neste
    // gerador de PDF.
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.rect(20, y, 440, 90);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...BRAND_BLUE);
    doc.text("Assinado eletronicamente", 30, y + 20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);
    doc.text(`Signatário: ${data.assinaturaEletronica.nome} (${data.assinaturaEletronica.emailMascarado})`, 30, y + 38);
    doc.text(`Data/hora: ${new Date(data.assinaturaEletronica.assinadoEm).toLocaleString("pt-BR")}`, 30, y + 52);
    doc.text(`Hash de integridade: ${data.assinaturaEletronica.hash.slice(0, 32)}…`, 30, y + 66);
    const textoLegal = doc.splitTextToSize(
      "Assinatura eletrônica simples, nos termos do art. 10, §2º da Medida Provisória 2.200-2/2001.",
      420,
    );
    doc.text(textoLegal, 30, y + 80);
  } else {
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(20, y, 220, y);
    doc.line(260, y, 460, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("CONTRATADA", 20, y + 15);
    doc.text("CONTRATANTE", 260, y + 15);
  }

  aplicarLayoutEmTodasAsPaginas(doc, marcaNome, marcaContato);
  return doc.output("blob");
}
