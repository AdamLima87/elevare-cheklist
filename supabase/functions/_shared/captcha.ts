// Seam para CAPTCHA — hoje sempre aprova. Sem chave de provedor
// (hCaptcha/Turnstile) nesta entrega; wirar a verificação real depois é
// trocar só o corpo desta função, sem tocar no chamador.
export async function verifyCaptcha(_token: string | null): Promise<boolean> {
  // TODO: integrar hCaptcha/Turnstile quando houver chave de provedor.
  return true;
}
