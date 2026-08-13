import type { ComponentType } from "react";
import { template as inspectionTemplate } from "./inspection";
import { template as reinspectionReminderTemplate } from "./reinspection-reminder";
import { template as propostaDisponivelTemplate } from "./proposta-disponivel";
import { template as contratoDisponivelTemplate } from "./contrato-disponivel";

export interface TemplateEntry {
  component: ComponentType<any>;
  subject: string | ((data: Record<string, any>) => string);
  displayName?: string;
  previewData?: Record<string, any>;
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string;
}

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  inspection: inspectionTemplate,
  "reinspection-reminder": reinspectionReminderTemplate,
  "proposta-disponivel": propostaDisponivelTemplate,
  "contrato-disponivel": contratoDisponivelTemplate,
};
