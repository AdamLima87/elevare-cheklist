// Fase 7 — formas compartilhadas entre a camada de serviço (dados vindos do
// banco) e o script de geração do seed (dados vindos do antigo
// checklist-data.ts hardcoded). Extraído para um arquivo neutro para que
// nenhum consumidor de runtime precise importar checklist-data.ts, mesmo só
// para o tipo.
export interface ChecklistItem {
  id: string;
  text: string;
  critico?: boolean;
}

export interface ChecklistSection {
  id: string;
  title: string;
  items: ChecklistItem[];
}
