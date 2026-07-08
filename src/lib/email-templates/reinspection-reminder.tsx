import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";
import type { TemplateEntry } from "./registry";

interface ReinspectionReminderEmailProps {
  papel?: "consultor" | "cliente";
  nome_estabelecimento?: string;
  cnpj?: string;
  data_conclusao_anterior?: string;
  data_prevista_reinspecao?: string;
  link_resultado?: string;
}

export const ReinspectionReminderEmail = ({
  papel = "cliente",
  nome_estabelecimento = "Seu Estabelecimento",
  cnpj = "00.000.000/0001-00",
  data_conclusao_anterior = new Date().toISOString(),
  data_prevista_reinspecao = new Date().toISOString(),
  link_resultado = "https://elevareconsultoria.com",
}: ReinspectionReminderEmailProps) => {
  const isConsultor = papel === "consultor";

  return (
    <Html>
      <Head />
      <Preview>
        {isConsultor
          ? `Reinspeção de ${nome_estabelecimento} se aproxima`
          : "Sua próxima inspeção sanitária está se aproximando"}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Img
              src="https://notify.elevareconsultoria.com/logo-white.png"
              width="150"
              alt="Elevare"
              style={logo}
            />
            <Heading style={headerTitle}>Lembrete de Reinspeção</Heading>
          </Section>
          <Section style={content}>
            <Heading as="h2" style={title}>
              {isConsultor
                ? "Agende a próxima reinspeção"
                : "Sua próxima inspeção está se aproximando"}
            </Heading>
            <Text style={paragraph}>
              {isConsultor
                ? `O estabelecimento abaixo está próximo do prazo recomendado de reinspeção. Entre em contato para agendar a próxima visita.`
                : `De acordo com nossas recomendações de boas práticas sanitárias, o estabelecimento abaixo está próximo do prazo indicado para uma nova inspeção.`}
            </Text>

            <Section style={infoSection}>
              <Text style={infoText}>
                <strong>Estabelecimento:</strong> {nome_estabelecimento}
                <br />
                <strong>CNPJ:</strong> {cnpj}
                <br />
                <strong>Última inspeção concluída em:</strong>{" "}
                {new Date(data_conclusao_anterior).toLocaleDateString("pt-BR")}
                <br />
                <strong>Reinspeção recomendada até:</strong>{" "}
                {new Date(data_prevista_reinspecao).toLocaleDateString("pt-BR")}
              </Text>
            </Section>

            <Section style={buttonContainer}>
              <Button style={button} href={link_resultado}>
                {isConsultor ? "Acessar histórico do estabelecimento" : "Acessar meus resultados"}
              </Button>
            </Section>
          </Section>
          <Section style={footer}>
            <Text style={footerText}>
              Elevare Consultoria ·{" "}
              <a href="https://elevareconsultoria.com" style={link}>
                elevareconsultoria.com
              </a>{" "}
              · (11) 99484-0948
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export const template: TemplateEntry = {
  component: ReinspectionReminderEmail,
  subject: (data) =>
    data?.papel === "consultor"
      ? `Reinspeção de ${data?.nome_estabelecimento || "estabelecimento"} se aproxima`
      : "Sua próxima inspeção sanitária está se aproximando",
  displayName: "Lembrete de Reinspeção",
  previewData: {
    papel: "cliente",
    nome_estabelecimento: "Estabelecimento de Teste",
    cnpj: "12345678000199",
    data_conclusao_anterior: new Date().toISOString(),
    data_prevista_reinspecao: new Date().toISOString(),
    link_resultado: "https://elevareconsultoria.com",
  },
};

const main = {
  backgroundColor: "#ffffff",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
};

const container = {
  margin: "0 auto",
  padding: "0",
  width: "100%",
  maxWidth: "600px",
  border: "1px solid #eee",
};

const header = {
  backgroundColor: "#1a4d2e",
  padding: "30px",
  textAlign: "center" as const,
};

const logo = {
  margin: "0 auto 20px auto",
};

const headerTitle = {
  color: "#fff",
  fontSize: "24px",
  margin: "0",
};

const content = {
  padding: "30px",
};

const title = {
  fontSize: "20px",
  fontWeight: "bold",
  marginBottom: "20px",
  color: "#333",
};

const paragraph = {
  fontSize: "16px",
  lineHeight: "26px",
  color: "#333",
};

const infoSection = {
  margin: "20px 0",
  backgroundColor: "#f8fafc",
  borderRadius: "8px",
  padding: "20px",
};

const infoText = {
  fontSize: "16px",
  color: "#333",
  lineHeight: "1.5",
};

const buttonContainer = {
  textAlign: "center" as const,
  margin: "30px 0",
};

const button = {
  backgroundColor: "#1a4d2e",
  borderRadius: "6px",
  color: "#fff",
  fontSize: "16px",
  fontWeight: "bold",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "12px 24px",
};

const footer = {
  padding: "20px",
  textAlign: "center" as const,
  fontSize: "12px",
  color: "#64748b",
  borderTop: "1px solid #eee",
};

const footerText = {
  margin: "0",
};

const link = {
  color: "#1a4d2e",
  textDecoration: "underline",
};
