import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { calcularPercentual, calcularSecoes, classificacao, type Inspecao } from "./storage";
import { contarNCCriticasModelo, type ChecklistModeloResolvido } from "./checklist-modelo-service";
import { ensurePlanoAcao } from "./plano-acao";
import { BRAND } from "./brand";
import {
  BRAND_BLUE,
  BRAND_GREEN,
  aplicarLayoutEmTodasAsPaginas,
  carregarLogoDataUrl,
  resolverMarca,
  type MarcaRelatorio,
} from "./pdf-layout";

export type { MarcaRelatorio };

// Fase 7 — quem chama gerarPDF já carregou o modelo resolvido (via
// carregarChecklistModelo, nunca via hook — pdf.ts não é um componente
// React) e o passa aqui; nada de Supabase é chamado dentro desta função.
export async function gerarPDF(
  insp: Inspecao,
  modelo: ChecklistModeloResolvido,
  opts?: { reincidencias?: Record<string, number>; marca?: MarcaRelatorio },
) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const score = calcularPercentual(insp.respostas);
  const ncCriticas = contarNCCriticasModelo(modelo, insp.respostas);
  const cls = classificacao(score.percentual, ncCriticas);
  const reincidencias = opts?.reincidencias ?? {};
  const { nome: marcaNome, contato: marcaContato } = resolverMarca(opts?.marca);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const logoData = await carregarLogoDataUrl();

  // 1. Cabeçalho
  let y = 60;
  if (logoData) {
    // Logo RDCheck mantendo a proporção real (~2.69:1) para não distorcer.
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
  doc.text("Relatório de Inspeção", pageWidth - 20, 45, { align: "right" });

  // A logo é sempre a do RDCheck (produto) — a consultoria (tenant) aparece
  // como texto no cabeçalho, não como logo própria. Só exibe a linha quando
  // a consultoria configurou um nome (evita repetir "RDCheck" embaixo do
  // próprio logo do RDCheck quando ninguém personalizou ainda).
  let headerSubtitleY = 58;
  if (marcaNome && marcaNome !== BRAND.name) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(marcaNome, pageWidth - 20, headerSubtitleY, { align: "right" });
    headerSubtitleY += 13;
  }

  // Fase 8.B — identifica a legislação/modelo usado nesta inspeção
  // específica (nunca assume "a" legislação, já que mais de um modelo pode
  // estar em uso simultaneamente no tenant).
  if (modelo.modeloNome) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(modelo.modeloNome, pageWidth - 20, headerSubtitleY, { align: "right" });
  }

  y = 90;

  // 1.3 Dados do Estabelecimento em 2 colunas
  const e = insp.dados.estabelecimento;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BRAND_BLUE);
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
  doc.setTextColor(...BRAND_BLUE);
  doc.text("RESUMO DO DESEMPENHO", 20, y);
  y += 15;

  // Cards coloridos lado a lado
  const cardW = (pageWidth - 60) / 3;

  // Conformes
  doc.setFillColor(226, 246, 235);
  doc.roundedRect(20, y, cardW, 45, 3, 3, "F");
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text("CONFORMES", 20 + cardW / 2, y + 15, { align: "center" });
  doc.setFontSize(16);
  doc.setTextColor(...BRAND_GREEN);
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
  doc.setTextColor(...BRAND_BLUE);
  doc.text(`${score.percentual.toFixed(2)}%`, 20, y + 15);

  const badgeColor =
    cls.tone === "success" ? [...BRAND_GREEN] : cls.tone === "warning" ? [234, 179, 8] : [185, 28, 28];
  doc.setFillColor(badgeColor[0], badgeColor[1], badgeColor[2]);
  doc.roundedRect(125, y - 5, 80, 22, 3, 3, "F");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(cls.label, 165, y + 9, { align: "center" });

  if (cls.limitadaPorCritico) {
    doc.setFontSize(8);
    doc.setTextColor(185, 28, 28);
    doc.setFont("helvetica", "bold");
    doc.text(
      `Classificação limitada a REGULAR: ${ncCriticas} não conformidade(s) em item(ns) crítico(s) de risco sanitário.`,
      215,
      y + 9,
    );
    doc.setFont("helvetica", "normal");
  }

  // Barra de progresso horizontal
  y += 35;
  const fullBarW = pageWidth - 40;
  doc.setFillColor(230, 230, 230);
  doc.rect(20, y, fullBarW, 6, "F");
  doc.setFillColor(badgeColor[0], badgeColor[1], badgeColor[2]);
  doc.rect(20, y, (fullBarW * score.percentual) / 100, 6, "F");

  y += 30;

  // 3. Tabela de seções — mesmo critério da nota geral: NA fora do denominador
  const sectionRows = calcularSecoes(insp.respostas, modelo).map((sec) => {
    const pct = sec.percentual === null ? "-" : `${sec.percentual.toFixed(0)}%`;
    return [sec.title, String(sec.sim), String(sec.nao), String(sec.na), pct, ""];
  });

  autoTable(doc, {
    startY: y,
    head: [["Seção", "S", "N", "NA", "%", "Progresso"]],
    body: sectionRows,
    headStyles: { fillColor: [...BRAND_BLUE], textColor: 255, fontStyle: "bold" },
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
          if (val >= 76) doc.setTextColor(...BRAND_GREEN);
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
          if (val >= 76) bColor = [...BRAND_GREEN];
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
  modelo.secoes.forEach((sec) => {
    sec.items.forEach((it) => {
      if (insp.respostas[it.id] === "N") {
        const acao = planoAcao[it.id];
        const prazoFormatado = acao?.prazo
          ? new Date(acao.prazo + "T00:00:00").toLocaleDateString("pt-BR")
          : "";
        const marcadores: string[] = [];
        if (modelo.criticalItemIds.has(it.id)) marcadores.push("[CRÍTICO]");
        if (reincidencias[it.id]) marcadores.push(`[REINCIDENTE — ${reincidencias[it.id]}ª inspeção consecutiva]`);
        const descricao = marcadores.length ? `${marcadores.join(" ")} ${it.text}` : it.text;
        ncRows.push([it.id, sec.title, descricao, acao?.texto || "", prazoFormatado]);
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
    doc.setTextColor(...BRAND_BLUE);
    doc.text("NÃO CONFORMIDADES IDENTIFICADAS E PLANO DE AÇÃO", 20, tableY);
    autoTable(doc, {
      startY: tableY + 10,
      head: [["Item", "Seção", "Descrição da Não Conformidade", "Plano de Ação", "Prazo"]],
      body: ncRows,
      headStyles: { fillColor: [...BRAND_BLUE], textColor: 255 },
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
  doc.setTextColor(...BRAND_BLUE);
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
  aplicarLayoutEmTodasAsPaginas(doc, marcaNome, marcaContato);

  const modeloSlug = modelo.modeloCodigo ? `_${modelo.modeloCodigo}` : "";
  const filename = `Relatorio_RDCheck${modeloSlug}_${(insp.estabelecimento || "inspecao").replace(/\s+/g, "_")}.pdf`;
  doc.save(filename);
}
