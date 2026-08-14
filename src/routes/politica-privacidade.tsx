import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/elevare/Logo";

export const Route = createFileRoute("/politica-privacidade")({
  head: () => ({ meta: [{ title: "Política de Privacidade · RDCheck" }] }),
  component: PoliticaPrivacidadePage,
});

export const POLITICA_PRIVACIDADE_VERSAO = "1.0";
const ATUALIZADA_EM = "14 de agosto de 2026";

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-slate-800 mb-2">{titulo}</h2>
      <div className="text-sm text-slate-600 leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

function PoliticaPrivacidadePage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Logo />
          <Link to="/" className="text-sm text-[#184878] hover:underline">
            Voltar
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Política de Privacidade</h1>
        <p className="text-sm text-slate-500 mb-8">
          Versão {POLITICA_PRIVACIDADE_VERSAO} — atualizada em {ATUALIZADA_EM}
        </p>

        <Secao titulo="1. Quem trata os seus dados">
          <p>
            O RDCheck é uma plataforma de diagnóstico e gestão de conformidade sanitária, operada por consultorias
            independentes que a utilizam para atender seus próprios clientes. Cada consultoria que usa o RDCheck é a
            controladora dos dados dos seus clientes; nós fornecemos a infraestrutura técnica.
          </p>
        </Secao>

        <Secao titulo="2. Quais dados coletamos e para quê">
          <p>
            <strong>Da consultoria (quem usa o RDCheck):</strong> nome, e-mail e telefone/WhatsApp, coletados no
            cadastro. Usados para login, comunicação transacional e identificação em relatórios.
          </p>
          <p>
            <strong>Dos clientes da consultoria e seus representantes:</strong> razão social ou nome, CNPJ ou CPF,
            endereço, e dados de contato, coletados nas telas de Contas e Diagnóstico. Usados para gerar propostas,
            contratos e relatórios de inspeção sanitária — a finalidade é a prestação do próprio serviço de
            consultoria contratado.
          </p>
          <p>
            <strong>Dados de inspeção:</strong> nome do responsável legal e do responsável técnico do estabelecimento
            inspecionado (com registro profissional, quando aplicável), coletados no formulário de diagnóstico e
            impressos no relatório final, que é o produto entregue pela consultoria ao seu cliente.
          </p>
        </Secao>

        <Secao titulo="3. Base legal">
          <p>
            Tratamos os dados da consultoria com base no seu <strong>consentimento</strong>, registrado no momento do
            cadastro. Tratamos os dados de clientes da consultoria e de terceiros mencionados em relatórios de
            inspeção com base na <strong>execução do contrato</strong> de consultoria e no{" "}
            <strong>cumprimento de obrigação legal/regulatória</strong> (documentação de conformidade sanitária
            exigida por órgãos como a ANVISA e vigilâncias sanitárias estaduais).
          </p>
        </Secao>

        <Secao titulo="4. Com quem compartilhamos">
          <p>Não vendemos dados pessoais. Compartilhamos o mínimo necessário com:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Supabase</strong> (banco de dados, autenticação e armazenamento de arquivos) — infraestrutura
              hospedada no Brasil.
            </li>
            <li>
              <strong>Asaas</strong> (processamento de pagamento de assinaturas) — empresa brasileira; dados de cartão
              não passam pelo RDCheck.
            </li>
            <li>
              <strong>Google Places API</strong> (busca de estabelecimentos, uso interno da consultoria) — recebe
              apenas termos de busca digitados pela consultoria, nunca dados de clientes dela.
            </li>
            <li>
              <strong>Provedor de e-mail transacional</strong> — para envio de confirmações, propostas e contratos.
            </li>
          </ul>
        </Secao>

        <Secao titulo="5. Transferência internacional">
          <p>
            O banco de dados principal fica hospedado no Brasil. Parte da infraestrutura de hospedagem do site
            (processamento das requisições) e o provedor de busca de estabelecimentos (Google) operam fora do Brasil,
            sujeitos às garantias contratuais e legais desses fornecedores.
          </p>
        </Secao>

        <Secao titulo="6. Por quanto tempo guardamos">
          <p>
            Dados de conta são mantidos enquanto a conta estiver ativa. Relatórios de inspeção sanitária são mantidos
            pelo prazo de guarda documental aplicável a registros de conformidade regulatória. Tentativas de login e
            registros de auditoria de segurança são mantidos por período limitado e depois descartados
            automaticamente.
          </p>
        </Secao>

        <Secao titulo="7. Seus direitos">
          <p>
            Você pode solicitar a qualquer momento a exportação de todos os dados pessoais que temos sobre você, ou a
            exclusão/anonimização deles (respeitando obrigações legais de guarda documental que eventualmente se
            apliquem). Para exercer esses direitos, entre em contato pelo canal indicado abaixo.
          </p>
        </Secao>

        <Secao titulo="8. Contato">
          <p>
            Dúvidas sobre esta política ou sobre o tratamento dos seus dados podem ser enviadas para{" "}
            <a href="mailto:privacidade@elevareconsultoria.com" className="text-[#184878] hover:underline">
              privacidade@elevareconsultoria.com
            </a>
            .
          </p>
        </Secao>
      </main>
    </div>
  );
}
