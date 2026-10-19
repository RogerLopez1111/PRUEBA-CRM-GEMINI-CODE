/**
 * Thin server-side client for the ManagementPro (mproerp) WServices HTTP API.
 *
 * Centralises the one POST shape every action uses and keeps the apikey here,
 * read from .env — it must never reach the browser. Reachable only on the LAN
 * where the ERP lives (e.g. http://192.168.1.6/wservices/).
 */
const ERP_URL = process.env.MPRO_API_URL;
const ERP_KEY = process.env.MPRO_API_KEY;

// Max value the ERP's `registros` filter accepts: it is parsed as a signed
// 16-bit int, so 32767 works and anything larger returns a "(...)Overflow"
// error. Well above any single seller's monthly ventas, so no truncation.
export const ERP_MAX_REGISTROS = 32767;

export function erpConfigured(): boolean {
  return !!(ERP_URL && ERP_KEY);
}

export type ErpResponse = {
  ok: boolean;
  httpStatus: number;
  body: any;
};

export async function callErp(
  provider: string,
  action: string,
  data: unknown
): Promise<ErpResponse> {
  if (!ERP_URL || !ERP_KEY) {
    throw new Error("MPRO_API_URL / MPRO_API_KEY no están configurados en .env");
  }
  // Bounded timeout so an unreachable ERP (e.g. server off the LAN) fails fast
  // instead of hanging on a TCP SYN timeout.
  const res = await fetch(ERP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apikey: ERP_KEY, provider, action, data: data ?? {} }),
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  let body: any;
  try {
    body = JSON.parse(text);
  } catch {
    body = text; // ERP returned HTML/plain text (e.g. an IIS error page)
  }
  return { ok: res.ok, httpStatus: res.status, body };
}
