import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppShell } from "@/components/elevare/AppShell";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, ChevronDown, ChevronUp } from "lucide-react";

const SECOES = [
  { id: "instalacoes", titulo: "Instalações", itens: [
    {id:"1",texto:"Área externa livre de focos de insalubridade, objetos em desuso, animais e insetos."},
    {id:"2",texto:"Acesso direto e independente, não comum a outros usos (habitação)."},
    {id:"3",texto:"Fluxo ordenado, sem cruzamento de etapas e atividades."},
    {id:"4",texto:"Separação adequada das diferentes atividades por meios físicos ou técnicos."},
    {id:"5",texto:"Piso: revestimento liso, impermeável e lavável."},
    {id:"5.1",texto:"Piso: em adequado estado de conservação (livre de defeitos, rachaduras, trincas, buracos)."},
    {id:"5.2",texto:"Piso: sistema de drenagem dimensionado e sem acúmulo de água."},
    {id:"5.3",texto:"Piso: ralos sifonados e grelhas com dispositivo de fechamento."},
    {id:"6",texto:"Parede: revestimento liso, impermeável e lavável."},
    {id:"6.1",texto:"Parede: em adequado estado de conservação (livre de falhas, rachaduras, umidade, bolor)."},
    {id:"6.2",texto:"Parede: pintura em cores claras, lavável e sem desprendimento de tinta."},
    {id:"6.3",texto:"Parede: higienizada e em adequado estado de conservação."},
    {id:"7",texto:"Teto: revestimento liso, impermeável, lavável e em cor clara."},
    {id:"7.1",texto:"Teto: em adequado estado de conservação (livre de trincas, rachaduras, umidade, bolor)."},
    {id:"7.2",texto:"Teto: higienizado."},
    {id:"7.3",texto:"Teto: ausência de objetos pendurados em desacordo com as Boas Práticas."},
    {id:"8",texto:"Portas com superfície lisa, de fácil higienização, ajustadas aos batentes."},
    {id:"8.1",texto:"Portas externas com fechamento automático."},
    {id:"8.2",texto:"Portas externas com barreiras adequadas para impedir entrada de vetores e pragas."},
    {id:"9",texto:"Janelas com superfície lisa, de fácil higienização, ajustadas aos batentes."},
    {id:"9.1",texto:"Janelas providas de telas milimétricas removíveis para limpeza."},
    {id:"9.2",texto:"Janelas em adequado estado de conservação."},
    {id:"10",texto:"Iluminação adequada às atividades realizadas."},
    {id:"10.1",texto:"Luminárias com proteção contra explosão e quedas acidentais."},
    {id:"10.2",texto:"Instalações elétricas embutidas ou externas revestidas por tubulações isolantes."},
    {id:"10.3",texto:"Instalações elétricas em bom estado de conservação."},
    {id:"11",texto:"Ventilação natural ou artificial adequada."},
    {id:"11.1",texto:"Ar insuflado sem incidência direta sobre os alimentos."},
    {id:"11.2",texto:"Equipamentos e filtros higienizados periodicamente."},
    {id:"11.3",texto:"Sistema de exaustão dimensionado adequadamente."},
    {id:"11.4",texto:"Registro periódico de manutenção dos equipamentos de climatização."},
    {id:"12",texto:"Eliminação adequada de águas servidas e esgotos."},
    {id:"13",texto:"Água potável de rede pública tratada ou solução alternativa controlada."},
    {id:"13.1",texto:"Volume e pressão suficientes para atender todas as atividades."},
    {id:"13.2",texto:"Caixa d'água tampada e em bom estado de conservação."},
    {id:"13.3",texto:"Reservatório higienizado em intervalo máximo de seis meses."},
    {id:"14",texto:"Instalações sanitárias sem comunicação direta com a área de produção."},
    {id:"14.1",texto:"Instalações sanitárias em bom estado de conservação e higienização."},
    {id:"14.2",texto:"Instalações sanitárias organizadas e abastecidas."},
    {id:"14.3",texto:"Portas com fechamento automático."},
    {id:"14.4",texto:"Lavatórios com sabonete líquido antisséptico e toalhas de papel."},
    {id:"14.5",texto:"Coletores de papel acionados sem contato manual."},
    {id:"14.6",texto:"Vestiários separados por sexo, com armários individuais."},
    {id:"15",texto:"Lavatórios exclusivos para higienização das mãos na área de manipulação, em posição estratégica."},
    {id:"15.1",texto:"Lavatórios com sabonete líquido antisséptico e toalhas de papel."},
    {id:"15.2",texto:"Lavatórios com coletores de papel acionados sem contato manual."},
    {id:"15.3",texto:"Lavatórios em número suficiente e em bom estado."},
  ]},
  { id: "equipamentos", titulo: "Equipamentos, móveis e utensílios", itens: [
    {id:"16",texto:"Materiais resistentes à corrosão e a repetidas operações de limpeza."},
    {id:"17",texto:"Superfícies em contato com alimentos lisas, íntegras, impermeáveis, resistentes à corrosão, sem rugosidades."},
    {id:"18",texto:"Em adequado estado de conservação e funcionamento."},
    {id:"19",texto:"Equipamentos de conservação dos alimentos com medidor de temperatura calibrado."},
    {id:"20",texto:"Existência de planilha de registro de manutenção preventiva e calibração de equipamentos."},
  ]},
  { id: "higienizacao", titulo: "Higienização de instalações, equipamentos, móveis e utensílios", itens: [
    {id:"21",texto:"Existência de registro periódico da higienização de instalações e equipamentos."},
    {id:"21.1",texto:"Produtos de higienização regularizados pelo Ministério da Saúde."},
    {id:"21.2",texto:"Disponibilidade de produtos saneantes em quantidade suficiente."},
    {id:"21.3",texto:"Diluição, tempo de contato e modo de uso conforme instruções do fabricante."},
    {id:"21.4",texto:"Produtos armazenados em local reservado, identificados e separados dos alimentos."},
    {id:"21.5",texto:"Utensílios e equipamentos usados na higienização distintos dos usados na manipulação dos alimentos."},
  ]},
  { id: "pragas", titulo: "Controle integrado de vetores e pragas urbanas", itens: [
    {id:"22",texto:"Edificação, instalações, equipamentos, móveis e utensílios livres de pragas urbanas."},
    {id:"23",texto:"Adoção de medidas preventivas e corretivas para impedir a atração, abrigo e proliferação de vetores."},
    {id:"24",texto:"Controle químico realizado por empresa especializada e registrada."},
  ]},
  { id: "agua", titulo: "Abastecimento de água", itens: [
    {id:"25",texto:"Reservatório livre de rachaduras, vazamentos, infiltrações e descascamentos."},
    {id:"26",texto:"Quando utilizada solução alternativa, comprovada potabilidade semestral."},
    {id:"27",texto:"Vapor produzido a partir de água potável, livre de substâncias contaminantes."},
    {id:"28",texto:"Reservatório acessível com instalação hidráulica em adequada conservação."},
    {id:"29",texto:"Gelo produzido com água potável, mantido em condições higiênico-sanitárias."},
    {id:"30",texto:"Vapor gerado a partir de água potável, livre de substâncias contaminantes."},
  ]},
  { id: "residuos", titulo: "Manejo dos resíduos", itens: [
    {id:"31",texto:"Recipientes identificados e íntegros, de fácil higienização e transporte, em número suficiente."},
    {id:"32",texto:"Uso de sacos de lixo apropriados; quando reutilizáveis, materiais que facilitem higienização."},
    {id:"33",texto:"Resíduos coletados com frequência, evitando acúmulos."},
    {id:"34",texto:"Resíduos armazenados em local fechado e isolado da área de manipulação."},
  ]},
  { id: "manipuladores", titulo: "Manipuladores", itens: [
    {id:"35",texto:"Controle de saúde dos funcionários devidamente registrado."},
    {id:"36",texto:"Manipuladores afastados quando apresentam lesões e/ou sintomas que comprometam a qualidade."},
    {id:"37",texto:"Boa apresentação, asseio pessoal, uniforme completo de cor clara, limpo e em bom estado."},
    {id:"38",texto:"Lavagem cuidadosa das mãos antes da manipulação e após qualquer interrupção."},
    {id:"39",texto:"Cartazes de orientação sobre a correta lavagem das mãos em locais estratégicos."},
    {id:"40",texto:"Manipuladores não fumam, não falam desnecessariamente, não cantam sobre os alimentos."},
    {id:"41",texto:"Cabelos presos e protegidos por toucas; sem barba; unhas curtas e sem esmalte; sem adornos."},
    {id:"42",texto:"Programa de capacitação adequado e contínuo, com registros."},
    {id:"43",texto:"Visitantes cumprem os requisitos de higiene estabelecidos para os manipuladores."},
  ]},
  { id: "materias", titulo: "Matérias-primas, ingredientes e embalagens", itens: [
    {id:"44",texto:"Critérios para avaliação e seleção dos fornecedores de matérias-primas."},
    {id:"45",texto:"Recepção em área protegida e limpa."},
    {id:"46",texto:"Registro de inspeção das matérias-primas na recepção (integridade, temperatura)."},
    {id:"47",texto:"Matérias-primas e ingredientes aguardando liberação identificados."},
    {id:"48",texto:"Matérias-primas, ingredientes e embalagens armazenados sobre paletes, estrados e/ou prateleiras."},
    {id:"49",texto:"Obediência ao prazo de validade e à ordem de entrada dos produtos (PVPS)."},
    {id:"50",texto:"Embalagens primárias íntegras, sem contato direto com piso, paredes e teto."},
  ]},
  { id: "preparacao", titulo: "Preparação do alimento", itens: [
    {id:"51",texto:"Medidas para minimizar o risco de contaminação cruzada."},
    {id:"52",texto:"Manipuladores que atuam em diferentes atividades adotam medidas para evitar contaminação cruzada."},
    {id:"53",texto:"Matérias-primas perecíveis expostas à temperatura ambiente somente pelo tempo mínimo necessário."},
    {id:"54",texto:"Procedimentos específicos para higienização de hortifrutícolas, com produtos regularizados."},
    {id:"55",texto:"Descongelamento conduzido sob refrigeração (≤5°C) ou em forno de micro-ondas."},
    {id:"56",texto:"Alimentos descongelados não recongelados antes ou após preparo."},
    {id:"57",texto:"Óleos e gorduras utilizados apresentam boas condições e são substituídos quando necessário."},
    {id:"58",texto:"Tratamento térmico atinge no mínimo 70°C no centro geométrico do alimento."},
    {id:"59",texto:"Alimentos prontos para consumo mantidos a temperatura superior a 60°C por no máximo 6 horas."},
    {id:"60",texto:"Alimentos preparados identificados com designação, data de preparo e prazo de validade."},
    {id:"61",texto:"Após cocção, alimentos resfriados de 60°C a 10°C em no máximo 2 horas."},
    {id:"62",texto:"Alimentos preparados conservados a temperatura inferior a 4°C utilizados em prazo máximo de 5 dias."},
    {id:"63",texto:"Temperatura dos equipamentos de frios monitorada e registrada regularmente."},
    {id:"64",texto:"Para conservação a quente, equipamentos mantendo temperatura ≥60°C."},
    {id:"65",texto:"Alimentos preparados e conservados identificados com designação, data e prazo."},
    {id:"66",texto:"Alimentos crus higienizados de forma a reduzir a contaminação superficial."},
  ]},
  { id: "armazenamento", titulo: "Armazenamento e transporte do alimento preparado", itens: [
    {id:"67",texto:"Alimentos preparados protegidos contra contaminação e identificados."},
    {id:"68",texto:"Armazenamento sob temperatura adequada conforme o tipo de alimento."},
    {id:"69",texto:"Meios de transporte higienizados e dotados de cobertura para proteção da carga."},
  ]},
  { id: "exposicao", titulo: "Exposição ao consumo do alimento preparado", itens: [
    {id:"70",texto:"Área de exposição e refeitório mantidos organizados e em condições higiênico-sanitárias adequadas."},
    {id:"71",texto:"Equipamentos e utensílios disponíveis em quantidade suficiente, mantendo temperaturas adequadas."},
    {id:"72",texto:"Manipuladores adotam procedimentos de antissepsia das mãos e usam utensílios ou luvas descartáveis."},
    {id:"73",texto:"Existência de barreiras de proteção (anteparos) na exposição."},
    {id:"74",texto:"Utensílios para consumo (pratos, talheres, copos) higienizados e armazenados em local protegido. Área de recebimento de dinheiro separada da manipulação."},
  ]},
  { id: "documentacao", titulo: "Documentação e registro", itens: [
    {id:"75",texto:"Manual de Boas Práticas disponível para funcionários e autoridades sanitárias."},
    {id:"76",texto:"Procedimentos Operacionais Padronizados (POPs) elaborados, aprovados, datados e assinados."},
    {id:"77",texto:"Registros mantidos por período mínimo de 30 dias."},
    {id:"78",texto:"POP de controle integrado de vetores e pragas urbanas implementado."},
    {id:"79",texto:"POP de higienização do reservatório de água implementado."},
    {id:"80",texto:"POP de higiene e saúde dos manipuladores implementado."},
    {id:"81",texto:"POP de higienização de instalações, equipamentos e móveis implementado."},
    {id:"82",texto:"Programa de capacitação de manipuladores documentado."},
  ]},
];

export const Route = createFileRoute("/checklist")({ component: ChecklistPage });

function ChecklistPage() {
  const navigate = useNavigate();
  const [insp, setInsp] = useState<any>(null);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [secaoAberta, setSecaoAberta] = useState<string>("instalacoes");
  const [saving, setSaving] = useState(false);

  const totalItens = SECOES.reduce((a, s) => a + s.itens.length, 0);
  const respondidos = Object.keys(respostas).length;
  const progresso = Math.round((respondidos / totalItens) * 100);

  useEffect(() => {
    const saved = localStorage.getItem("elevare_inspecao_ativa");
    if (!saved) { navigate({ to: "/nova-inspecao" }); return; }
    const data = JSON.parse(saved);
    setInsp(data);
    setRespostas(data.respostas || {});
  }, [navigate]);

  const responder = async (id: string, valor: string) => {
    const novas = { ...respostas, [id]: valor };
    setRespostas(novas);
    if (insp) {
      const novoProgresso = Math.round((Object.keys(novas).length / totalItens) * 100);
      const updated = { ...insp, respostas: novas, progresso: novoProgresso };
      localStorage.setItem("elevare_inspecao_ativa", JSON.stringify(updated));
      await supabase.from("inspecoes").update({ respostas: novas, progresso: novoProgresso }).eq("id", insp.id);
    }
  };

  const calcularConformidade = () => {
    const vals = Object.values(respostas);
    const aplicaveis = vals.filter(v => v !== "NA");
    const conformes = vals.filter(v => v === "S");
    return aplicaveis.length > 0 ? (conformes.length / aplicaveis.length) * 100 : 0;
  };

  const handleFinalizar = async () => {
    if (progresso < 80) { toast.error(`Responda pelo menos 80% dos itens. Atual: ${progresso}%`); return; }
    setSaving(true);
    try {
      const conformidade = calcularConformidade();
      await supabase.from("inspecoes").update({ status: "concluida", conformidade, progresso: 100, data_conclusao: new Date().toISOString() }).eq("id", insp.id);
      localStorage.removeItem("elevare_inspecao_ativa");
      toast.success("Inspeção finalizada com sucesso!");
      navigate({ to: "/resultado", search: { id: insp.id, readonly: false } });
    } catch (e: any) { toast.error("Erro ao finalizar."); }
    finally { setSaving(false); }
  };

  if (!insp) return <AppShell><div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#1a4d2e]" /></div></AppShell>;

  return (
    <ProtectedRoute allowedProfiles={["admin", "consultor"]}>
      <AppShell>
        <div className="max-w-3xl mx-auto">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <h1 className="text-lg font-semibold">{insp.estabelecimento_nome}</h1>
              <span className="text-sm text-slate-500">{respondidos}/{totalItens} ({progresso}%)</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div className="bg-[#1a4d2e] h-2 rounded-full transition-all" style={{ width: `${progresso}%` }} />
            </div>
          </div>

          <div className="space-y-3">
            {SECOES.map(secao => {
              const respondidosSecao = secao.itens.filter(i => respostas[i.id]).length;
              const aberta = secaoAberta === secao.id;
              return (
                <div key={secao.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <button onClick={() => setSecaoAberta(aberta ? "" : secao.id)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-[#1a4d2e] text-white">
                    <span className="font-medium text-sm">{secao.titulo}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">{respondidosSecao}/{secao.itens.length}</span>
                      {aberta ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </button>
                  {aberta && (
                    <div className="divide-y">
                      {secao.itens.map(item => (
                        <div key={item.id} className="flex items-center justify-between px-4 py-3 gap-4">
                          <div className="flex-1">
                            <span className="text-xs text-slate-400 font-mono mr-2">{item.id}.</span>
                            <span className="text-sm text-slate-700">{item.texto}</span>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            {["S", "N", "NA"].map(op => (
                              <button key={op} onClick={() => responder(item.id, op)}
                                className={`w-10 h-8 rounded text-xs font-bold border transition-all ${
                                  respostas[item.id] === op
                                    ? op === "S" ? "bg-green-500 text-white border-green-500"
                                    : op === "N" ? "bg-red-500 text-white border-red-500"
                                    : "bg-slate-500 text-white border-slate-500"
                                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"
                                }`}>{op}</button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex justify-end">
            <Button onClick={handleFinalizar} disabled={saving || progresso < 80}
              className="bg-[#1a4d2e] hover:bg-[#1a4d2e]/90 text-white gap-2 px-8">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Finalizar Inspeção"}
            </Button>
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
