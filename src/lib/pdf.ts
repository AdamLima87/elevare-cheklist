import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { checklistSections } from "./checklist-data";
import { calcularPercentual, classificacao, type Inspecao } from "./storage";
import { ensurePlanoAcao } from "./plano-acao";

export async function gerarPDF(insp: Inspecao) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const score = calcularPercentual(insp.respostas);
  const cls = classificacao(score.percentual);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Cores
  const colorElevare = [26, 77, 46]; // #1a4d2e

  // Função para adicionar rodapé e faixa de topo (presente em todas as páginas)
  const addLayoutElements = (pageDoc: jsPDF, pageIndex: number, totalPages: number) => {
    pageDoc.setPage(pageIndex);

    // 1.1 Faixa colorida no topo (8px) - #1a4d2e
    pageDoc.setFillColor(26, 77, 46);
    pageDoc.rect(0, 0, pageWidth, 8, "F");

    // Rodapé
    pageDoc.setDrawColor(26, 77, 46);
    pageDoc.setLineWidth(0.5);
    pageDoc.line(20, pageHeight - 40, pageWidth - 20, pageHeight - 40);

    pageDoc.setFontSize(8);
    pageDoc.setTextColor(100, 100, 100);
    pageDoc.setFont("helvetica", "normal");
    pageDoc.text(
      "Elevare Consultoria · elevareconsultoria.com · (11) 99484-0948",
      20,
      pageHeight - 25,
    );
    pageDoc.text(`Página ${pageIndex} de ${totalPages}`, pageWidth - 20, pageHeight - 25, {
      align: "right",
    });
  };

  // Carregar Logo (URL direta solicitada)
  const logoUrl =
    "https://elevate-check-pro.lovable.app/__l5e/assets-v1/1f90790f-e01b-48e0-8e59-4578c2d4a2f1/elevare-logo.png";
  let logoData = "";
  try {
    const response = await fetch(logoUrl);
    const blob = await response.blob();
    logoData = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn("Não foi possível carregar o logo para o PDF", error);
  }

  // 1. Cabeçalho
  let y = 60;
  if (logoData) {
    // Logo com 50px de altura (approx 37.5pt)
    doc.addImage(logoData, "PNG", 20, 20, 125, 37.5, undefined, "FAST");
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(26, 77, 46);
    doc.text("ELEVARE", 20, 45);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(50, 50, 50);
  doc.text("Relatório de Inspeção", pageWidth - 20, 45, { align: "right" });

  y = 90;

  // 1.3 Dados do Estabelecimento em 2 colunas
  const e = insp.dados.estabelecimento;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(26, 77, 46);
  doc.text("DADOS DO ESTABELECIMENTO", 20, y);
  y += 5;
  doc.setDrawColor(200);
  doc.line(20, y, pageWidth - 20, y);
  y += 15;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(40, 40, 40);

  const leftCol = [
    `Razão Social: ${e.razaoSocial || "-"}`,
    `Nome Fantasia: ${e.nomeFantasia || "-"}`,
    `CNPJ: ${e.cnpj || "-"}`,
    `Atividade: ${e.atividade || "-"}`,
  ];
  const rightCol = [
    `Endereço: ${e.endereco || "-"}`,
    `Bairro: ${e.bairro || "-"}`,
    `Responsável Legal: ${e.respLegalNome || "-"}`,
    `Data da Inspeção: ${e.dataHora ? new Date(e.dataHora).toLocaleDateString("pt-BR") : "-"}`,
  ];

  let tempY = y;
  leftCol.forEach((line) => {
    doc.text(line, 20, tempY);
    tempY += 13;
  });
  tempY = y;
  rightCol.forEach((line) => {
    doc.text(line, pageWidth / 2, tempY);
    tempY += 13;
  });
  y = Math.max(y + leftCol.length * 13, tempY) + 20;

  // 2. Bloco de Resumo
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(26, 77, 46);
  doc.text("RESUMO DO DESEMPENHO", 20, y);
  y += 15;

  // Cards coloridos lado a lado
  const cardW = (pageWidth - 60) / 3;

  // Conformes
  doc.setFillColor(234, 243, 222);
  doc.roundedRect(20, y, cardW, 45, 3, 3, "F");
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text("CONFORMES", 20 + cardW / 2, y + 15, { align: "center" });
  doc.setFontSize(16);
  doc.setTextColor(26, 77, 46);
  doc.text(String(score.sim), 20 + cardW / 2, y + 35, { align: "center" });

  // Não conformes
  doc.setFillColor(252, 235, 235);
  doc.roundedRect(20 + cardW + 10, y, cardW, 45, 3, 3, "F");
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text("NÃO CONFORMES", 20 + cardW + 10 + cardW / 2, y + 15, { align: "center" });
  doc.setFontSize(16);
  doc.setTextColor(185, 28, 28);
  doc.text(String(score.nao), 20 + cardW + 10 + cardW / 2, y + 35, { align: "center" });

  // NA
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(20 + (cardW + 10) * 2, y, cardW, 45, 3, 3, "F");
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text("N/A", 20 + (cardW + 10) * 2 + cardW / 2, y + 15, { align: "center" });
  doc.setFontSize(16);
  doc.setTextColor(120, 120, 120);
  doc.text(String(score.na), 20 + (cardW + 10) * 2 + cardW / 2, y + 35, { align: "center" });

  y += 60;

  // Percentual e Badge
  doc.setFontSize(32);
  doc.setTextColor(26, 77, 46);
  doc.text(`${score.percentual.toFixed(2)}%`, 20, y + 15);

  const badgeColor =
    cls.tone === "success" ? [26, 77, 46] : cls.tone === "warning" ? [234, 179, 8] : [185, 28, 28];
  doc.setFillColor(badgeColor[0], badgeColor[1], badgeColor[2]);
  doc.roundedRect(125, y - 5, 80, 22, 3, 3, "F");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(cls.label, 165, y + 9, { align: "center" });

  // Barra de progresso horizontal
  y += 35;
  const fullBarW = pageWidth - 40;
  doc.setFillColor(230, 230, 230);
  doc.rect(20, y, fullBarW, 6, "F");
  doc.setFillColor(badgeColor[0], badgeColor[1], badgeColor[2]);
  doc.rect(20, y, (fullBarW * score.percentual) / 100, 6, "F");

  y += 30;

  // 3. Tabela de seções
  const sectionRows = checklistSections.map((sec) => {
    const itens = sec.items.map((i) => insp.respostas[i.id]);
    const s = itens.filter((r) => r === "S").length;
    const n = itens.filter((r) => r === "N").length;
    const na = itens.filter((r) => r === "NA").length;
    const totalDaSecao = sec.items.length;
    const val = totalDaSecao === 0 ? 0 : (s / totalDaSecao) * 100;
    const pct = `${val.toFixed(0)}%`;
    return [sec.title, String(s), String(n), String(na), pct, ""];
  });

  autoTable(doc, {
    startY: y,
    head: [["Seção", "S", "N", "NA", "%", "Progresso"]],
    body: sectionRows,
    headStyles: { fillColor: [26, 77, 46], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    styles: { fontSize: 8, cellPadding: 6, valign: "middle", font: "helvetica" },
    columnStyles: {
      4: { fontStyle: "bold", halign: "center" },
      5: { cellWidth: 80 },
    },
    didDrawCell: (data) => {
      if (data.section === "body" && data.column.index === 4) {
        const valStr = data.cell.raw as string;
        if (valStr !== "-") {
          const val = parseInt(valStr);
          if (val >= 76) doc.setTextColor(26, 77, 46);
          else if (val >= 51) doc.setTextColor(180, 140, 0);
          else doc.setTextColor(185, 28, 28);
        } else {
          doc.setTextColor(150, 150, 150);
        }
      }
      if (data.section === "body" && data.column.index === 5) {
        const valStr = data.row.cells[4].raw as string;
        if (valStr !== "-") {
          const val = parseInt(valStr);
          const barX = data.cell.x + 5;
          const barY = data.cell.y + data.cell.height / 2 - 2;
          const fullW = data.cell.width - 10;
          doc.setFillColor(230, 230, 230);
          doc.rect(barX, barY, fullW, 4, "F");
          let bColor = [185, 28, 28];
          if (val >= 76) bColor = [26, 77, 46];
          else if (val >= 51) bColor = [234, 179, 8];
          doc.setFillColor(bColor[0], bColor[1], bColor[2]);
          doc.rect(barX, barY, (fullW * val) / 100, 4, "F");
        }
      }
    },
    margin: { left: 20, right: 20 },
  });

  // 4. Tabela de não conformidades + plano de ação corretivo
  const planoAcao = ensurePlanoAcao(insp.respostas, insp.dados?.planoAcao, insp.dataConclusao);
  const ncRows: string[][] = [];
  checklistSections.forEach((sec) => {
    sec.items.forEach((it) => {
      if (insp.respostas[it.id] === "N") {
        const acao = planoAcao[it.id];
        const prazoFormatado = acao?.prazo
          ? new Date(acao.prazo + "T00:00:00").toLocaleDateString("pt-BR")
          : "";
        ncRows.push([it.id, sec.title, it.text, acao?.texto || "", prazoFormatado]);
      }
    });
  });

  if (ncRows.length) {
    const lastY = (doc as any).lastAutoTable?.finalY ?? y;
    let tableY = lastY + 25;
    if (tableY > pageHeight - 100) {
      doc.addPage();
      tableY = 40;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(26, 77, 46);
    doc.text("NÃO CONFORMIDADES IDENTIFICADAS E PLANO DE AÇÃO", 20, tableY);
    autoTable(doc, {
      startY: tableY + 10,
      head: [["Item", "Seção", "Descrição da Não Conformidade", "Plano de Ação", "Prazo"]],
      body: ncRows,
      headStyles: { fillColor: [26, 77, 46], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      styles: { fontSize: 8, cellPadding: 8, overflow: "linebreak", font: "helvetica" },
      columnStyles: {
        0: {
          fillColor: [252, 235, 235],
          textColor: [163, 45, 45],
          fontStyle: "bold",
          cellWidth: 30,
          halign: "center",
        },
        1: { cellWidth: 75 },
        2: { cellWidth: "auto" },
        3: { cellWidth: "auto" },
        4: { cellWidth: 55, halign: "center" },
      },
      margin: { left: 20, right: 20 },
    });
  }

  // 5. Bloco de observações
  let finalY = (doc as any).lastAutoTable?.finalY + 30;
  if (finalY > pageHeight - 200) {
    doc.addPage();
    finalY = 40;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(26, 77, 46);
  doc.text("OBSERVAÇÕES DO CONSULTOR", 20, finalY);
  finalY += 10;
  const obs = (insp as any).observacoes || "";
  doc.setFillColor(249, 249, 249);
  doc.rect(20, finalY, pageWidth - 40, 80, "F");
  doc.setDrawColor(200);
  doc.setLineDashPattern([3, 3], 0);
  doc.rect(20, finalY, pageWidth - 40, 80, "D");
  doc.setLineDashPattern([], 0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  if (obs) {
    const splitObs = doc.splitTextToSize(obs, pageWidth - 60);
    doc.text(splitObs, 30, finalY + 20);
  }
  finalY += 100;

  // 6. Bloco de assinatura
  if (finalY > pageHeight - 120) {
    doc.addPage();
    finalY = 80;
  }
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.line(20, finalY + 40, 220, finalY + 40);
  doc.line(260, finalY + 40, 400, finalY + 40);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  const techName = e.respTecNome || "Responsável Técnico";
  const techReg =
    e.respTecConselho && e.respTecRegistro
      ? `${e.respTecConselho} ${e.respTecRegistro}`
      : "CRN / Registro";
  doc.text(techName, 20, finalY + 55);
  doc.setFont("helvetica", "normal");
  doc.text(techReg, 20, finalY + 67);
  doc.text("Assinatura", 20, finalY + 79);
  doc.text("Carimbo", 260, finalY + 55);
  const dateStr = e.dataHora
    ? new Date(e.dataHora).toLocaleDateString("pt-BR")
    : new Date().toLocaleDateString("pt-BR");
  doc.text(`Data: ${dateStr}`, pageWidth - 20, finalY + 55, { align: "right" });

  // Finalização: Adiciona layout em todas as páginas
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    addLayoutElements(doc, i, totalPages);
  }

  const filename = `Relatorio_Elevare_${(insp.estabelecimento || "inspecao").replace(/\s+/g, "_")}.pdf`;
  doc.save(filename);
}
