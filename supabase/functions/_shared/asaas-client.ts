// Cliente HTTP fino pra API do Asaas. Nunca chamado do frontend — só de
// dentro de Edge Functions, com a chave lida de Deno.env (secret), nunca
// hardcoded nem devolvida em nenhuma resposta.

function getBaseUrl(): string {
  const env = Deno.env.get("ASAAS_ENV") ?? "sandbox";
  return env === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";
}

function getApiKey(): string {
  const key = Deno.env.get("ASAAS_API_KEY");
  if (!key) throw new Error("ASAAS_API_KEY não configurada.");
  return key;
}

export class AsaasError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    const description =
      body && typeof body === "object" && "errors" in body
        ? JSON.stringify((body as { errors: unknown }).errors)
        : JSON.stringify(body);
    super(`Asaas API error (${status}): ${description}`);
    this.status = status;
    this.body = body;
  }
}

export async function asaasRequest<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      access_token: getApiKey(),
      "User-Agent": "RDCheck/1.0",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new AsaasError(res.status, data);
  return data as T;
}
