import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  emptyEstabelecimento,
  loadRascunho,
  saveRascunho,
  saveToHistorico,
  type Estabelecimento,
  type Inspecao,
} from "@/lib/storage";
import { supabase } from "@/integrations/supabase/client";
import type { Cliente } from "@/hooks/useClientes";
import { ArrowRight, Loader2 } from "lucide-react";

export function formatCNPJ(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  let formatted = digits;
  if (digits.length > 2) formatted = `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length > 5) formatted = `${formatted.slice(0, 6)}.${digits.slice(5)}`;
  if (digits.length > 8) formatted = `${formatted.slice(0, 10)}/${digits.slice(8)}`;
  if (digits.length > 12) formatted = `${formatted.slice(0, 15)}-${digits.slice(12)}`;
  return formatted;
}

interface NovaInspecaoFormProps {
  /** Cliente já aberto — habilita o resgate automático de rascunho e o aviso de sobrescrita. */
  clienteId?: string;
  /** Dados iniciais (nome/CNPJ) do cliente já cadastrado, pra não redigitar. */
  prefill?: Partial<Estabelecimento>;
  /** Comportamento da rota /nova-inspecao standalone: carrega o rascunho global via ?edit=true. */
  editFromUrl?: boolean;
}

export function NovaInspecaoForm({ clienteId, prefill, editFromUrl = false }: NovaInspecaoFormProps) {
  const navigate = useNavigate();
  const [estab, setEstab] = useState<Estabelecimento>(() => ({
    ...emptyEstabelecimento(),
    ...prefill,
    cnpj: prefill?.cnpj ? formatCNPJ(prefill.cnpj) : (prefill?.cnpj ?? ""),
  }));
  const [rascunho, setRascunho] = useState<Inspecao | null>(null);
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();
      if (profileData) setProfile(profileData);
    }
    loadProfile();
  }, []);

  useEffect(() => {
    const existing = loadRascunho();
    if (!existing) return;

    if (editFromUrl) {
      setRascunho(existing);
      if (existing.dados?.estabelecimento) setEstab(existing.dados.estabelecimento);
      return;
    }

    // Dentro da aba de um cliente: só carrega automaticamente se o rascunho já
    // for desse mesmo cliente (mesmo CNPJ). Rascunho de outro cliente fica
    // intocado até o usuário confirmar que quer substituí-lo (ver `iniciar`).
    const existingCnpj = existing.dados?.estabelecimento?.cnpj?.replace(/\D/g, "") ?? "";
    const prefillCnpj = (prefill?.cnpj ?? "").replace(/\D/g, "");
    if (clienteId && prefillCnpj && existingCnpj === prefillCnpj) {
      setRascunho(existing);
      if (existing.dados?.estabelecimento) setEstab(existing.dados.estabelecimento);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editFromUrl, clienteId]);

  const update = (k: keyof Estabelecimento, v: string) => {
    let finalValue = v;
    if (k === "cnpj") {
      finalValue = formatCNPJ(v);
    }
    setEstab((s: Estabelecimento) => ({ ...s, [k]: finalValue }));
  };

  const handleCnpjBlur = async () => {
    const digits = estab.cnpj.replace(/\D/g, "");
    if (digits.length !== 14) return;

    setLoadingCnpj(true);

    // Se já existe um cliente cadastrado com esse CNPJ, reaproveita os dados
    // e evita bater nas APIs públicas de CNPJ.
    if (profile?.empresa_id) {
      const { data: existing } = await supabase
        .from("clientes")
        .select("*")
        .eq("empresa_id", profile.empresa_id)
        .eq("cnpj", digits)
        .maybeSingle();

      if (existing) {
        const cliente = existing as Cliente;
        setEstab((s: Estabelecimento) => ({
          ...s,
          razaoSocial: cliente.nome || s.razaoSocial,
          nomeFantasia: cliente.nome || s.nomeFantasia,
          atividade: cliente.categoria || s.atividade,
        }));
        toast.success("Cliente já cadastrado — dados preenchidos automaticamente.", {
          id: "cnpj-lookup",
        });
        setLoadingCnpj(false);
        return;
      }
    }

    // Normaliza resposta de diferentes provedores para um shape único
    type Norm = {
      razao_social?: string;
      nome_fantasia?: string;
      cnae_desc?: string;
      logradouro?: string;
      numero?: string;
      complemento?: string;
      bairro?: string;
      cep?: string;
      municipio?: string;
      uf?: string;
    };

    const fromBrasilAPI = async (): Promise<Norm | null> => {
      const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
      if (!r.ok) return null;
      const d = await r.json();
      return {
        razao_social: d.razao_social,
        nome_fantasia: d.nome_fantasia,
        cnae_desc: d.cnae_fiscal_descricao,
        logradouro: d.logradouro,
        numero: d.numero,
        complemento: d.complemento,
        bairro: d.bairro,
        cep: d.cep,
        municipio: d.municipio,
        uf: d.uf,
      };
    };

    const fromCnpjWs = async (): Promise<Norm | null> => {
      const r = await fetch(`https://publica.cnpj.ws/cnpj/${digits}`);
      if (!r.ok) return null;
      const d = await r.json();
      const est = d.estabelecimento || {};
      const cnae = est.atividade_principal || {};
      return {
        razao_social: d.razao_social,
        nome_fantasia: est.nome_fantasia,
        cnae_desc: cnae.descricao,
        logradouro: [est.tipo_logradouro, est.logradouro].filter(Boolean).join(" "),
        numero: est.numero,
        complemento: est.complemento,
        bairro: est.bairro,
        cep: est.cep,
        municipio: est.cidade?.nome,
        uf: est.estado?.sigla,
      };
    };

    const fromOpenCnpja = async (): Promise<Norm | null> => {
      const r = await fetch(`https://open.cnpja.com/office/${digits}`);
      if (!r.ok) return null;
      const d = await r.json();
      const addr = d.address || {};
      return {
        razao_social: d.company?.name,
        nome_fantasia: d.alias || d.company?.name,
        cnae_desc: d.mainActivity?.text,
        logradouro: addr.street,
        numero: addr.number,
        complemento: addr.details,
        bairro: addr.district,
        cep: addr.zip,
        municipio: addr.city,
        uf: addr.state,
      };
    };

    const providers = [fromBrasilAPI, fromCnpjWs, fromOpenCnpja];
    let data: Norm | null = null;
    let lastErr: unknown = null;

    for (const p of providers) {
      try {
        const d = await p();
        if (d && (d.razao_social || d.nome_fantasia)) {
          data = d;
          break;
        }
      } catch (e) {
        lastErr = e;
      }
    }

    if (!data) {
      console.error("CNPJ lookup falhou em todos os provedores", lastErr);
      toast.error("CNPJ não encontrado nos serviços públicos. Preencha os dados manualmente.", { id: "cnpj-lookup" });
      setLoadingCnpj(false);
      return;
    }

    const enderecoStr = [data.logradouro, data.numero, data.complemento]
      .filter(Boolean)
      .join(", ");

    setEstab((s: Estabelecimento) => ({
      ...s,
      razaoSocial: data!.razao_social || s.razaoSocial,
      nomeFantasia: data!.nome_fantasia || data!.razao_social || s.nomeFantasia,
      atividade: data!.cnae_desc || s.atividade,
      endereco: enderecoStr || s.endereco,
      bairro: data!.bairro || s.bairro,
      cep: data!.cep || "",
      municipio: data!.municipio || "",
      uf: data!.uf || "",
    }));

    toast.success("Dados do estabelecimento carregados!", { id: "cnpj-lookup" });
    setLoadingCnpj(false);
  };

  const iniciar = async () => {
    const required: (keyof Estabelecimento)[] = ["razaoSocial", "nomeFantasia", "cnpj", "respLegalNome", "dataHora"];
    const missing = required.filter((k) => !estab[k]);
    if (missing.length) {
      toast.error("Preencha os campos obrigatórios antes de iniciar.");
      return;
    }

    // Rascunho é uma única chave global no localStorage. Se já existe um
    // rascunho de OUTRO estabelecimento e não estamos continuando ele,
    // confirma antes de sobrescrever.
    if (!rascunho) {
      const existing = loadRascunho();
      if (existing) {
        const existingCnpj = existing.dados?.estabelecimento?.cnpj?.replace(/\D/g, "") ?? "";
        const thisCnpj = estab.cnpj.replace(/\D/g, "");
        if (existingCnpj && existingCnpj !== thisCnpj) {
          const nomeExistente =
            existing.dados?.estabelecimento?.nomeFantasia || existing.estabelecimento || "outro estabelecimento";
          const confirmado = window.confirm(
            `Você tem uma inspeção em andamento para "${nomeExistente}" que ainda não foi concluída. Iniciar uma nova aqui vai substituir esse rascunho. Deseja continuar?`,
          );
          if (!confirmado) return;
        }
      }
    }

    const emailResponsavel = estab.respLegalEmail || estab.email;
    if (!emailResponsavel) {
      toast.warning("Adicione o e-mail do responsável para criar o acesso do cliente.");
    }

    const loadingToast = toast.loading(rascunho ? "Salvando alterações..." : "Iniciando checklist...");
    try {
      let insp: Inspecao;

      if (rascunho) {
        insp = {
          ...rascunho,
          dados: {
            ...rascunho.dados,
            estabelecimento: estab,
          },
          estabelecimento: estab.nomeFantasia || estab.razaoSocial,
        };
      } else {
        const { createNewInspecao } = await import("@/lib/storage");
        insp = await createNewInspecao();
        insp.dados.estabelecimento = estab;
        insp.estabelecimento = estab.nomeFantasia || estab.razaoSocial;
      }

      await saveRascunho(insp);
      await saveToHistorico(insp);

      // Auto-create client if email is present
      if (emailResponsavel && estab.cnpj) {
        const cleanCnpj = estab.cnpj.replace(/\D/g, "");
        supabase.functions
          .invoke("admin-manage-users", {
            body: {
              action: "create_client",
              userData: {
                email: emailResponsavel,
                password: cleanCnpj,
                nome: estab.nomeFantasia || estab.razaoSocial,
                perfil: "cliente",
                cnpj: cleanCnpj,
              },
            },
          })
          .then(({ data }) => {
            if (data && !data.error) {
              toast.info("Acesso do cliente garantido", { duration: 3000 });
            }
          });
      }

      setEstab({
        ...emptyEstabelecimento(),
        ...prefill,
        cnpj: prefill?.cnpj ? formatCNPJ(prefill.cnpj) : (prefill?.cnpj ?? ""),
      });
      setRascunho(null);

      toast.dismiss(loadingToast);
      navigate({ to: "/checklist" });
    } catch (error) {
      console.error("Erro ao processar inspeção:", error);
      toast.error("Erro ao salvar dados. Verifique sua conexão.");
      toast.dismiss(loadingToast);
    }
  };

  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Dados do Estabelecimento</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="relative">
            <Field
              label="CNPJ *"
              value={estab.cnpj}
              onChange={(v) => update("cnpj", v)}
              onBlur={handleCnpjBlur}
              placeholder="00.000.000/0000-00"
            />
            {loadingCnpj && (
              <div className="absolute right-3 top-8">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              </div>
            )}
          </div>
          <Field label="Razão Social *" value={estab.razaoSocial} onChange={(v) => update("razaoSocial", v)} />
          <Field label="Nome Fantasia *" value={estab.nomeFantasia} onChange={(v) => update("nomeFantasia", v)} />
          <Field label="Atividade" value={estab.atividade} onChange={(v) => update("atividade", v)} />
          <Field label="Endereço" value={estab.endereco} onChange={(v) => update("endereco", v)} className="sm:col-span-2" />
          <Field label="Bairro" value={estab.bairro} onChange={(v) => update("bairro", v)} />
          <Field label="Data e Hora da inspeção *" type="datetime-local" value={estab.dataHora} onChange={(v) => update("dataHora", v)} />
          <Field label="E-mail do Estabelecimento *" type="email" value={estab.email} onChange={(v) => update("email", v)} placeholder="contato@exemplo.com" />
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-lg">Responsável Legal</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nome *" value={estab.respLegalNome} onChange={(v) => update("respLegalNome", v)} />
          <Field label="E-mail do Responsável" type="email" value={estab.respLegalEmail} onChange={(v) => update("respLegalEmail", v)} placeholder="responsavel@exemplo.com" />
          <Field label="CPF" value={estab.respLegalCpf} onChange={(v) => update("respLegalCpf", v)} />
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-lg">Responsável Técnico</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nome" value={estab.respTecNome} onChange={(v) => update("respTecNome", v)} />
          <Field label="CPF" value={estab.respTecCpf} onChange={(v) => update("respTecCpf", v)} />
          <Field label="Conselho Regional" value={estab.respTecConselho} onChange={(v) => update("respTecConselho", v)} placeholder="Ex: CRN, CRMV..." />
          <Field label="Nº de Registro" value={estab.respTecRegistro} onChange={(v) => update("respTecRegistro", v)} />
        </CardContent>
      </Card>

      <div className="mt-6 flex justify-end">
        <Button size="lg" onClick={iniciar} className="gap-2">
          {rascunho ? "Salvar e Continuar" : "Iniciar Checklist"} <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  onBlur,
  type = "text",
  placeholder,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  type?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
      />
    </div>
  );
}
