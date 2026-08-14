import { Body, Container, Head, Heading, Html, Img, Preview, Section, Text } from "@react-email/components";
import * as React from "react";
import type { TemplateEntry } from "./registry";

interface ContratoCodigoVerificacaoEmailProps {
  codigo?: string;
  consultoria_nome?: string;
}

export const ContratoCodigoVerificacaoEmail = ({
  codigo = "000000",
  consultoria_nome = "sua consultoria",
}: ContratoCodigoVerificacaoEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Seu código de verificação para assinatura eletrônica</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Img src="https://notify.elevareconsultoria.com/logo-white.png" width="150" alt="RDCheck" style={logo} />
            <Heading style={headerTitle}>Verificação de assinatura</Heading>
          </Section>
          <Section style={content}>
            <Text style={paragraph}>
              Use o código abaixo pra confirmar a assinatura eletrônica do contrato com {consultoria_nome}. Ele vale
              por 10 minutos.
            </Text>
            <Section style={codeContainer}>
              <Text style={codeText}>{codigo}</Text>
            </Section>
            <Text style={paragraph}>
              Se você não solicitou este código, ignore este e-mail — ninguém consegue assinar o contrato sem ele.
            </Text>
          </Section>
          <Section style={footer}>
            <Text style={footerText}>RDCheck · Sistema de gestão para consultorias de segurança de alimentos</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export const template: TemplateEntry = {
  component: ContratoCodigoVerificacaoEmail,
  subject: () => "Seu código de verificação para assinatura eletrônica",
  displayName: "Código de Verificação — Assinatura de Contrato",
  previewData: {
    codigo: "482913",
    consultoria_nome: "Consultoria Exemplo",
  },
};

const main = {
  backgroundColor: "#ffffff",
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
};
const container = { margin: "0 auto", padding: "0", width: "100%", maxWidth: "600px", border: "1px solid #eee" };
const header = { backgroundColor: "#184878", padding: "30px", textAlign: "center" as const };
const logo = { margin: "0 auto 20px auto" };
const headerTitle = { color: "#fff", fontSize: "24px", margin: "0" };
const content = { padding: "30px" };
const paragraph = { fontSize: "16px", lineHeight: "26px", color: "#333" };
const codeContainer = { textAlign: "center" as const, margin: "30px 0" };
const codeText = {
  fontSize: "36px",
  fontWeight: "bold",
  letterSpacing: "8px",
  color: "#184878",
  fontFamily: "monospace",
};
const footer = { padding: "20px", textAlign: "center" as const, fontSize: "12px", color: "#64748b", borderTop: "1px solid #eee" };
const footerText = { margin: "0" };
