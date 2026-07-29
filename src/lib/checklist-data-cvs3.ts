// Fase 9.E/9.F — checklist da Portaria CVS nº 3, de 3 de julho de 2026
// (Governo do Estado de São Paulo), publicada no DOE-SP em 06/07/2026,
// vigência em 90 dias da publicação (Art. 3º). Fonte: texto oficial integral
// fornecido pelo usuário, extraído/analisado na Fase 9.B e revisado
// sanitariamente na Fase 9.E (v2 — aprovação final registrada no plano de
// Fase 9).
//
// Este arquivo segue o mesmo formato de checklist-data.ts (Fase 7, RDC 275)
// e checklist-data-rdc216.ts (Fase 8.A) e só é consumido por
// scripts/gerar-seed-checklist.mjs — nenhum código de runtime do app importa
// este arquivo diretamente (o conteúdo publicado é lido do banco via
// checklist-modelo-service.ts).
//
// Convenção de item_key: número da seção (1-19, numeração própria deste
// checklist, sem relação com a numeração de artigos da norma) + número
// sequencial do item. Itens com sufixo de letra (ex.: "1.1b") são
// desdobramentos [ADAPTAÇÃO] — o mesmo dispositivo-fonte reúne mais de uma
// obrigação verificável independente; nenhuma obrigação nova foi inventada,
// nenhuma foi omitida. O dispositivo de origem (artigo/parágrafo/inciso) de
// cada item está anotado em comentário de linha.
//
// Critérios de "quando aplicável" (N/A) descritos entre parênteses no texto
// de cada item guiam o preenchimento do consultor — a UI já oferece N/A como
// resposta válida para qualquer item; não há campo de schema dedicado para
// condição de N/A (mesma limitação já existente para a RDC 275/RDC 216).
//
// Nota de aplicação — itens 3.1/3.2: a exigência de Responsável Técnico não
// decorre da própria CVS 3/2026 (que só remete à "legislação de licenciamento
// aplicável", Art. 19) — decorre da legislação municipal/estadual de
// licenciamento específica do tipo de estabelecimento. O consultor deve
// verificar essa legislação antes de aplicar a condição de N/A entre os itens
// 3.1 e 3.2 (mutuamente excludentes).
export type { ChecklistItem, ChecklistSection } from "./checklist-types";
import type { ChecklistSection } from "./checklist-types";

export const checklistSections: ChecklistSection[] = [
  {
    id: "controle-saude",
    title: "Controle de Saúde dos Funcionários",
    items: [
      { id: "1.1", text: "Controle de saúde dos manipuladores segue as diretrizes do PCMSO e da norma regulamentadora vigente." }, // Art. 8
      { id: "1.1b", text: "São realizados exames laboratoriais de coprocultura e parasitológico na admissão e no acompanhamento periódico de todos os manipuladores." }, // Art. 8 [ADAPTAÇÃO]
      { id: "1.2", text: "Exames de coprocultura e parasitológico realizados anualmente para manipuladores diretos, para quem distribui/oferta refeições e para os envolvidos em atividades com alimentos totalmente embalados." }, // Art. 9
      { id: "1.3", text: "Atestados de saúde (ou cópias), com indicação dos exames laboratoriais, disponíveis para consulta." }, // Art. 10
      { id: "1.4", text: "Manipuladores com sinais/sintomas de doenças infecciosas, lesões de pele/mucosas/unhas ou feridas nas mãos/braços afastados da manipulação enquanto persistirem essas condições.", critico: true }, // Art. 11
    ],
  },
  {
    id: "higiene-seguranca",
    title: "Higiene e Segurança dos Funcionários",
    items: [
      { id: "2.1", text: "Funcionários que manipulam alimentos apresentam barba/bigode raspados, unhas curtas/limpas sem esmalte/base, sem maquiagem e sem adornos (colares, pulseiras, brincos, piercings, relógios, anéis) (quando a função não se restringe a transporte/recebimento/reposição de embalados)." }, // Art. 12
      { id: "2.1b", text: "Objetos pessoais de uso no trabalho são guardados nos bolsos inferiores do uniforme (mesma exceção do item anterior)." }, // Art. 12 [ADAPTAÇÃO]
      { id: "2.2", text: "Uniformes bem conservados, limpos, com troca diária, usados só nas dependências internas." }, // Art. 13
      { id: "2.2b", text: "Calçados fechados, antiderrapantes e em boas condições." }, // Art. 13 [ADAPTAÇÃO]
      { id: "2.2c", text: "Cabelos mantidos presos e totalmente protegidos com redes/toucas." }, // Art. 13 [ADAPTAÇÃO]
      { id: "2.3", text: "Empresa disponibiliza EPI limpo, em bom estado, em quantidade suficiente." }, // Art. 14 caput
      { id: "2.3b", text: "Uso obrigatório de EPI (blusa, capa térmica, luvas, botas impermeáveis) em câmaras frias (quando existente câmara fria)." }, // Art. 14 §1 [ADAPTAÇÃO]
      { id: "2.3c", text: "Uso de EPI (avental, luvas, botas impermeáveis) na higienização, sem panos/sacos plásticos para proteção do uniforme." }, // Art. 14 §2 [ADAPTAÇÃO]
      { id: "2.3d", text: "Vedação de materiais termossensíveis perto de calor e de botas com água fervente respeitada." }, // Art. 14 §3 [ADAPTAÇÃO]
      { id: "2.3e", text: "Luva de borracha de cano longo usada na manipulação de saneantes, higienizada/armazenada após o uso." }, // Art. 14 §4 [ADAPTAÇÃO]
      { id: "2.4", text: "Manipuladores realizam antissepsia das mãos com frequência adequada, inclusive antes de utensílios higienizados ou luvas descartáveis.", critico: true }, // Art. 15 caput
      { id: "2.4b", text: "Vedação de luvas descartáveis em processos com calor/moagem/trituração/mistura respeitada." }, // Art. 15 §1 [ADAPTAÇÃO]
      { id: "2.4c", text: "Luvas de malha de aço usadas no corte de carnes, higienizadas/armazenadas após o uso (quando há corte de carnes)." }, // Art. 15 §2 [ADAPTAÇÃO]
      { id: "2.4d", text: "Máscaras, quando usadas, são descartáveis com critério/frequência de troca documentados (quando usa máscaras)." }, // Art. 15 §3 [ADAPTAÇÃO]
      { id: "2.5", text: "Manipuladores respeitam a vedação de cuspir, tossir ou espirrar sobre alimentos/superfícies, mascar ou comer durante a manipulação.", critico: true }, // Art. 16 [REVISADO v2 — dividido]
      { id: "2.5b", text: "Vedação das demais condutas do artigo durante a manipulação respeitada (falar desnecessariamente, cantar, assobiar, tocar corpo/cabelo, fumar, manipular dinheiro, usar celular, entre outras)." }, // Art. 16 [ADAPTAÇÃO v2]
      { id: "2.6", text: "Funcionários higienizam as mãos nos momentos especificados (chegada, sanitário, tossir/espirrar, tocar corpo/cabelo, panos de limpeza, fumar, resíduos, dinheiro/cartões/eletrônicos, sacarias/caixas/sapatos, alimentos crus, reinício do serviço).", critico: true }, // Art. 17
      { id: "2.7", text: "Cartazes com instruções ilustradas de higienização das mãos afixados nas pias exclusivas, inclusive sanitários/vestiários." }, // Art. 18 caput
      { id: "2.7b", text: "Procedimento de lavagem das mãos segue as etapas descritas (umedecer, lavar por no mínimo 40 segundos, enxaguar, secar com papel-toalha descartável, antissepsia adicional se o sabonete não for antisséptico).", critico: true }, // Art. 18 §1
      { id: "2.7c", text: "Coletor de papel com abertura sem contato manual próximo ao lavatório." }, // Art. 18 §1 [ADAPTAÇÃO]
      { id: "2.7d", text: "Produtos antissépticos usados são aprovados pela Anvisa para antissepsia de mãos." }, // Art. 18 §2 [ADAPTAÇÃO]
    ],
  },
  {
    id: "responsabilidade-capacitacao",
    title: "Responsabilidade Técnica, Capacitação e Visitantes",
    items: [
      { id: "3.1", text: "Estabelecimento possui Responsável Técnico quando exigido pela legislação de licenciamento aplicável (verificar a legislação de licenciamento específica do tipo de estabelecimento antes de aplicar N/A entre este item e o 3.2 — a CVS 3/2026 não define, por si só, essa obrigatoriedade)." }, // Art. 19
      { id: "3.2", text: "Quando não há exigência de RT, a responsabilidade pelas Boas Práticas está formalmente a cargo do proprietário ou de funcionário capacitado que acompanha integralmente o processo (mesma verificação do item 3.1)." }, // Art. 20
      { id: "3.3", text: "Programa de educação permanente em Boas Práticas, com registro nominal de participação." }, // Art. 21
      { id: "3.4", text: "Todos os manipuladores comprovam curso de Boas Práticas com carga horária mínima de 8 horas, cobrindo DTHA, higiene/saúde, qualidade da água/pragas, qualidade sanitária e POPs de higienização." }, // Art. 22
      { id: "3.5", text: "RT/funcionário capacitado tem autoridade para atualizar manual/POPs, acompanhar inspeções e notificar surtos de DTHA." }, // Art. 23
      { id: "3.6", text: "Visitantes são instruídos sobre Boas Práticas e cumprem os requisitos de higiene/saúde exigidos dos funcionários." }, // Art. 24
      { id: "3.6b", text: "Visitantes que supervisionam/fiscalizam ou executam manutenção estão identificados e paramentados (protetores de cabelo/barba, EPI) quando a atividade exigir." }, // Art. 24 [ADAPTAÇÃO]
    ],
  },
  {
    id: "recebimento",
    title: "Recebimento e Controle de Mercadorias",
    items: [
      { id: "4.1", text: "Critérios definidos para avaliação/seleção de fornecedores, incluindo licenciamento sanitário/registro no órgão competente." }, // Art. 25
      { id: "4.2", text: "Entregadores/veículos se apresentam em condições de higiene, e o recebimento ocorre em área protegida (chuva/sol/poeira, sem materiais inservíveis)." }, // Art. 26
      { id: "4.3", text: "Embalagens de matérias-primas/industrializados/prontos estão limpas e íntegras no recebimento." }, // Art. 27
      { id: "4.4", text: "No recebimento são feitas avaliações quantitativa/qualitativa/sensorial (cor, aparência, odor, textura) e conferida a validade." }, // Art. 28
      { id: "4.5", text: "Produtos congelados recebidos não apresentam indícios de descongelamento/recongelamento.", critico: true }, // Art. 29
      { id: "4.6", text: "Temperaturas de recebimento conferidas/registradas: congelados ≤ -12°C; pescados refrigerados 2-3°C; pescados/carnes cruas 0-5°C; carnes/derivados 4-7°C; demais produtos 4-10°C; aquecidos acima de 60°C.", critico: true }, // Art. 30
      { id: "4.7", text: "Produtos fora dos critérios devolvidos ao fornecedor ou segregados em local reservado/identificado." }, // Art. 31
      { id: "4.8", text: "Mercadorias não ficam dispostas no piso, permanecem na recepção só o tempo necessário à avaliação, sem permanência em pátios/plataformas." }, // Art. 32
    ],
  },
  {
    id: "armazenamento",
    title: "Armazenamento de Produtos",
    items: [
      { id: "5.1", text: "Local com dimensão compatível ao volume, totalmente isolado do ambiente externo." }, // Art. 33 I
      { id: "5.1b", text: "Ambiente limpo, livre de entulho/tóxico, ventilado, organizado, temperatura monitorada e registrada." }, // Art. 33 II [ADAPTAÇÃO]
      { id: "5.1c", text: "Produtos protegidos de luz solar direta, conforme fabricante." }, // Art. 33 III [ADAPTAÇÃO]
      { id: "5.1d", text: "Alimentos/embalagens/descartáveis mantidos separados de materiais de limpeza." }, // Art. 33 IV [ADAPTAÇÃO]
      { id: "5.1e", text: "Empilhamento segue recomendações do fabricante." }, // Art. 33 V [ADAPTAÇÃO]
      { id: "5.1f", text: "Produtos protegidos contra contaminantes, embalagens íntegras, sem deformação/sujidade/ferrugem." }, // Art. 33 VI [ADAPTAÇÃO]
      { id: "5.1g", text: "Identificação visível garante rastreabilidade e controle de validade." }, // Art. 33 VII [ADAPTAÇÃO]
      { id: "5.1h", text: "Uso do sistema PVPS ou PEPS." }, // Art. 33 VIII [ADAPTAÇÃO]
      { id: "5.1i", text: "Produtos sem contato direto com o piso, com altura suficiente para higienização." }, // Art. 33 IX [ADAPTAÇÃO]
      { id: "5.1j", text: "Distância mínima de 10 cm da parede e 60 cm do forro respeitada." }, // Art. 33 X [ADAPTAÇÃO]
      { id: "5.1k", text: "Paletes/estrados de material liso/resistente/impermeável/lavável (quando em área exclusiva de depósito seco de varejo/atacado)." }, // Art. 33 XI [ADAPTAÇÃO]
      { id: "5.2", text: "Vedação de caixas de madeira respeitada, salvo exceções (peixe salgado/seco rotulado; embalagens de hortifrutícolas)." }, // Art. 34
      { id: "5.3", text: "Caixas de papelão removidas/revestidas em temperatura ambiente, ou em equipamento exclusivo/revestidas sob refrigeração, sempre íntegras." }, // Art. 35
      { id: "5.4", text: "Produtos impróprios/vencidos identificados e segregados fora da área de manipulação." }, // Art. 36
      { id: "5.5", text: "Produtos transferidos de embalagem original acondicionados/identificados (fornecedor, produto, conservação, validade, data da transferência)." }, // Art. 37
      { id: "5.5b", text: "Vedação de reaproveitar embalagens/sacolas/sacos de lixo para armazenar alimentos respeitada." }, // Art. 37 § único [ADAPTAÇÃO]
      { id: "5.6", text: "Produtos com validade reduzida após aberto identificados com data de abertura e nova validade." }, // Art. 38
      { id: "5.7", text: "Alimentos pré-preparados/preparados armazenados protegidos e identificados (designação, preparo, validade)." }, // Art. 39
      { id: "5.8", text: "Volumes permitem resfriamento do centro geométrico; prontos em cima, pré-preparados no meio, crus embaixo, separados entre si.", critico: true }, // Art. 40
      { id: "5.8b", text: "Refrigerador regulado para a menor temperatura requerida entre os produtos armazenados." }, // Art. 40 § único [ADAPTAÇÃO]
      { id: "5.9", text: "Após higienização, temperatura interna reduzida/estabilizada antes de armazenar." }, // Art. 41
      { id: "5.10", text: "Produtos crus/que exalam odor/exsudam protegidos; não estocados sob condensadores/evaporadores.", critico: true }, // Art. 42
      { id: "5.11", text: "Equipamentos de refrigeração em bom estado, sem gelo acumulado, nunca desligados por economia, sem termômetro de haste de vidro." }, // Art. 43
      { id: "5.12a", text: "Congelados entre 0 e -5°C respeitam validade de 10 dias (quando trabalha nessa faixa).", critico: true }, // Art. 44 I [ADAPTAÇÃO]
      { id: "5.12b", text: "Congelados entre -6 e -10°C respeitam validade de 20 dias (quando trabalha nessa faixa).", critico: true }, // Art. 44 I [ADAPTAÇÃO]
      { id: "5.12c", text: "Congelados entre -11 e -18°C respeitam validade de 30 dias (quando trabalha nessa faixa).", critico: true }, // Art. 44 I [ADAPTAÇÃO]
      { id: "5.12d", text: "Congelados abaixo de -18°C respeitam validade de 90 dias (quando trabalha nessa faixa).", critico: true }, // Art. 44 I [ADAPTAÇÃO]
      { id: "5.13a", text: "Pescados/produtos crus mantidos a até 2°C respeitam validade de 3 dias (quando trabalha com o produto).", critico: true }, // Art. 44 II [ADAPTAÇÃO]
      { id: "5.13b", text: "Pescados pós-cocção mantidos a até 2°C respeitam validade de 1 dia (quando trabalha com o produto).", critico: true }, // Art. 44 II [ADAPTAÇÃO]
      { id: "5.13c", text: "Alimentos pós-cocção exceto pescados mantidos a até 4°C respeitam validade de 3 dias (quando trabalha com o produto).", critico: true }, // Art. 44 II [ADAPTAÇÃO]
      { id: "5.13d", text: "Carnes bovina/suína/aves cruas mantidas a até 4°C respeitam validade de 3 dias (quando trabalha com o produto).", critico: true }, // Art. 44 II [ADAPTAÇÃO]
      { id: "5.13e", text: "Espetos/bife rolê/carne moída temperada crua mantidos a até 4°C respeitam validade de 2 dias (quando trabalha com o produto).", critico: true }, // Art. 44 II [ADAPTAÇÃO]
      { id: "5.13f", text: "Frios/embutidos fatiados/moídos mantidos a até 4°C respeitam validade de 3 dias (quando trabalha com o produto).", critico: true }, // Art. 44 II [ADAPTAÇÃO]
      { id: "5.13g", text: "Maionese e misturas mantidas a até 4°C respeitam validade de 2 dias (quando trabalha com o produto).", critico: true }, // Art. 44 II [ADAPTAÇÃO]
      { id: "5.13h", text: "Sobremesas/confeitaria/laticínios mantidos a até 4°C respeitam validade de 3 dias (quando trabalha com o produto).", critico: true }, // Art. 44 II [ADAPTAÇÃO]
      { id: "5.13i", text: "Demais preparados mantidos a até 4°C respeitam validade de 3 dias (quando trabalha com o produto).", critico: true }, // Art. 44 II [ADAPTAÇÃO]
      { id: "5.13j", text: "Hortifrutícolas higienizados/fracionados e sucos/polpas mantidos a até 5°C respeitam validade de 3 dias (quando trabalha com o produto).", critico: true }, // Art. 44 II [ADAPTAÇÃO]
      { id: "5.14", text: "Alimentos fora dos parâmetros do Art. 44 (ou com alteração sensorial) são descartados.", critico: true }, // Art. 45
      { id: "5.15", text: "Vedação de revalidar prazo de validade respeitada.", critico: true }, // Art. 46
      { id: "5.16", text: "Produtos com sinais de descongelamento/recongelamento são descartados.", critico: true }, // Art. 47
      { id: "5.17", text: "Temperaturas monitoradas/registradas no mínimo 2x/dia, com os parâmetros do Art. 44 constando nos registros." }, // Art. 48
    ],
  },
  {
    id: "pre-preparo-preparo",
    title: "Pré-preparo e Preparo dos Alimentos",
    items: [
      { id: "6.1", text: "Embalagens que entram nas áreas de pré-preparo/preparo estão limpas; vedada entrada de madeira/papelão." }, // Art. 49
      { id: "6.2", text: "Evitado contato entre alimentos crus, semipreparados e prontos.", critico: true }, // Art. 50
      { id: "6.3", text: "Vedação de pré-preparo/preparo em áreas externas respeitada." }, // Art. 51
      { id: "6.4", text: "Vedação de manter/usar alimentos vencidos/rasurados/sem identificação/com embalagem não íntegra/fora de temperatura respeitada.", critico: true }, // Art. 52
      { id: "6.5", text: "Descongelamento conforme fabricante, identificado, feito sob refrigeração <5°C ou em micro-ondas/convecção com cocção imediata.", critico: true }, // Art. 53
      { id: "6.5b", text: "Vedação de descongelar em temperatura ambiente e recongelar respeitada.", critico: true }, // Art. 53 § único [ADAPTAÇÃO]
      { id: "6.6", text: "Dessalga conforme fabricante, ou em água potável sob refrigeração ≤5°C, ou água fervente, identificada quando refrigerada (quando realiza dessalga)." }, // Art. 54
      { id: "6.7", text: "Manipulação de perecíveis de origem animal em área climatizada a ≤16°C por até 2h/lote, ou em temperatura ambiente por até 30min/lote (exceto carne bovina moída embalada, com regulamento próprio).", critico: true }, // Art. 55
      { id: "6.8", text: "Área de preparo/montagem/finalização de sushi exclusiva, sem atividades concomitantes (quando há culinária japonesa)." }, // Art. 56
      { id: "6.9", text: "Higienização de hortifrutícolas: remoção mecânica + água corrente potável + desinfecção por imersão (produto regularizado Anvisa) + enxágue com água potável (exceto quando o produto vai ao calor ≥75°C, as cascas não são consumidas, ou o suco descarta as cascas).", critico: true }, // Art. 57
      { id: "6.10", text: "Instruções de higienização de hortifrutícolas visíveis no local da operação." }, // Art. 58
      { id: "6.11", text: "Cocção atinge no mínimo 75°C no centro geométrico (ou combinação equivalente de tempo/temperatura).", critico: true }, // Art. 59
      { id: "6.12", text: "Alimentos quentes mantidos a ≥60°C por até 6h (ou <60°C por até 1h), somando espera/transporte/distribuição/exposição.", critico: true }, // Art. 60
      { id: "6.12b", text: "Alimentos frios mantidos a até 10°C por até 4h (ou 10-21°C por até 2h).", critico: true }, // Art. 60 [ADAPTAÇÃO]
      { id: "6.12c", text: "Preparações com pescados/carnes cruas mantidas a até 5°C por até 2h.", critico: true }, // Art. 60 [ADAPTAÇÃO]
      { id: "6.12d", text: "Alimentos fora desses critérios de tempo/temperatura são descartados.", critico: true }, // Art. 60 [ADAPTAÇÃO]
      { id: "6.13", text: "Óleos/gorduras de fritura não são aquecidos acima de 180°C (quando frita).", critico: true }, // Art. 61 I
      { id: "6.13b", text: "Reutilização de óleo só ocorre sem alteração sensorial/espuma/fumaça, descartado caso contrário (quando frita)." }, // Art. 61 II [ADAPTAÇÃO]
      { id: "6.13c", text: "Óleo filtrado antes de reutilizar (quando frita)." }, // Art. 61 III [ADAPTAÇÃO]
      { id: "6.14", text: "Ovos de fornecedores inspecionados; pasteurizados/desidratados/cozidos quando usados em preparações sem cocção posterior (quando usa ovos).", critico: true }, // Art. 62 I-II
      { id: "6.14b", text: "Conteúdo do ovo não toca a superfície externa da casca (quando usa ovos).", critico: true }, // Art. 62 III [ADAPTAÇÃO]
      { id: "6.14c", text: "Vedação de vender/usar ovos com casca rachada/suja respeitada (quando usa ovos).", critico: true }, // Art. 62 IV-V [ADAPTAÇÃO]
      { id: "6.14d", text: "Embalagens de ovos não reutilizadas para outras finalidades (quando usa ovos)." }, // Art. 62 VI [ADAPTAÇÃO]
      { id: "6.14e", text: "Vedação de lavar ovos respeitada (quando usa ovos)." }, // Art. 62 VII [ADAPTAÇÃO]
      { id: "6.15", text: "Arroz recém-preparado para sushi é misturado ao tempero garantindo pH ≤4,5 em todas as partes (quando há culinária japonesa).", critico: true }, // Art. 63 I
      { id: "6.15b", text: "Arroz temperado, acidificado e protegido, é usado em até 8 horas em temperatura ambiente (quando há culinária japonesa).", critico: true }, // Art. 63 II [ADAPTAÇÃO]
      { id: "6.15c", text: "Identificação do arroz inclui data/hora de manipulação e término da validade (quando há culinária japonesa)." }, // Art. 63 III [ADAPTAÇÃO]
      { id: "6.16", text: "Receita do arroz temperado padronizada/documentada, com laudo laboratorial comprovando pH ≤4,5 (quando há culinária japonesa).", critico: true }, // Art. 64 caput
      { id: "6.16b", text: "Nova análise de pH realizada quando há alteração da receita padrão (quando há culinária japonesa)." }, // Art. 64 §1 [ADAPTAÇÃO]
      { id: "6.16c", text: "Receita e laudo disponíveis à autoridade sanitária (quando há culinária japonesa)." }, // Art. 64 §2 [ADAPTAÇÃO]
      { id: "6.17", text: "Cardápios com ingredientes crus/mal cozidos trazem aviso, com o item identificado por asterisco e a advertência legal completa (quando oferece crus/mal cozidos)." }, // Art. 65 I-II
      { id: "6.17b", text: "Sem cardápio, a mesma advertência é exibida em cartaz conforme o modelo do Anexo I (quando oferece crus/mal cozidos)." }, // Art. 65 III [ADAPTAÇÃO]
      { id: "6.17c", text: "Aviso sempre visível/legível no momento da escolha (quando oferece crus/mal cozidos)." }, // Art. 65 IV [ADAPTAÇÃO]
      { id: "6.18", text: "Resfriamento/armazenamento em equipamento de refrigeração, identificado (denominação, preparo, validade)." }, // Art. 66
      { id: "6.19", text: "Temperatura reduzida de 60°C para 10°C em até 2 horas.", critico: true }, // Art. 67 §1
      { id: "6.19b", text: "Após resfriar, produto segue sob refrigeração <5°C ou congelamento ≤-18°C.", critico: true }, // Art. 67 §2 [ADAPTAÇÃO]
      { id: "6.20", text: "Reaquecimento atinge no mínimo 75°C em todas as partes.", critico: true }, // Art. 68
    ],
  },
  {
    id: "distribuicao-exposicao",
    title: "Distribuição, Exposição para Venda e Consumo",
    items: [
      { id: "7.1", text: "Balcões/equipamentos/recipientes de exposição têm barreiras de proteção contra contaminação pelo consumidor.", critico: true }, // Art. 69
      { id: "7.2", text: "Balcões/recipientes de exposição de prontos para consumo têm dispositivo de fechamento." }, // Art. 70
      { id: "7.3", text: "Utensílios de porcionar/servir exclusivos por preparação, com cabos longos." }, // Art. 71
      { id: "7.4", text: "Alimentos expostos atendem aos critérios do Art. 60, sendo descartados quando não atendem.", critico: true }, // Art. 72
      { id: "7.5", text: "Temperaturas monitoradas/registradas no início e a cada 2h da distribuição/exposição." }, // Art. 73
      { id: "7.6", text: "Alimentos perecíveis das cadeias fria/quente mantidos conforme o Art. 60.", critico: true }, // Art. 74
      { id: "7.7", text: "Condimentos/molhos/temperos em embalagens individuais de uso único." }, // Art. 75
      { id: "7.8", text: "Alimentos dispostos organizadamente, em recipientes compatíveis, com temperatura mantida em todas as partes." }, // Art. 76
      { id: "7.9", text: "Vedação de expor alimentos com sinais de descongelamento/recongelamento respeitada.", critico: true }, // Art. 77
      { id: "7.10", text: "Venda de carne descongelada conforme fabricante, em equipamento adequado, identificada com aviso de não recongelar e data (quando vende carne descongelada)." }, // Art. 78
      { id: "7.11", text: "Vedação de comercializar produtos vencidos/fraudados/adulterados/com embalagem danificada respeitada.", critico: true }, // Art. 79
      { id: "7.12", text: "Alimentos crus/pré-preparados/preparados expostos protegidos e identificados (designação, preparo, validade) (exceto hortifrutícolas in natura)." }, // Art. 80 caput
      { id: "7.12b", text: "Autosserviço de panificação segue essas regras e as barreiras/utensílios exclusivos dos Art. 69-71 (quando há autosserviço de panificação)." }, // Art. 80 §1 [ADAPTAÇÃO]
      { id: "7.12c", text: "Vedação de expor pescados crus desprotegidos respeitada (quando expõe pescados crus).", critico: true }, // Art. 80 §2 [ADAPTAÇÃO]
      { id: "7.13", text: "Alimentos fracionados/embalados na ausência do consumidor têm rótulo completo (denominação, ingredientes, aditivos, conteúdo, origem, lote, validade, conservação, alergênicos) (exceto alimentos de consumo imediato)." }, // Art. 81
      { id: "7.14", text: "Fracionamento de produtos de origem animal com controle de procedência/rastreabilidade." }, // Art. 82
      { id: "7.15", text: "Congelados/resfriados fracionados no estabelecimento têm rótulo com temperatura mínima/máxima e tempo de garantia conforme o Art. 44." }, // Art. 83
      { id: "7.16", text: "Ornamentos na área de consumo não são fonte de contaminação, ficando fora do fluxo de ar/balcões (quando há ornamentos)." }, // Art. 84
      { id: "7.17", text: "Recebimento de pagamento em área específica, com funcionário responsável que não manipula alimentos." }, // Art. 85
      { id: "7.18", text: "Doação de preparados respeita o tempo/temperatura do Art. 60 (quando doa preparados)." }, // Art. 86
      { id: "7.19", text: "Doação de industrializados dentro da validade/condições do fabricante (quando doa industrializados)." }, // Art. 87
    ],
  },
  {
    id: "granel",
    title: "Comércio de Produtos de Origem Vegetal a Granel",
    items: [
      { id: "8.1", text: "Produtos a granel identificados (denominação, fracionamento, validade, fabricante/fornecedor) (exceto hortifrutícolas in natura)." }, // Art. 88 caput
      { id: "8.1b", text: "Exposição protegida contra contaminação/deterioração/degradação." }, // Art. 88 § único [ADAPTAÇÃO]
      { id: "8.2", text: "Fracionamento na presença do consumidor feito por manipulador com higiene adequada e utensílios apropriados.", critico: true }, // Art. 89
      { id: "8.3", text: "Embalagens próprias para contato com alimentos, íntegras, atóxicas, limpas." }, // Art. 90
      { id: "8.4", text: "Fracionamento na ausência do consumidor tem área física específica isolada, lavatório exclusivo, superfícies lisas/impermeáveis (quando fraciona na ausência do consumidor)." }, // Art. 91
      { id: "8.5", text: "Rotulagem de embalados na ausência do consumidor segue o Art. 81 (mesma condição do item anterior)." }, // Art. 92
      { id: "8.6", text: "Rotulagem do fracionado na presença do consumidor traz denominação, data, fabricante, validade, sem informação enganosa." }, // Art. 93
      { id: "8.7", text: "Comércio de espécies vegetais a granel para chás é feito só com finalidade alimentícia (quando comercializa ervas/chás a granel)." }, // Art. 94
      { id: "8.8", text: "Reabastecimento evita mistura de lotes/fornecedores, com recipientes higienizados a cada reabastecimento e POP com rastreabilidade." }, // Art. 95
      { id: "8.9", text: "Vedação de modificar composição/misturar ingredientes no ponto de venda respeitada." }, // Art. 96
      { id: "8.10", text: "Vedação total de venda a granel de suplementos alimentares respeitada." }, // Art. 97
      { id: "8.11", text: "Vedação total de venda de produtos de Medicina Tradicional Chinesa/indicação terapêutica respeitada." }, // Art. 98
    ],
  },
  {
    id: "guarda-amostras",
    title: "Guarda de Amostras",
    items: [
      { id: "9.1", text: "Amostras coletadas no último terço da distribuição, com os utensílios da distribuição (quando presta serviço de alimentação coletiva — cozinha industrial, restaurante por quilo, self-service, buffê, escola/creche, instituição de longa permanência, presídio ou hospital)." }, // Art. 99 caput
      { id: "9.1b", text: "Saco estéril identificado (estabelecimento, preparação, data, horário, responsável), aberto sem contato interno/sopro (mesma condição do item anterior)." }, // Art. 99 I-III [ADAPTAÇÃO]
      { id: "9.1c", text: "Mínimo de 100g de amostra, com ar retirado quando possível antes de fechar (mesma condição do item anterior)." }, // Art. 99 IV-V [ADAPTAÇÃO]
      { id: "9.1d", text: "Amostras armazenadas por 96h entre -18°C e 4°C, sendo as líquidas exclusivamente refrigeradas até 4°C (mesma condição do item anterior)." }, // Art. 99 VI [ADAPTAÇÃO]
    ],
  },
  {
    id: "surto-dtha",
    title: "Surto de DTHA",
    items: [
      { id: "10.1", text: "Suspeita de surto notificada imediatamente à autoridade sanitária.", critico: true }, // Art. 100 caput
      { id: "10.1b", text: "Medidas imediatas adotadas em caso de surto (suspensão de distribuição, segregação, preservação de amostras/registros).", critico: true }, // Art. 100 § único [ADAPTAÇÃO]
      { id: "10.2", text: "Registros de manipulação/armazenamento/transporte/distribuição mantidos disponíveis, com colaboração na investigação." }, // Art. 101-102
    ],
  },
  {
    id: "transporte",
    title: "Transporte de Alimentos",
    items: [
      { id: "11.1", text: "Carga/transporte/descarga realizados sem probabilidade de contaminação/danos." }, // Art. 103
      { id: "11.2", text: "Compartimento de carga revestido liso/impermeável/atóxico/resistente, com controle térmico.", critico: true }, // Art. 104
      { id: "11.3", text: "Cabine isolada do compartimento fechado; veículo em bom estado, livre de estranhos, higienizado, com temperatura adequada.", critico: true }, // Art. 105
      { id: "11.4", text: "Produtos sem contato direto com o piso do compartimento, separados/protegidos." }, // Art. 106
      { id: "11.5", text: "Veículo e materiais de proteção higienizados (método químico regularizado Anvisa ou vapor)." }, // Art. 107
      { id: "11.6", text: "Transporte concomitante de crus/semiprocessados/prontos com matérias-primas evita contaminação cruzada.", critico: true }, // Art. 108
      { id: "11.7", text: "Transporte de matérias-primas respeita as temperaturas do Art. 30 durante todo o trajeto.", critico: true }, // Art. 109
      { id: "11.8", text: "Transporte de preparados respeita as condições do Art. 60, com registro de horário/temperatura no início e no fim.", critico: true }, // Art. 110
      { id: "11.9", text: "Perecíveis sob refrigeração/congelamento transportados em compartimento fechado com termômetro calibrado, pré-condicionado à temperatura mais exigente.", critico: true }, // Art. 111
    ],
  },
  {
    id: "delivery",
    title: "Entrega de Alimentos em Domicílio",
    items: [
      { id: "12.1", text: "Embalagens de entrega usam selo/lacre destrutível, com aviso de que o produto violado não deve ser consumido." }, // Art. 112
      { id: "12.2", text: "Embalagem traz a indicação \"Produto para consumo imediato\"." }, // Art. 113
    ],
  },
  {
    id: "higienizacao-instalacoes",
    title: "Higienização das Instalações e do Ambiente",
    items: [
      { id: "13.1", text: "Instalações/equipamentos/móveis/utensílios higienizados seguindo as etapas (remoção de sujidade, lavagem, enxágue, desinfecção)." }, // Art. 114 caput, I
      { id: "13.1b", text: "Higienização feita em área própria ou, na ausência dela, em horário distinto da manipulação." }, // Art. 114 II [ADAPTAÇÃO]
      { id: "13.2", text: "Equipamentos com superfícies não visíveis desmontados no mínimo 1x/dia ou a cada troca de tipo de preparo.", critico: true }, // Art. 115
      { id: "13.2b", text: "Equipamentos não desmontáveis higienizados por técnica comprovadamente eficaz." }, // Art. 115 § único [ADAPTAÇÃO]
      { id: "13.3", text: "Lista de vedações de higienização respeitada (varrer a seco, panos não descartáveis, reaproveitar vasilhames, escoar água para via pública, diluir fora das recomendações, manter animais, entre outras)." }, // Art. 116
      { id: "13.4", text: "Produtos/utensílios de limpeza armazenados fora das áreas de manipulação, regularizados Anvisa, rotulados." }, // Art. 117
      { id: "13.5", text: "Higienização feita por funcionários capacitados, com EPI adequado para produtos fortemente alcalinos/ácidos/oxidantes." }, // Art. 118
    ],
  },
  {
    id: "agua",
    title: "Abastecimento de Água",
    items: [
      { id: "14.1", text: "Água para consumo/preparo/gelo/vapor/higienização é potável, prioritariamente de rede pública.", critico: true }, // Art. 119
      { id: "14.2", text: "Soluções alternativas de abastecimento aprovadas pelo órgão competente, tratadas, com potabilidade comprovada por laudo (quando não usa só água de rede pública).", critico: true }, // Art. 120
      { id: "14.2b", text: "Documentos de regularização e laudos disponíveis à autoridade sanitária (mesma condição do item anterior)." }, // Art. 120 §2 [ADAPTAÇÃO]
      { id: "14.3", text: "Água de caminhão-pipa atende à legislação, com laudos a cada entrega (quando usa caminhão-pipa).", critico: true }, // Art. 121
      { id: "14.4", text: "Reservatório tampado, de fácil higienização, com superfície lisa/resistente/impermeável, livre de defeitos (não é N/A-ável quando existe qualquer reservatório/caixa d'água, mesmo com abastecimento majoritariamente de rede pública).", critico: true }, // Art. 122, 1ª parte
      { id: "14.4b", text: "Reservatório higienizado em intervalo máximo de 6 meses, ou após acidente/evento de contaminação, com registro da execução (quando comprovadamente não há reservatório de água)." }, // Art. 122, 2ª parte [ADAPTAÇÃO]
      { id: "14.5", text: "Elementos filtrantes higienizados/substituídos conforme fabricante, com comprovação documental (quando há sistema de filtragem)." }, // Art. 123
      { id: "14.6", text: "Gelo produzido com água potável, protegido contra contaminação (quando usa gelo).", critico: true }, // Art. 124
      { id: "14.7", text: "Vapor em contato com alimentos/superfícies produzido com água potável (quando usa vapor).", critico: true }, // Art. 125
    ],
  },
  {
    id: "esgoto-residuos-gas",
    title: "Esgotamento Sanitário, Resíduos e Gás",
    items: [
      { id: "15.1", text: "Esgoto conectado à rede pública, ou com destinação conforme legislação específica." }, // Art. 126
      { id: "15.2", text: "Despejos das pias passam por caixa de gordura fora das áreas de manipulação, com limpeza periódica." }, // Art. 127
      { id: "15.3", text: "Resíduos/recicláveis em local exclusivo, com água/ralo/esgoto, revestido, protegido de intempéries/vetores." }, // Art. 128 caput
      { id: "15.3b", text: "Caçambas/recipientes de fácil limpeza com tampas ajustadas (quando usa caçambas)." }, // Art. 128 § único [ADAPTAÇÃO]
      { id: "15.4", text: "Recipientes de resíduos nas áreas de manipulação com tampa por pedal, sem contaminação cruzada." }, // Art. 129
      { id: "15.5", text: "Resíduos não são removidos pelo mesmo acesso de entrada de insumos, ou há horários diferentes definidos por escrito." }, // Art. 130
      { id: "15.6", text: "Resíduos de óleo/gordura em recipiente próprio, rígido, fechado, identificado (empresa coletora, CNPJ, \"Resíduo de óleo\")." }, // Art. 131 caput
      { id: "15.6b", text: "Vedação de lançar resíduos de óleo no esgoto/vias públicas/resíduos comuns respeitada." }, // Art. 131 § único [ADAPTAÇÃO]
      { id: "15.7", text: "Comercialização de resíduos de alimentos/gordura/sebo/ossos feita só para empresas especializadas licenciadas (quando comercializa esses resíduos)." }, // Art. 132
      { id: "15.8", text: "Área de botijões de gás exclusiva, ventilada, protegida contra acesso não autorizado (quando usa gás em botijão)." }, // Art. 133
    ],
  },
  {
    id: "pragas",
    title: "Controle Integrado de Vetores e Pragas Urbanas",
    items: [
      { id: "16.1", text: "Edificação/instalações/equipamentos/utensílios livres de vetores/pragas e indícios.", critico: true }, // Art. 134
      { id: "16.2", text: "Controle inclui medidas preventivas/corretivas contínuas, com barreiras físicas priorizadas." }, // Art. 135 caput
      { id: "16.2b", text: "Controle químico, quando necessário, feito por empresa especializada licenciada, com certificado mantido (quando há histórico de controle químico)." }, // Art. 135 § único [ADAPTAÇÃO]
    ],
  },
  {
    id: "edificacoes-instalacoes",
    title: "Edificações e Instalações",
    items: [
      { id: "17.1", text: "Áreas livres de focos de insalubridade e indícios de vetores/pragas; edificação conforme normas de construção; trânsito restrito." }, // Art. 136
      { id: "17.2", text: "Barreiras físicas/técnicas entre etapas, com fluxos contínuos sem cruzamento.", critico: true }, // Art. 137
      { id: "17.3", text: "Dimensionamento compatível com volume/tipo de produtos/cardápio/distribuição." }, // Art. 138
      { id: "17.4", text: "Obras com isolamento total da área em reforma e proteção de equipamentos/alimentos (quando há obras em andamento)." }, // Art. 139
      { id: "17.5", text: "Lavatórios exclusivos em número suficiente, inclusive em áreas de venda/distribuição." }, // Art. 140 caput
      { id: "17.5b", text: "Lavatórios desobstruídos." }, // Art. 140 §1 [ADAPTAÇÃO]
      { id: "17.5c", text: "Lavatórios abastecidos com sabonete líquido neutro/antisséptico, papel-toalha (ou método sem risco de contaminação) e coletor sem contato manual.", critico: true }, // Art. 140 §2 [ADAPTAÇÃO]
      { id: "17.6", text: "Lavatório para consumidores na área de consumo; sanitários de clientes sem comunicação com áreas de manipulação/armazenamento (quando há área de consumo local)." }, // Art. 141
      { id: "17.7", text: "Higienização de materiais de limpeza feita em área exclusiva com tanque, fora das áreas de manipulação." }, // Art. 142
      { id: "17.8", text: "Equipamentos/utensílios/móveis lisos/impermeáveis/laváveis, em bom estado, resistentes à corrosão." }, // Art. 143
      { id: "17.9", text: "Utensílios armazenados protegidos contra contaminantes." }, // Art. 144
      { id: "17.10", text: "Esteiras de sushi de material de fácil higienização, em condição adequada (quando há culinária japonesa)." }, // Art. 145
      { id: "17.11", text: "Termômetros digitais higienizados antes/durante/depois do uso." }, // Art. 146
      { id: "17.12", text: "Manutenção programada de equipamentos e calibração de instrumentos, ambas registradas." }, // Art. 147
      { id: "17.13", text: "Disposição de equipamentos/móveis segue o fluxo operacional." }, // Art. 148
      { id: "17.14", text: "Vedação de operar equipamentos sem proteção de partes de risco respeitada." }, // Art. 149
      { id: "17.15", text: "Vedação de usar utensílios para fins distintos do indicado pelo fabricante respeitada." }, // Art. 150
      { id: "17.16", text: "Lubrificantes em contato potencial com alimentos são de grau alimentício, com especificações disponíveis (quando há esse tipo de equipamento).", critico: true }, // Art. 151
      { id: "17.17", text: "Câmaras frigoríficas com revestimento liso/lavável/impermeável/resistente (quando há câmara frigorífica)." }, // Art. 152 I
      { id: "17.17b", text: "Termômetro de fácil leitura, calibrado, com visor externo (mesma condição do item anterior)." }, // Art. 152 II [ADAPTAÇÃO]
      { id: "17.17c", text: "Interruptor de segurança externo com sinalização \"ligado\"/\"desligado\" (mesma condição)." }, // Art. 152 III [ADAPTAÇÃO]
      { id: "17.17d", text: "Prateleiras/estrados lisos/laváveis/impermeáveis/resistentes (mesma condição)." }, // Art. 152 IV [ADAPTAÇÃO]
      { id: "17.17e", text: "Dispositivo de segurança interno de abertura da porta (mesma condição)." }, // Art. 152 V [ADAPTAÇÃO]
      { id: "17.17f", text: "Câmara isenta de ralo ou grelha (mesma condição)." }, // Art. 152 VI [ADAPTAÇÃO]
      { id: "17.18", text: "Piso liso/antiderrapante/resistente/impermeável/lavável/íntegro, com inclinação de escoamento." }, // Art. 153
      { id: "17.18b", text: "Ralos/grelhas dimensionados, sifonados, com proteção contra vetores." }, // Art. 153 § único [ADAPTAÇÃO]
      { id: "17.19", text: "Vedação de papelão/tapetes/carpetes não sanitários no piso respeitada." }, // Art. 154
      { id: "17.20", text: "Paredes/divisórias sólidas, lisas, impermeáveis, laváveis, de cor clara, resistentes, sem partes ocas/porosas (cor clara não exigida nas áreas de consumo/venda)." }, // Art. 155
      { id: "17.21", text: "Tetos/forros lisos/uniformes, impermeáveis, não inflamáveis, sem deformações/frestas (cor clara não exigida nas áreas de consumo/venda)." }, // Art. 156
      { id: "17.22", text: "Paredes/tetos/forros livres de vazamentos/umidade/trincas/bolores/infiltrações." }, // Art. 157
      { id: "17.23", text: "Portas lisas/resistentes/impermeáveis/ajustadas, com fechamento automático e proteção inferior nas áreas de armazenamento/manipulação." }, // Art. 158
      { id: "17.24", text: "Guichês/passa-pratos com proteção contra vetores, fechados quando não em uso (quando há guichês/passa-pratos)." }, // Art. 159
      { id: "17.25", text: "Janelas lisas/resistentes/ajustadas, com telas milimétricas removíveis, sem incidência solar direta." }, // Art. 160
      { id: "17.26", text: "Iluminação uniforme/suficiente, sem ofuscamento, com lâmpadas protegidas contra queda/explosão." }, // Art. 161
      { id: "17.27", text: "Instalações elétricas embutidas (ou protegidas por tubulação), com tomadas/interruptores providos de espelho." }, // Art. 162
      { id: "17.28", text: "Ventilação garante conforto térmico/renovação do ar, livre de fungos/gases/fumaça/condensação." }, // Art. 163
      { id: "17.29", text: "Fluxo de ar da área limpa para a suja, sem incidir sobre alimentos, com exaustão provida de telas milimétricas e manutenção periódica." }, // Art. 164
      { id: "17.30", text: "Climatização com higienização regular, troca de filtros e manutenção programada (quando há climatização)." }, // Art. 165
      { id: "17.31", text: "Vedação de climatizadores com aspersão de neblina e de ventiladores nas áreas de manipulação/armazenamento respeitada." }, // Art. 166
    ],
  },
  {
    id: "vestiarios-sanitarios",
    title: "Vestiários e Instalações Sanitárias dos Funcionários",
    items: [
      { id: "18.1", text: "Vestiários/sanitários de funcionários sem comunicação direta com áreas de armazenamento/manipulação/distribuição/consumo." }, // Art. 167 [ex-17.32, decisão v2 #9 — não crítico]
      { id: "18.2", text: "Vestiários/sanitários separados por gênero, com fechamento automático nas portas externas, boas condições, piso/paredes impermeáveis, ventilação, e armários individuais com travamento." }, // Art. 168 [ex-17.33]
      { id: "18.3", text: "Instalações sanitárias com vaso sifonado com tampa/descarga, papel higiênico, lavatório com sabonete antisséptico, papel-toalha, e lixeira com tampa por pedal." }, // Art. 169 [ex-17.34]
    ],
  },
  {
    id: "manual-bp-pop",
    title: "Manual de Boas Práticas e POP",
    items: [
      { id: "19.1", text: "Manual de Boas Práticas e POPs implementados, organizados, aprovados, atualizados, datados, assinados e acessíveis." }, // Art. 170 caput
      { id: "19.2", text: "POP de higiene e saúde dos funcionários implementado (exames, periodicidade, antissepsia, medidas em agravos)." }, // Art. 170 I; Art. 172
      { id: "19.3", text: "POP de capacitação em Boas Práticas implementado (programa, conteúdo, frequência, registros completos)." }, // Art. 170 II; Art. 173
      { id: "19.4", text: "POP de controle de qualidade no recebimento implementado (critérios, registros de integridade/sensorial/validade/temperatura)." }, // Art. 170 III; Art. 174
      { id: "19.5", text: "POP de higienização de instalações/equipamentos/móveis/utensílios implementado (frequência, EPI, princípio ativo, concentração, tempo, temperatura)." }, // Art. 170 IV; Art. 175
      { id: "19.6", text: "POP de higienização do reservatório e controle da potabilidade implementado (quando comprovadamente não há reservatório de água — mesma condição de N/A dos itens 14.4b/14.4)." }, // Art. 170 V; Art. 176
      { id: "19.6b", text: "Sistema de filtragem: especificações, higienização, frequência e registro de troca constam no POP (quando há sistema de filtragem)." }, // Art. 176 §1 [ADAPTAÇÃO]
      { id: "19.6c", text: "Sistema alternativo de água: pontos, frequência de coleta e análises de potabilidade constam no POP (quando usa só água de rede pública, sem solução alternativa)." }, // Art. 176 §2 [ADAPTAÇÃO]
      { id: "19.7", text: "POP de manutenção/calibração implementado (frequência de manutenção preventiva e calibração)." }, // Art. 170 VI; Art. 177
      { id: "19.8", text: "POP de controle integrado de vetores/pragas implementado (medidas preventivas/corretivas)." }, // Art. 170 VII; Art. 178
      { id: "19.9", text: "POP de manejo dos resíduos implementado (coleta, empresa, periodicidade, locais, higienização)." }, // Art. 170 VIII; Art. 179
      { id: "19.10", text: "POP de transporte implementado (procedimento/frequência de higienização, registro, controle de tempo/temperatura) (quando realiza transporte próprio)." }, // Art. 170 IX; Art. 180
      { id: "19.11", text: "Comércio atacadista implementa também POP de rastreabilidade e Programa de recolhimento de alimentos (quando é atacadista)." }, // Art. 171
      { id: "19.12", text: "Documentos/registros mantidos por período mínimo de 180 dias, disponíveis à autoridade sanitária (item transversal de retenção — não repetir por tipo de registro)." }, // Art. 181
    ],
  },
];
