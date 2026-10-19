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

/**
 * The ERP serialises some text fields (addresses, contact names, measurements
 * like 1/2") with raw control characters, invalid backslash escapes, and the
 * occasional trailing comma — so a strict JSON.parse fails on larger responses
 * (e.g. a full client list). Try strict first; on failure, sanitize the obvious
 * offenders and retry; if it still won't parse, hand back the raw text so the
 * caller can decide what to do.
 */
export function parseErpBody(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    try {
      const cleaned = text
        .replace(new RegExp("[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F]", "g"), "") // raw control chars
        .replace(new RegExp('\\\\(?!["\\\\/bfnrt]|u[0-9a-fA-F]{4})', "g"), "") // invalid \escapes
        .replace(new RegExp(",(\\s*[}\\]])", "g"), "$1"); // trailing commas
      return JSON.parse(cleaned);
    } catch {
      return text; // genuinely not JSON (e.g. an IIS HTML error page)
    }
  }
}

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
  const body = parseErpBody(text);
  return { ok: res.ok, httpStatus: res.status, body };
}
