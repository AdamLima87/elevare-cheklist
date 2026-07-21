// CRM Comercial — Buscar Leads: criptografia da chave BYO (Google API key
// que o próprio cliente cola na tela de Integrações). Não existe
// precedente no projeto pra segredo por tenant — este é o padrão novo:
// AES-GCM via Web Crypto (nativo do Deno), com uma chave mestra que vive
// SÓ em secret de projeto (CRM_LEADS_ENC_KEY, nunca no banco, nunca no
// frontend). O banco (crm_leads_credenciais) guarda só ciphertext + iv;
// decriptar só é possível dentro desta Edge Function, de posse da chave
// mestra.
function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function importMasterKey(masterKeyB64: string): Promise<CryptoKey> {
  const raw = base64ToBytes(masterKeyB64);
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export interface EncryptedApiKey {
  ciphertext: string; // base64
  iv: string; // base64
}

export async function encryptApiKey(plaintext: string, masterKeyB64: string): Promise<EncryptedApiKey> {
  const key = await importMasterKey(masterKeyB64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertextBuffer = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  return {
    ciphertext: bytesToBase64(new Uint8Array(ciphertextBuffer)),
    iv: bytesToBase64(iv),
  };
}

export async function decryptApiKey(ciphertext: string, iv: string, masterKeyB64: string): Promise<string> {
  const key = await importMasterKey(masterKeyB64);
  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(iv) },
    key,
    base64ToBytes(ciphertext),
  );
  return new TextDecoder().decode(plaintextBuffer);
}
