import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { checklistSections } from "./checklist-data";
import { calcularPercentual, classificacao, type Inspecao } from "./storage";

export async function gerarPDF(insp: Inspecao) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const score = calcularPercentual(insp.respostas);
  const cls = classificacao(score.percentual);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const colorElevare = [26, 77, 46] as [number, number, number];

  const addLayout = (pageIndex: number, totalPages: number) => {
    doc.setPage(pageIndex);
    doc.setFillColor(...colorElevare);
    doc.rect(0, 0, pageWidth, 8, "F");
    doc.setDrawColor(...colorElevare);
    doc.setLineWidth(0.5);
    doc.line(20, pageHeight - 40, pageWidth - 20, pageHeight - 40);
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("Elevare Consultoria · elevareconsultoria.com · (11) 99484-0948", 20, pageHeight - 25);
    doc.text(`Página ${pageIndex} de ${totalPages}`, pageWidth - 20, pageHeight - 25, { align: "right" });
  };

  // Cabeçalho
  doc.setFontSize(18);
  doc.setTextColor(...colorElevare);
  doc.setFont("helvetica", "bold");
  doc.text("ELEVARE CONSULTORIA", 20, 35);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text("Segurança dos Alimentos · Diagnóstico Sanitário", 20, 48);
  doc.text("Baseado nas RDC nº 275/2002 e RDC nº 216/2004 — ANVISA", 20, 58);
  doc.setFontSize(14);
  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "bold");
  doc.text("Relatório de Inspeção", pageWidth - 20, 40, { align: "right" });

  // Dados do estabelecimento
  const estab = insp.dados.estabelecimento;
  autoTable(doc, {
    startY: 75,
    head: [["DADOS DO ESTABELECIMENTO", ""]],
    body: [
      ["Razão Social", estab.razaoSocial],
      ["Nome Fantasia", estab.nomeFantasia],
      ["CNPJ", estab.cnpj],
      ["Atividade", estab.atividade],
      ["Endereço", `${estab.endereco}${estab.bairro ? " - Bairro: " + estab.bairro : ""}`],
      ["Responsável Legal", `${estab.respLegalNome}${estab.respLegalCpf ? " (CPF " + estab.respLegalCpf + ")" : ""}`],
      ["Data da Inspeção", new Date(estab.dataHora || insp.dataInicio).toLocaleString("pt-BR")],
    ],
    headStyles: { fillColor: colorElevare, textColor: 255, fontSize: 9, fontStyle: "bold" },
    bodyStyles: { fontSize: 8 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 140 } },
    margin: { left: 20, right: 20 },
  });

  // Resumo de desempenho
  const yAfterTable = (doc as any).lastAutoTable.finalY + 15;
  doc.setFillColor(245, 245, 245);
  doc.rect(20, yAfterTable, pageWidth - 40, 60, "F");
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "bold");
  doc.text("RESUMO DO DESEMPENHO", 30, yAfterTable + 15);
  doc.setFontSize(22);
  const pctColor = cls.tone === "success" ? [59, 109, 17] : cls.tone === "warning" ? [133, 79, 11] : [163, 45, 45];
  doc.setTextColor(...(pctColor as [number, number, number]));
  doc.text(`${score.percentual.toFixed(1)}%`, 30, yAfterTable + 48);
  doc.setFontSize(12);
  doc.text(cls.label, 100, yAfterTable + 48);
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.setFont("helvetica", "normal");
  doc.text(`Conformes: ${score.conformes}`, pageWidth - 180, yAfterTable + 28);
  doc.text(`Não conformes: ${score.naoConformes}`, pageWidth - 180, yAfterTable + 42);
  doc.text(`N/A: ${score.naoAplicaveis}`, pageWidth - 180, yAfterTable + 56);

  // Tabela por seção
  const secaoData = checklistSections.map(s => {
    const resps = s.items.map(i => insp.respostas[i.id]);
    const S = resps.filter(r => r === "S").length;
    const N = resps.filter(r => r === "N").length;
    const NA = resps.filter(r => r === "NA").length;
    const aplicaveis = S + N;
    const pct = aplicaveis > 0 ? ((S / aplicaveis) * 100).toFixed(0) + "%" : "-";
    return [s.title, S, N, NA, pct];
  });

  autoTable(doc, {
    startY: yAfterTable + 75,
    head: [["Seção", "S", "N", "NA", "%"]],
    body: secaoData,
    headStyles: { fillColor: colorElevare, textColor: 255, fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 7 },
    columnStyles: { 0: { cellWidth: 260 }, 1: { halign: "center" }, 2: { halign: "center" }, 3: { halign: "center" }, 4: { halign: "center" } },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    margin: { left: 20, right: 20 },
  });

  // Não conformidades
  const naoConformes: { item: string; secao: string; descricao: string }[] = [];
  checklistSections.forEach(s => {
    s.items.forEach(item => {
      if (insp.respostas[item.id] === "N") {
        naoConformes.push({ item: item.id, secao: s.title, descricao: item.text });
      }
    });
  });

  if (naoConformes.length > 0) {
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 20,
      head: [["Item", "Seção", "Descrição da Não Conformidade"]],
      body: naoConformes.map(n => [n.item, n.secao, n.descricao]),
      headStyles: { fillColor: colorElevare, textColor: 255, fontSize: 8, fontStyle: "bold" },
      bodyStyles: { fontSize: 7 },
      columnStyles: { 0: { cellWidth: 35, halign: "center" }, 1: { cellWidth: 120 }, 2: { cellWidth: "auto" } },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      margin: { left: 20, right: 20 },
    });
  }

  // Observações e assinatura
  const yFinal = (doc as any).lastAutoTable.finalY + 20;
  if (yFinal + 100 > pageHeight - 60) doc.addPage();
  const yObs = (doc as any).lastAutoTable.finalY + 20;

  doc.setFontSize(9);
  doc.setTextColor(...colorElevare);
  doc.setFont("helvetica", "bold");
  doc.text("OBSERVAÇÕES DO CONSULTOR", 20, yObs + 15);
  doc.setDrawColor(200, 200, 200);
  doc.rect(20, yObs + 20, pageWidth - 40, 50, "S");

  doc.setFontSize(9);
  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "bold");
  doc.text("Responsável Técnico", 20, yObs + 90);
  doc.setFont("helvetica", "normal");
  doc.text(estab.respTecNome || "", 20, yObs + 103);
  doc.text(estab.respTecConselho ? `${estab.respTecConselho} ${estab.respTecRegistro}` : "", 20, yObs + 115);
  doc.setDrawColor(100, 100, 100);
  doc.line(20, yObs + 138, 200, yObs + 138);
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text("Assinatura", 20, yObs + 148);
  doc.text(`Data: ${new Date().toLocaleDateString("pt-BR")}`, pageWidth - 20, yObs + 138, { align: "right" });

  // Aplicar layout em todas as páginas
  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) addLayout(i, totalPages);

  doc.save(`Relatorio_Elevare_${insp.estabelecimento.replace(/\s+/g, "_")}.pdf`);
}
