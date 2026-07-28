// Fase 8.A — checklist da RDC nº 216/2004 (ANVISA), Regulamento Técnico de
// Boas Práticas para Serviços de Alimentação, consolidado com as alterações
// da RDC nº 52/2014. Fonte: texto integral fornecido pelo usuário, revisado
// sanitariamente (v3 — aprovação final registrada no plano de Fase 8).
//
// Este arquivo segue o mesmo formato de checklist-data.ts (Fase 7, RDC 275)
// e só é consumido por scripts/gerar-seed-checklist.mjs — nenhum código de
// runtime do app importa este arquivo diretamente (o conteúdo publicado é
// lido do banco via checklist-modelo-service.ts).
//
// Convenção de item_key: número do subitem normativo sem o prefixo "4."
// (ex.: 4.8.16 -> "8.16"). Itens com sufixo de letra (ex.: "1.1b") são
// desdobramentos [ADAPTAÇÃO] — o mesmo dispositivo-fonte reúne mais de uma
// obrigação verificável independente; nenhuma obrigação nova foi inventada,
// nenhuma foi omitida. O dispositivo de origem de cada item está anotado em
// comentário de linha.
//
// Critérios de "quando aplicável" (N/A) descritos entre parênteses no texto
// de cada item guiam o preenchimento do consultor — a UI já oferece N/A como
// resposta válida para qualquer item; não há campo de schema dedicado para
// condição de N/A (mesma limitação já existente para a RDC 275).
export type { ChecklistItem, ChecklistSection } from "./checklist-types";
import type { ChecklistSection } from "./checklist-types";

export const checklistSections: ChecklistSection[] = [
  {
    id: "edificacao",
    title: "Edificação, Instalações, Equipamentos, Móveis e Utensílios",
    items: [
      { id: "1.1", text: "Fluxo ordenado, sem cruzamentos em todas as etapas da preparação de alimentos." }, // 4.1.1
      { id: "1.1b", text: "Acesso às instalações controlado e independente, não comum a outros usos." }, // 4.1.1 [ADAPTAÇÃO]
      { id: "1.2", text: "Dimensionamento da edificação compatível com todas as operações; separação entre atividades por meios físicos ou outros eficazes, evitando contaminação cruzada." }, // 4.1.2
      { id: "1.3", text: "Piso, parede e teto com revestimento liso, impermeável e lavável." }, // 4.1.3
      { id: "1.3b", text: "Piso, parede e teto íntegros e conservados — sem rachaduras, trincas, goteiras, vazamentos, infiltrações, bolor ou descascamento." }, // 4.1.3 [ADAPTAÇÃO]
      { id: "1.4", text: "Portas e janelas ajustadas aos batentes." }, // 4.1.4
      { id: "1.4b", text: "Portas da área de preparação/armazenamento com fechamento automático." }, // 4.1.4 [ADAPTAÇÃO]
      { id: "1.4c", text: "Aberturas externas (inclusive exaustão) com telas milimetradas removíveis contra vetores e pragas." }, // 4.1.4 [ADAPTAÇÃO]
      { id: "1.5", text: "Instalações abastecidas de água corrente, com conexão a rede de esgoto ou fossa séptica." }, // 4.1.5
      { id: "1.5b", text: "Ralos sifonados e grelhas com dispositivo de fechamento, quando existentes." }, // 4.1.5 [ADAPTAÇÃO]
      { id: "1.6", text: "Caixas de gordura e esgoto com dimensão compatível, localizadas fora da área de preparação/armazenamento, em adequado estado de conservação e funcionamento." }, // 4.1.6
      { id: "1.7", text: "Áreas internas e externas livres de objetos em desuso, sem presença de animais." }, // 4.1.7
      { id: "1.8", text: "Iluminação da área de preparação adequada, sem comprometer higiene e características sensoriais dos alimentos." }, // 4.1.8
      { id: "1.8b", text: "Luminárias sobre a área de preparação protegidas contra explosão e quedas acidentais." }, // 4.1.8 [ADAPTAÇÃO]
      { id: "1.9", text: "Instalações elétricas embutidas ou protegidas em tubulações externas íntegras." }, // 4.1.9
      { id: "1.10", text: "Ventilação garante renovação do ar e ambiente livre de fungos, gases, fumaça, pó e condensação." }, // 4.1.10
      { id: "1.10b", text: "Quando existente equipamento ou sistema capaz de gerar fluxo de ar sobre a área de preparação (climatização, ventilação forçada ou exaustão direcionada), esse fluxo não incide diretamente sobre os alimentos expostos." }, // 4.1.10 [ADAPTAÇÃO — N/A revisado]
      { id: "1.11", text: "Equipamentos e filtros de climatização conservados, com limpeza/troca/manutenção registradas (quando existente sistema de climatização)." }, // 4.1.11
      { id: "1.12", text: "Instalações sanitárias e vestiários sem comunicação direta com área de preparação/armazenamento/refeitório." }, // 4.1.12
      { id: "1.12b", text: "Instalações sanitárias organizadas e conservadas, com portas externas de fechamento automático." }, // 4.1.12 [ADAPTAÇÃO]
      { id: "1.13", text: "Instalações sanitárias com lavatórios, papel higiênico, sabonete líquido inodoro (anti-séptico ou com produto anti-séptico) e sistema de secagem das mãos." }, // 4.1.13
      { id: "1.13b", text: "Coletores de resíduos das instalações sanitárias com tampa acionada sem contato manual." }, // 4.1.13 [ADAPTAÇÃO]
      { id: "1.14", text: "Lavatórios exclusivos para higiene das mãos na área de manipulação, em posição estratégica e número suficiente." }, // 4.1.14
      { id: "1.14b", text: "Lavatórios da área de manipulação com sabonete líquido inodoro (anti-séptico), papel toalha e coletor acionado sem contato manual." }, // 4.1.14 [ADAPTAÇÃO]
      { id: "1.15", text: "Equipamentos, móveis e utensílios em contato com alimentos de materiais que não transmitem substâncias tóxicas, odores ou sabores." }, // 4.1.15
      { id: "1.15b", text: "Equipamentos, móveis e utensílios em adequado estado de conservação, resistentes à corrosão e a higienizações repetidas." }, // 4.1.15 [ADAPTAÇÃO]
      { id: "1.16", text: "Manutenção programada e periódica de equipamentos/utensílios, com registro." }, // 4.1.16 [REVISADO v3 — dividido]
      { id: "1.16b", text: "Calibração de instrumentos/equipamentos de medição, com registro (quando existentes instrumentos sujeitos a calibração)." }, // 4.1.16 [ADAPTAÇÃO v3]
      { id: "1.17", text: "Superfícies de equipamentos, móveis e utensílios lisas, impermeáveis, laváveis, sem rugosidades, frestas ou imperfeições." }, // 4.1.17
    ],
  },
  {
    id: "higienizacao",
    title: "Higienização de Instalações, Equipamentos, Móveis e Utensílios",
    items: [
      { id: "2.1", text: "Instalações, equipamentos, móveis e utensílios higienizados por funcionários capacitados, com frequência que garanta condições apropriadas." }, // 4.2.1
      { id: "2.2", text: "Caixas de gordura limpas periodicamente, com descarte de resíduos conforme legislação." }, // 4.2.2
      { id: "2.3", text: "Operações de limpeza/desinfecção não rotineiras são registradas." }, // 4.2.3
      { id: "2.4", text: "Área de preparação higienizada quantas vezes necessário e imediatamente após o término do trabalho, com precauções contra contaminação por saneantes/aerossóis." }, // 4.2.4
      { id: "2.4b", text: "Ausência de substâncias odorizantes/desodorantes nas áreas de preparação e armazenamento." }, // 4.2.4 [ADAPTAÇÃO]
      { id: "2.5", text: "Produtos saneantes regularizados pelo Ministério da Saúde, usados conforme instruções do fabricante, identificados e guardados em local reservado." }, // 4.2.5
      { id: "2.6", text: "Utensílios/equipamentos de higienização próprios, conservados, em número suficiente, guardados em local reservado, distintos dos usados em partes em contato com alimento." }, // 4.2.6
      { id: "2.7", text: "Funcionários da higienização de instalações sanitárias usam uniformes diferenciados dos usados na manipulação de alimentos." }, // 4.2.7
    ],
  },
  {
    id: "pragas",
    title: "Controle Integrado de Vetores e Pragas Urbanas",
    items: [
      { id: "3.1", text: "Edificação, instalações, equipamentos e utensílios livres de vetores e pragas urbanas, com ações contínuas de controle." }, // 4.3.1
      { id: "3.2", text: "Quando a prevenção não é eficaz, controle químico executado por empresa especializada com produtos regularizados." }, // 4.3.2
      { id: "3.3", text: "Empresa especializada estabelece procedimentos pré/pós-tratamento; equipamentos/utensílios higienizados antes de reutilizar (quando há controle químico)." }, // 4.3.3
    ],
  },
  {
    id: "agua",
    title: "Abastecimento de Água",
    items: [
      { id: "4.1", text: "Uso exclusivo de água potável na manipulação de alimentos.", critico: true }, // 4.4.1 [REVISADO v3 — crítico]
      { id: "4.1b", text: "Solução alternativa de abastecimento com potabilidade atestada semestralmente por laudo laboratorial (quando a fonte não é rede pública)." }, // 4.4.1 [ADAPTAÇÃO]
      { id: "4.2", text: "Gelo fabricado a partir de água potável, mantido em condição que evite contaminação (quando utilizado gelo)." }, // 4.4.2
      { id: "4.3", text: "Vapor em contato com alimentos/superfícies produzido a partir de água potável (quando utilizado vapor)." }, // 4.4.3
      { id: "4.4", text: "Reservatório de água íntegro, tampado, em adequada condição de conservação e higiênica — sem vedação comprometida, contaminação visível ou infiltração (quando existente reservatório/caixa d'água).", critico: true }, // 4.4.4 [REVISADO v3 — dividido]
      { id: "4.4b", text: "Reservatório higienizado em intervalo máximo de 6 meses, com registro da execução (quando existente reservatório/caixa d'água)." }, // 4.4.4 [ADAPTAÇÃO v3]
    ],
  },
  {
    id: "residuos",
    title: "Manejo dos Resíduos",
    items: [
      { id: "5.1", text: "Recipientes de resíduos identificados, íntegros, de fácil higienização/transporte, em número/capacidade suficientes." }, // 4.5.1
      { id: "5.2", text: "Coletores da área de preparação/armazenamento com tampa acionada sem contato manual." }, // 4.5.2
      { id: "5.3", text: "Resíduos coletados frequentemente e estocados em local fechado e isolado da área de preparação/armazenamento." }, // 4.5.3
    ],
  },
  {
    id: "manipuladores",
    title: "Manipuladores",
    items: [
      { id: "6.1", text: "Controle de saúde dos manipuladores registrado, conforme legislação específica." }, // 4.6.1
      { id: "6.2", text: "Manipuladores com lesões/sintomas que comprometam a qualidade higiênico-sanitária afastados da preparação enquanto persistir.", critico: true }, // 4.6.2
      { id: "6.3", text: "Manipuladores com asseio pessoal, uniformes compatíveis, conservados e limpos, trocados no mínimo diariamente, de uso exclusivo interno." }, // 4.6.3
      { id: "6.3b", text: "Roupas e objetos pessoais guardados em local específico e reservado." }, // 4.6.3 [ADAPTAÇÃO]
      { id: "6.4", text: "Manipuladores lavam as mãos ao chegar, antes/depois de manipular alimentos, após interrupções, contato com material contaminado, uso de sanitários e sempre que necessário.", critico: true }, // 4.6.4
      { id: "6.4b", text: "Cartazes de orientação sobre lavagem/anti-sepsia das mãos afixados em locais visíveis, inclusive sanitários e lavatórios." }, // 4.6.4 [ADAPTAÇÃO]
      { id: "6.5", text: "Manipuladores não fumam, falam desnecessariamente, cantam, assobiam, espirram, cospem, tossem, comem, manipulam dinheiro ou praticam atos que contaminem o alimento durante a atividade." }, // 4.6.5
      { id: "6.6", text: "Manipuladores com cabelos presos/protegidos, sem barba, unhas curtas sem esmalte/base, sem adornos ou maquiagem durante a manipulação." }, // 4.6.6
      { id: "6.7", text: "Manipuladores supervisionados e capacitados periodicamente (higiene pessoal, manipulação higiênica, doenças transmitidas por alimentos), com comprovação documental." }, // 4.6.7
      { id: "6.8", text: "Visitantes cumprem os mesmos requisitos de higiene e saúde exigidos dos manipuladores." }, // 4.6.8
    ],
  },
  {
    id: "materias-primas",
    title: "Matérias-Primas, Ingredientes e Embalagens",
    items: [
      { id: "7.1", text: "Critérios de avaliação/seleção de fornecedores especificados; transporte em condições adequadas de higiene/conservação." }, // 4.7.1
      { id: "7.2", text: "Recepção de matérias-primas/ingredientes/embalagens em área protegida e limpa, com medidas contra contaminação." }, // 4.7.2
      { id: "7.3", text: "Matérias-primas, ingredientes e embalagens inspecionados e aprovados na recepção, conforme critérios pré-estabelecidos." }, // 4.7.3 [REVISADO — dividido]
      { id: "7.3b", text: "Embalagens primárias das matérias-primas/ingredientes recebidas íntegras, sem violação ou dano que comprometa a proteção do conteúdo." }, // 4.7.3 [ADAPTAÇÃO]
      { id: "7.3c", text: "Temperatura de matérias-primas/ingredientes perecíveis verificada e registrada no recebimento (quando recebe perecíveis com exigência de controle de temperatura)." }, // 4.7.3 [ADAPTAÇÃO]
      { id: "7.4", text: "Lotes reprovados ou vencidos devolvidos ao fornecedor ou identificados/armazenados separadamente, com destinação final determinada." }, // 4.7.4
      { id: "7.5", text: "Armazenamento em local limpo e organizado, protegido contra contaminantes, identificado, respeitando prazo de validade/ordem de entrada." }, // 4.7.5
      { id: "7.6", text: "Armazenamento sobre paletes/estrados/prateleiras de material liso, resistente, impermeável e lavável, com espaçamento adequado." }, // 4.7.6
    ],
  },
  {
    id: "preparacao",
    title: "Preparação do Alimento",
    items: [
      { id: "8.1", text: "Matérias-primas, ingredientes e embalagens em condições higiênico-sanitárias adequadas para a preparação." }, // 4.8.1
      { id: "8.2", text: "Quantitativo de funcionários, equipamentos, móveis/utensílios compatível com volume, diversidade e complexidade das preparações." }, // 4.8.2
      { id: "8.3", text: "Medidas para minimizar contaminação cruzada; sem contato direto/indireto entre crus, semipreparados e prontos para consumo.", critico: true }, // 4.8.3
      { id: "8.4", text: "Funcionários que manipulam alimentos crus lavam e fazem anti-sepsia das mãos antes de manusear alimentos preparados (quando o estabelecimento manipula alimentos crus antes de alimentos preparados).", critico: true }, // 4.8.4 [N/A revisado v3]
      { id: "8.5", text: "Matérias-primas/ingredientes perecíveis expostos à temperatura ambiente somente pelo tempo mínimo necessário." }, // 4.8.5
      { id: "8.6", text: "Sobras de matérias-primas/ingredientes acondicionadas e identificadas — produto, data de fracionamento, validade após abertura (quando há fracionamento)." }, // 4.8.6
      { id: "8.7", text: "Limpeza das embalagens primárias antes da preparação, quando aplicável." }, // 4.8.7
      { id: "8.8", text: "Tratamento térmico atinge no mínimo 70 °C em todas as partes do alimento, ou combinação tempo/temperatura equivalente (quando o estabelecimento realiza tratamento térmico/cocção).", critico: true }, // 4.8.8 [N/A padronizado v3]
      { id: "8.9", text: "Eficácia do tratamento térmico avaliada por temperatura/tempo e, quando aplicável, textura/cor (quando o estabelecimento realiza tratamento térmico/cocção)." }, // 4.8.9 [N/A padronizado v3]
      { id: "8.10", text: "Para frituras, medidas garantem que óleo/gordura não sejam fonte de contaminação química (quando há fritura)." }, // 4.8.10
      { id: "8.11", text: "Óleos e gorduras aquecidos a no máximo 180 °C, substituídos ao primeiro sinal de alteração físico-química/sensorial (quando há fritura)." }, // 4.8.11
      { id: "8.12", text: "Alimentos congelados descongelados antes do tratamento térmico, salvo recomendação do fabricante para cocção ainda congelado (quando usa alimentos congelados)." }, // 4.8.12
      { id: "8.13", text: "Descongelamento sob refrigeração <5 °C ou em micro-ondas com cocção imediata (quando há descongelamento).", critico: true }, // 4.8.13
      { id: "8.14", text: "Alimentos descongelados mantidos sob refrigeração se não usados imediatamente; não recongelados (quando há descongelamento).", critico: true }, // 4.8.14
      { id: "8.15", text: "Conservação a quente acima de 60 °C por no máximo 6 horas (quando há conservação a quente).", critico: true }, // 4.8.15
      { id: "8.16", text: "Resfriamento de 60 °C a 10 °C em até 2 horas, seguido de refrigeração <5 °C ou congelamento ≤ −18 °C (quando há resfriamento).", critico: true }, // 4.8.16
      { id: "8.17", text: "Prazo máximo de consumo sob refrigeração a 4 °C de 5 dias, reduzido se temperatura entre 4 °C e 5 °C (quando o estabelecimento conserva alimento preparado sob refrigeração).", critico: true }, // 4.8.17 [N/A adicionado v3]
      { id: "8.18", text: "Alimento armazenado sob refrigeração/congelamento identificado (designação, data de preparo, validade), temperatura monitorada e registrada." }, // 4.8.18
      { id: "8.19", text: "Alimentos consumidos crus submetidos a higienização com produtos regularizados, sem deixar resíduos (quando o estabelecimento serve alimentos crus)." }, // 4.8.19
      { id: "8.20", text: "Controle e garantia da qualidade dos alimentos preparados implementado e documentado." }, // 4.8.20
    ],
  },
  {
    id: "armazenamento-transporte",
    title: "Armazenamento e Transporte do Alimento Preparado",
    items: [
      { id: "9.1", text: "Alimentos armazenados/aguardando transporte identificados (designação, data de preparo, validade) e protegidos contra contaminantes." }, // 4.9.1
      { id: "9.2", text: "Armazenamento do alimento preparado em condições adequadas de tempo/temperatura, com temperatura monitorada (quando há armazenamento de alimento preparado antes da distribuição, exposição ou consumo).", critico: true }, // 4.9.2 [REVISADO v3 — dividido]
      { id: "9.2b", text: "Transporte do alimento preparado em condições adequadas de tempo/temperatura, com temperatura monitorada (quando há transporte).", critico: true }, // 4.9.2 [ADAPTAÇÃO v3]
      { id: "9.3", text: "Meios de transporte higienizados, sem vetores/pragas, com cobertura de proteção da carga (quando há transporte)." }, // 4.9.3
      { id: "9.3b", text: "Veículo não transporta outras cargas que comprometam a qualidade higiênico-sanitária do alimento (quando há transporte)." }, // 4.9.3 [ADAPTAÇÃO]
    ],
  },
  {
    id: "exposicao",
    title: "Exposição ao Consumo do Alimento Preparado",
    items: [
      { id: "10.1", text: "Áreas de exposição/consumação organizadas e em adequadas condições, com equipamentos/móveis/utensílios compatíveis e em número suficiente (quando existente área de exposição/consumação)." }, // 4.10.1 [N/A adicionado v3]
      { id: "10.2", text: "Manipuladores fazem anti-sepsia das mãos e usam utensílios ou luvas descartáveis na exposição (quando há operação de exposição/distribuição)." }, // 4.10.2 [N/A adicionado v3]
      { id: "10.3", text: "Equipamentos de exposição/distribuição sob temperatura controlada dimensionados adequadamente, com temperatura monitorada (quando há exposição sob temperatura controlada)." }, // 4.10.3
      { id: "10.4", text: "Equipamento de exposição na consumação dispõe de barreiras de proteção contra contaminação pelo consumidor/outras fontes (quando há consumação local)." }, // 4.10.4
      { id: "10.5", text: "Utensílios de consumação descartáveis ou, quando não-descartáveis, higienizados e armazenados em local protegido (quando há consumação local)." }, // 4.10.5
      { id: "10.6", text: "Ornamentos e plantas na área de consumação não constituem fonte de contaminação (quando há ornamentos/plantas)." }, // 4.10.6
      { id: "10.7", text: "Área de recebimento de pagamento reservada; funcionários dessa atividade não manipulam alimentos (quando há recebimento de pagamentos no estabelecimento)." }, // 4.10.7 [N/A adicionado v3]
    ],
  },
  {
    id: "documentacao",
    title: "Documentação e Registro",
    items: [
      { id: "11.1", text: "Manual de Boas Práticas e POPs disponíveis, acessíveis aos funcionários e à autoridade sanitária." }, // 4.11.1 [REVISADO — não crítico]
      { id: "11.2", text: "POPs contêm instruções sequenciais, frequência de execução e responsáveis; aprovados, datados e assinados." }, // 4.11.2
      { id: "11.3", text: "Registros mantidos por no mínimo 30 dias a partir da preparação." }, // 4.11.3
      { id: "11.4a", text: "POP de higienização de instalações, equipamentos e móveis implementado." }, // 4.11.4.a [ADAPTAÇÃO]
      { id: "11.4b", text: "POP de controle integrado de vetores e pragas urbanas implementado." }, // 4.11.4.b [ADAPTAÇÃO]
      { id: "11.4c", text: "POP de higienização do reservatório implementado." }, // 4.11.4.c [ADAPTAÇÃO]
      { id: "11.4d", text: "POP de higiene e saúde dos manipuladores implementado." }, // 4.11.4.d [ADAPTAÇÃO]
      { id: "11.5", text: "POP de higienização de instalações especifica superfície, método, princípio ativo/concentração, tempo de contato e temperatura." }, // 4.11.5
      { id: "11.6", text: "POP de vetores/pragas contempla prevenção/correção; comprovante da empresa especializada apresentado quando há controle químico." }, // 4.11.6
      { id: "11.7", text: "POP de higienização do reservatório especifica as mesmas informações do item 11.5, com certificado de execução quando terceirizado." }, // 4.11.7
      { id: "11.8", text: "POP de manipuladores especifica etapas, frequência e princípios ativos/produtos utilizados na lavagem e anti-sepsia das mãos." }, // 4.11.8 [REVISADO — dividido]
      { id: "11.8b", text: "POP de manipuladores especifica as medidas a adotar em caso de lesão ou enfermidade que possa comprometer a qualidade higiênico-sanitária do alimento." }, // 4.11.8 [ADAPTAÇÃO]
      { id: "11.8c", text: "POP de manipuladores especifica a periodicidade dos exames de saúde exigidos." }, // 4.11.8 [ADAPTAÇÃO]
      { id: "11.8d", text: "POP de manipuladores especifica o programa de capacitação em higiene: carga horária, conteúdo programático e forma de registro da participação de cada manipulador." }, // 4.11.8 [ADAPTAÇÃO]
    ],
  },
  {
    id: "responsabilidade",
    title: "Responsabilidade",
    items: [
      { id: "12.1", text: "Responsável pela manipulação designado (proprietário ou funcionário capacitado), sem prejuízo de responsabilidade técnica legal quando exigida." }, // 4.12.1
      { id: "12.2", text: "Responsável comprovadamente capacitado em curso abordando contaminantes alimentares, DTA, manipulação higiênica e Boas Práticas." }, // 4.12.2
    ],
  },
];

export const totalChecklistItems = checklistSections.reduce((acc, s) => acc + s.items.length, 0);

export const criticalItemIds = new Set(
  checklistSections.flatMap((s) => s.items.filter((i) => i.critico).map((i) => i.id)),
);

export function contarNCCriticas(
  respostas: Record<string, string | null | undefined> | null | undefined,
): number {
  if (!respostas) return 0;
  let n = 0;
  for (const id of criticalItemIds) if (respostas[id] === "N") n++;
  return n;
}
