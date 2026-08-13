import { Body, Button, Container, Head, Heading, Html, Img, Preview, Section, Text } from "@react-email/components";
import * as React from "react";
import type { TemplateEntry } from "./registry";

interface ContratoDisponivelEmailProps {
  cliente_nome?: string;
  consultoria_nome?: string;
  link_documento?: string;
}

export const ContratoDisponivelEmail = ({
  cliente_nome = "Cliente",
  consultoria_nome = "sua consultoria",
  link_documento = "https://elevareconsultoria.com",
}: ContratoDisponivelEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Seu contrato está disponível para visualização</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Img src="https://notify.elevareconsultoria.com/logo-white.png" width="150" alt="RDCheck" style={logo} />
            <Heading style={headerTitle}>Contrato de Prestação de Serviços</Heading>
          </Section>
          <Section style={content}>
            <Heading as="h2" style={title}>
              Olá, {cliente_nome}
            </Heading>
            <Text style={paragraph}>
              {consultoria_nome} disponibilizou o contrato de prestação de serviços para sua revisão. Clique no
              botão abaixo para visualizar o conteúdo.
            </Text>
            <Section style={buttonContainer}>
              <Button style={button} href={link_documento}>
                Visualizar contrato
              </Button>
            </Section>
            <Text style={paragraph}>
              A assinatura e o envio da via assinada devem ser combinados diretamente com {consultoria_nome}.
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
  component: ContratoDisponivelEmail,
  subject: (data) => `Contrato de ${data?.consultoria_nome || "sua consultoria"} disponível para revisão`,
  displayName: "Contrato Disponível",
  previewData: {
    cliente_nome: "João da Silva",
    consultoria_nome: "Consultoria Exemplo",
    link_documento: "https://elevareconsultoria.com",
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
const title = { fontSize: "20px", fontWeight: "bold", marginBottom: "20px", color: "#333" };
const paragraph = { fontSize: "16px", lineHeight: "26px", color: "#333" };
const buttonContainer = { textAlign: "center" as const, margin: "30px 0" };
const button = {
  backgroundColor: "#184878",
  borderRadius: "6px",
  color: "#fff",
  fontSize: "16px",
  fontWeight: "bold",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "12px 24px",
};
const footer = { padding: "20px", textAlign: "center" as const, fontSize: "12px", color: "#64748b", borderTop: "1px solid #eee" };
const footerText = { margin: "0" };
