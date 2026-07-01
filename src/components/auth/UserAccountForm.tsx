import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { KeyRound, Mail, Loader2 } from "lucide-react";

const accountSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres").optional().or(z.literal("")),
  confirmPassword: z.string().optional().or(z.literal("")),
}).refine((data) => {
  if (data.password && data.password.length > 0) {
    return data.password && data.confirmPassword && data.password === data.confirmPassword;
  }
  return true;
}, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
}).refine((data) => {
  // If we want to make it required based on some external state, we'd need to pass a prop.
  // For now, the existing logic is okay, but let's make sure password matches confirm if password is present.
  return true;
}, {});

type AccountFormValues = z.infer<typeof accountSchema>;

export function UserAccountForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [initialEmail, setInitialEmail] = useState("");
  const [mustChangePassword, setMustChangePassword] = useState(false);

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("email, force_password_change")
          .eq("id", user.id)
          .single();
        
        if (profile) {
          setInitialEmail(profile.email || user.email || "");
          form.setValue("email", profile.email || user.email || "");
          setMustChangePassword(!!profile.force_password_change);
        }
      }
    }
    loadUser();
  }, [form]);

  async function onSubmit(values: AccountFormValues) {
    setIsLoading(true);
    try {
      const updates: any = {};
      
      if (values.email !== initialEmail) {
        updates.email = values.email;
      }
      
      if (values.password && values.password.length > 0) {
        updates.password = values.password;
        updates.data = { force_password_change: false }; // This will be handled by the update call below
      }

      if (Object.keys(updates).length === 0) {
        toast.info("Nenhuma alteração detectada");
        return;
      }

      const { error } = await supabase.auth.updateUser(updates);

      if (error) throw error;

      if (updates.password) {
        // Update the profile to clear the force flag
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("profiles").update({ force_password_change: false }).eq("id", user.id);
        }
      }

      if (updates.email) {
        toast.success("E-mail alterado! Verifique seu novo e-mail para confirmar a alteração.");
      } else {
        toast.success("Senha alterada com sucesso!");
      }
      
      form.setValue("password", "");
      form.setValue("confirmPassword", "");
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar dados");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center gap-2 font-medium text-foreground">
          <Mail className="h-4 w-4" />
          <span>Dados de Acesso</span>
        </div>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="pt-2 border-t mt-4">
              <div className="flex items-center gap-2 font-medium text-foreground mb-4">
                <KeyRound className="h-4 w-4" />
                <span>{mustChangePassword ? "Definir Nova Senha (Obrigatório)" : "Alterar Senha (opcional)"}</span>
              </div>
              
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nova Senha</FormLabel>
                      <FormControl>
                        <Input 
                          type="password" 
                          {...field} 
                          placeholder={mustChangePassword ? "Digite sua nova senha" : "Deixe em branco para manter a atual"}
                          required={mustChangePassword}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirmar Nova Senha</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} required={mustChangePassword} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Button type="submit" disabled={isLoading || (mustChangePassword && !form.watch("password"))} className="w-full">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar Alterações"
              )}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
