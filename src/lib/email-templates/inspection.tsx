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

interface InspectionEmailProps {
  email_cliente?: string;
  nome_estabelecimento?: string;
  cnpj?: string;
  data_inspecao?: string;
  conformidade?: number;
  classificacaoLabel?: string;
  classificacaoTone?: "success" | "warning" | "destructive";
  link_resultado?: string;
}

export const InspectionEmail = ({
  email_cliente = "cliente@exemplo.com",
  nome_estabelecimento = "Seu Estabelecimento",
  cnpj = "00.000.000/0001-00",
  data_inspecao = new Date().toISOString(),
  conformidade = 0,
  classificacaoLabel = "REGULAR",
  classificacaoTone = "warning",
  link_resultado = "https://elevareconsultoria.com",
}: InspectionEmailProps) => {
  let badgeColor = "#f59e0b"; // warning
  let badgeIcon = "⚠️";
  if (classificacaoTone === "success") {
    badgeColor = "#1a4d2e";
    badgeIcon = "✅";
  } else if (classificacaoTone === "destructive") {
    badgeColor = "#dc2626";
    badgeIcon = "❌";
  }

  return (
    <Html>
      <Head />
      <Preview>Seu Relatório de Inspeção está disponível</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Img
              src="https://notify.elevareconsultoria.com/logo-white.png"
              width="150"
              alt="Elevare"
              style={logo}
            />
            <Heading style={headerTitle}>Relatório Disponível</Heading>
          </Section>
          <Section style={content}>
            <Heading as="h2" style={title}>
              Seu Relatório de Inspeção está disponível
            </Heading>
            <Text style={paragraph}>
              Olá, o relatório da inspeção realizada no seu estabelecimento foi finalizado.
            </Text>

            <Section style={infoSection}>
              <Text style={infoText}>
                <strong>Estabelecimento:</strong> {nome_estabelecimento}
                <br />
                <strong>Data da Inspeção:</strong>{" "}
                {new Date(data_inspecao).toLocaleDateString("pt-BR")}
              </Text>
            </Section>

            <Section style={scoreBox}>
              <Text style={scoreLabel}>Percentual de Conformidade</Text>
              <Text style={{ ...scoreValue, color: badgeColor }}>
                {conformidade.toFixed(2)}%
              </Text>
              <Text style={{ ...badge, backgroundColor: badgeColor }}>
                {badgeIcon} {classificacaoLabel}
              </Text>
            </Section>

            <Section style={buttonContainer}>
              <Button style={button} href={link_resultado}>
                Acessar meu resultado
              </Button>
            </Section>

            <Section style={instructions}>
              <Text style={instructionTitle}>
                <strong>Instruções de acesso:</strong>
              </Text>
              <ul style={instructionList}>
                <li>
                  Selecione <strong>'Cliente'</strong> na tela de login
                </li>
                <li>
                  <strong>E-mail de acesso:</strong> {email_cliente}
                </li>
                <li>
                  <strong>Senha:</strong> {cnpj.replace(/\D/g, "")} (somente números)
                </li>
              </ul>
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
  component: InspectionEmail,
  subject: "Seu Relatório de Inspeção está disponível",
  displayName: "Relatório de Inspeção",
  previewData: {
    email_cliente: "cliente@exemplo.com",
    nome_estabelecimento: "Estabelecimento de Teste",
    cnpj: "12345678000199",
    data_inspecao: new Date().toISOString(),
    conformidade: 85.5,
    classificacaoLabel: "BOM",
    classificacaoTone: "success",
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
};

const infoText = {
  fontSize: "16px",
  color: "#333",
  lineHeight: "1.5",
};

const scoreBox = {
  backgroundColor: "#f8fafc",
  borderRadius: "8px",
  padding: "20px",
  textAlign: "center" as const,
  marginBottom: "20px",
};

const scoreLabel = {
  fontSize: "14px",
  color: "#64748b",
  textTransform: "uppercase" as const,
  margin: "0",
};

const scoreValue = {
  fontSize: "36px",
  fontWeight: "bold",
  margin: "10px 0",
};

const badge = {
  display: "inline-block",
  padding: "6px 12px",
  borderRadius: "4px",
  color: "#fff",
  fontWeight: "bold",
  fontSize: "14px",
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

const instructions = {
  backgroundColor: "#f1f5f9",
  padding: "20px",
  borderRadius: "8px",
  fontSize: "14px",
  marginTop: "30px",
};

const instructionTitle = {
  fontSize: "16px",
  marginBottom: "10px",
};

const instructionList = {
  margin: "0",
  paddingLeft: "20px",
  color: "#333",
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
