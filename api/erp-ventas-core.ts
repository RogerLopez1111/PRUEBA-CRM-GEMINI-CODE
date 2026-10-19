import { callErp, ERP_MAX_REGISTROS } from "./erp-client.js";

/**
 * Core "ventas (sales) by vendedor" aggregation, pulled LIVE from the ERP HTTP
 * API — never mirrored into Supabase. Shared by the test route (api/erp-ventas.ts)
 * and the real performance endpoint (api/index.ts).
 *
 * Design notes:
 *  - The ERP has no aggregate action, so we fetch each vendedor's ventas for the
 *    date range and sum totales.subtotal / totales.total here.
 *  - One call PER VENDEDOR (not company-wide): a single seller's monthly ventas
 *    is small (~hundreds of rows, ~1s), whereas a whole-company pull times out
 *    and overflows the registros limit.
 *  - registros is capped at ERP_MAX_REGISTROS (int16 max); far above any single
 *    seller's monthly count, so results are never silently truncated.
 *  - The ERP is a modest IIS box shared with live users: too many parallel/heavy
 *    requests make it return transient "1001" busy errors (degrading it for
 *    everyone). So we fan out GENTLY — low concurrency + retry-with-backoff —
 *    and cache each per-seller result for a few minutes.
 */

export const ERP_VENTAS_CONCURRENCY = 2;
const MAX_ATTEMPTS = 2;
const RETRY_BASE_MS = 600;
// ERP error codes that mean "busy / try again", not "bad request". 1001 is the
// undocumented transient-overload code we observed under load — the heavy ventas
// query is the first thing the ERP sheds when busy (lighter queries still work).
const RETRYABLE_ERR_CODES = new Set(["1001"]);
// Circuit breaker: once this many sellers in a run come back busy, stop calling
// the ERP for the rest. Retrying a load-shed ERP only deepens the overload (and
// degrades it for the live ERP users sharing the box), so we fail fast instead.
const BREAKER_TRIP_AT = 5;
const BUSY_SKIPPED = "ERP ocupado (omitido)";
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 min — "accurate enough" without re-hitting the ERP each load

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type VendedorVentas = {
  vendedorId: string;
  count: number; // number of facturas (estatus FA)
  subtotal: number; // sum of totales.subtotal (sin impuesto)
  total: number; // sum of totales.total (con impuesto)
  truncated: boolean; // true if we hit the registros ceiling (should never happen per-seller)
  error?: string; // ERP error for this seller, if any — keeps the rest of the fan-out usable
};

const cache = new Map<string, { at: number; value: VendedorVentas }>();

export async function fetchVendedorVentas(
  vendedorId: string,
  desde: string,
  hasta: string
): Promise<VendedorVentas> {
  const key = `${vendedorId}|${desde}|${hasta}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  // Retry transient "busy" (1001) errors with growing backoff; surface any
  // other error (or a persistent 1001) to the caller without caching it.
  let body: any = null;
  let lastErr = "Error del ERP";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let resp;
    try {
      resp = await callErp("venta", "GetVentaLista", {
        vendedor: vendedorId,
        fecha_inicio: desde,
        fecha_final: hasta,
        registros: String(ERP_MAX_REGISTROS),
      });
    } catch {
      // Network error / timeout — the ERP is unreachable (e.g. off-LAN). Don't
      // retry a dead host; return an error so the caller can serve the snapshot.
      return { vendedorId, count: 0, subtotal: 0, total: 0, truncated: false, error: "ERP inalcanzable" };
    }
    body = resp.body;

    // ERP signals errors in-band: { type:"error", code, message }
    if (body && body.type === "error") {
      const code = String(body.code || "");
      lastErr = String(body.message || body.code || "Error del ERP");
      if (RETRYABLE_ERR_CODES.has(code) && attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_BASE_MS * attempt);
        continue;
      }
      // Non-retryable, or out of attempts — return (don't cache) so a later
      // request can retry once the ERP is no longer saturated.
      return { vendedorId, count: 0, subtotal: 0, total: 0, truncated: false, error: lastErr };
    }
    break; // success
  }

  // "What the seller sold" = INVOICED sales only. GetVentaLista returns both
  // remisiones (delivery notes) and direct docs; estatus "FA" (facturado) marks
  // the ones that became an invoice. We exclude everything else (pending
  // remisiones, cancelled, etc.) so the figure matches the ERP's ventas report.
  // The linked factura folios (totales.documento) are NOT returned as separate
  // rows, so counting the FA docs does not double-count.
  const rows: any[] = Array.isArray(body?.data?.venta) ? body.data.venta : [];
  let subtotal = 0; // sum of totales.subtotal (sin impuesto) — the sales value
  let total = 0; // sum of totales.total (con impuesto) — kept for reference
  let count = 0;
  for (const v of rows) {
    if (String(v?.estatus || "") !== "FA") continue; // only facturas (invoiced)
    count++;
    subtotal += Number(v?.totales?.subtotal) || 0;
    total += Number(v?.totales?.total) || 0;
  }

  const value: VendedorVentas = {
    vendedorId,
    count,
    subtotal,
    total,
    truncated: rows.length >= ERP_MAX_REGISTROS,
  };
  cache.set(key, { at: Date.now(), value });
  return value;
}

// Concurrency-limited map so we never open more than N sockets to the ERP at
// once (its IIS box is modest and large/parallel pulls are slow).
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (t: T, i: number) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return out;
}

export type VendedorVentasLabeled = VendedorVentas & { vendedorName: string };

// Aggregate ventas for a set of sellers (gently, concurrency-limited). Returns
// one row per seller, including any per-seller ERP error.
export async function aggregateVentas(
  sellers: { id: string; name: string }[],
  desde: string,
  hasta: string
): Promise<VendedorVentasLabeled[]> {
  // Per-run circuit breaker: count how many sellers come back "busy" and, once
  // the ERP is clearly shedding the ventas query, skip the remaining sellers
  // rather than piling on more load.
  let busyCount = 0;
  let tripped = false;

  return mapLimit(sellers, ERP_VENTAS_CONCURRENCY, async (s) => {
    if (tripped) {
      return { vendedorId: s.id, vendedorName: s.name, count: 0, subtotal: 0, total: 0, truncated: false, error: BUSY_SKIPPED };
    }
    const agg = await fetchVendedorVentas(s.id, desde, hasta);
    // Trip on any error (busy 1001 OR unreachable): no point hammering an ERP
    // that's shedding load or offline — the browser serves its own last cache.
    if (agg.error) {
      if (++busyCount >= BREAKER_TRIP_AT) tripped = true;
    }
    return { ...agg, vendedorName: s.name };
  });
}
