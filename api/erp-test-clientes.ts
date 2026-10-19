import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import { callErp, erpConfigured, ERP_MAX_REGISTROS } from "./erp-client.js";
import { mapLimit } from "./erp-ventas-core.js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

/**
 * Test-only "clientes por vendedor, agrupados por segmento" report for the
 * ?erp-test screen (no auth). Reproduces the ManagementPro "Reporte analítico
 * (cliente)" roster: pick a seller → list their active clients grouped by
 * segmento. Entirely live from the WServices HTTP API — no Supabase mirror.
 *
 * Why two ERP calls per report:
 *   - GetClienteLista(vendedor) returns the seller's clients FAST, but the ERP's
 *     list response omits segmento (confirmed against the v2 docs).
 *   - GetCliente(clave) DOES carry segmento, but one client at a time — so we
 *     fan out those light calls (concurrency-limited, with a circuit breaker) to
 *     resolve each client's segmento. The report is per-seller, keeping the call
 *     count bounded (a big seller ~200 clients ≈ a few seconds).
 */
const router = Router();

// Static copy of the ERP Segmento catalog. WServices exposes no segmento-list
// action (GetSegmentoLista / GetSegmento → "acción no válida"), and GetCliente
// returns only the segmento CODE — so names are resolved from this small, stable
// catalog. Keep in sync with the ERP Segmento table if segments are ever added.
const SEGMENTO_NAMES: Record<string, string> = {
  "0000": "SIN SEGMENTO",
  "0001": "AUTOCONTROL",
  "0002": "CONTROLADORES DE PLAGAS",
  "0003": "DISTRIBUIDORES",
  "0004": "GRANOS ALMACENADOS",
  "0005": "MOSTRADOR",
  "0006": "ESPECIALES",
  "0007": "CLIENTES INCOBABLES",
  "0008": "GOBIERNO MUNICIPAL",
  "0009": "VENTAS POR SERVICIOS",
  "0010": "VENTA DE ACTIVOS",
  "0011": "MAYORISTAS ABARROTEROS",
  "0012": "VENTAS EN LINEA",
  "0013": "GOBIERNO ESTATAL",
  "0014": "DEUDOR EMPLEADOS",
};

// GetCliente is a light single-record call (no big productos arrays like ventas),
// so it tolerates more concurrency than the ventas pull. Still bounded + broken
// so we never pile load onto the shared ERP box.
const CLIENTE_CONCURRENCY = 6;
const BREAKER_TRIP_AT = 8;

function asArray<T = any>(v: any): T[] {
  return Array.isArray(v) ? v : v ? [v] : [];
}

// Active sellers for the picker — live from the ERP catalog.
router.get("/api/erp-test/vendedores", async (_req, res) => {
  if (!erpConfigured()) {
    res.status(500).json({ error: "MPRO_API_URL / MPRO_API_KEY no están configurados en .env" });
    return;
  }
  try {
    const resp = await callErp("catalogos", "GetVendedorLista", { registros: "1000" });
    if (resp.body?.type === "error") {
      res.status(502).json({ error: String(resp.body.message || resp.body.code || "Error del ERP") });
      return;
    }
    const vendedores = asArray(resp.body?.data?.vendedor)
      .filter((v) => String(v?.estatus || "").trim() === "AC")
      .map((v) => ({ id: String(v.clave), name: String(v.descripcion || "").trim() }))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
    res.json({ vendedores });
  } catch (err: any) {
    res.status(502).json({ error: `No se pudo conectar al ERP: ${err?.message || String(err)}` });
  }
});

// Clients of one seller, grouped by segmento.
router.post("/api/erp-test/clientes-por-segmento", async (req, res) => {
  if (!erpConfigured()) {
    res.status(500).json({ error: "MPRO_API_URL / MPRO_API_KEY no están configurados en .env" });
    return;
  }
  const vendedor = String(req.body?.vendedor || "").trim();
  if (!vendedor) {
    res.status(400).json({ error: "Falta 'vendedor' (clave)." });
    return;
  }

  const started = Date.now();
  try {
    // 1) The seller's active clients (one fast call). No segmento in this payload.
    const listResp = await callErp("catalogos", "GetClienteLista", {
      busqueda: "", estado: "AC", clave: "", sucursal: "",
      grupo_comercial: "", vendedor, registros: String(ERP_MAX_REGISTROS),
    });
    if (listResp.body?.type === "error") {
      res.status(502).json({ error: String(listResp.body.message || listResp.body.code || "Error del ERP") });
      return;
    }
    const rows = asArray(listResp.body?.data?.cliente);
    const vendedorName = String(rows[0]?.vendedor?.descripcion || "").trim() || vendedor;
    const clientes = rows.map((r) => ({
      clave: String(r?.clave || ""),
      nombre: String(r?.descripcion || "").trim(),
      razonSocial: String(r?.razon_social || "").trim(),
    }));

    // 2) Resolve each client's segmento via GetCliente — light calls, fanned out
    //    gently with a per-run circuit breaker (stop if the ERP starts shedding).
    let busy = 0;
    let tripped = false;
    let errors = 0;
    const withSeg = await mapLimit(clientes, CLIENTE_CONCURRENCY, async (c) => {
      if (tripped) {
        errors++;
        return { ...c, segmento: null as string | null, error: "ERP ocupado (omitido)" };
      }
      try {
        const r = await callErp("catalogos", "GetCliente", { cliente: c.clave });
        if (r.body?.type === "error") {
          if (++busy >= BREAKER_TRIP_AT) tripped = true;
          errors++;
          return { ...c, segmento: null as string | null, error: String(r.body.message || r.body.code || "error") };
        }
        const seg = r.body?.data?.cliente?.segmento ?? r.body?.data?.segmento ?? null;
        return { ...c, segmento: seg != null ? String(seg) : null, error: undefined as string | undefined };
      } catch {
        if (++busy >= BREAKER_TRIP_AT) tripped = true;
        errors++;
        return { ...c, segmento: null as string | null, error: "ERP inalcanzable" };
      }
    });

    // 3) Group by segmento (clients whose segmento couldn't be read land in "—").
    const groups = new Map<string, { id: string; name: string; clientes: typeof withSeg }>();
    for (const c of withSeg) {
      const id = c.segmento ?? "—";
      const name = c.segmento
        ? SEGMENTO_NAMES[c.segmento] ?? `SEGMENTO ${c.segmento}`
        : "SIN SEGMENTO (no obtenido)";
      if (!groups.has(id)) groups.set(id, { id, name, clientes: [] });
      groups.get(id)!.clientes.push(c);
    }
    const segmentos = [...groups.values()].sort((a, b) => a.id.localeCompare(b.id));
    for (const g of segmentos) g.clientes.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

    res.json({
      vendedor: { id: vendedor, name: vendedorName },
      segmentos: segmentos.map((g) => ({
        id: g.id,
        name: g.name,
        count: g.clientes.length,
        clientes: g.clientes.map((c) => ({ clave: c.clave, nombre: c.nombre, razonSocial: c.razonSocial, error: c.error })),
      })),
      totals: { clientes: withSeg.length, segmentos: segmentos.length },
      meta: {
        errors,
        truncated: rows.length >= ERP_MAX_REGISTROS,
        elapsedMs: Date.now() - started,
      },
    });
  } catch (err: any) {
    res.status(502).json({ error: `Error consultando clientes del ERP: ${err?.message || String(err)}` });
  }
});

// ---------------------------------------------------------------------------
// REPORTE ANALÍTICO DE VENTAS ANUAL (CLIENTE) — read entirely from the mirror
// table erp_ventas_cliente_mensual (populated by sync-erp). No ERP API call.
// ---------------------------------------------------------------------------

// Sellers for the picker + the years available. Read from the small `vendedores`
// mirror (not the 18k-row fact table, which would hit the 1000-row cap) and derive
// the year range from the fact table's min/max periodo (two tiny queries).
router.get("/api/erp-test/reporte/vendedores", async (_req, res) => {
  const { data: vends, error: vErr } = await supabase
    .from("vendedores")
    .select("Vn_Cve_Vendedor, Vn_Descripcion")
    .eq("Es_Cve_Estado", "AC")
    .order("Vn_Descripcion", { ascending: true });
  if (vErr) {
    res.status(500).json({ error: `No se pudieron leer vendedores: ${vErr.message}` });
    return;
  }
  const vendedores = (vends || []).map((v) => ({
    id: String(v.Vn_Cve_Vendedor),
    name: String(v.Vn_Descripcion || v.Vn_Cve_Vendedor),
  }));

  // Available years = every year between the earliest and latest periodo present.
  const [{ data: minRow }, { data: maxRow }] = await Promise.all([
    supabase.from("erp_ventas_cliente_mensual").select("periodo").order("periodo", { ascending: true }).limit(1),
    supabase.from("erp_ventas_cliente_mensual").select("periodo").order("periodo", { ascending: false }).limit(1),
  ]);
  const minY = Number(String(minRow?.[0]?.periodo || "").slice(0, 4));
  const maxY = Number(String(maxRow?.[0]?.periodo || "").slice(0, 4));
  const anios: string[] = [];
  if (minY && maxY) for (let y = maxY; y >= minY; y--) anios.push(String(y));

  res.json({ vendedores, anios });
});

// The annual matrix for one seller: clients grouped by segmento, importe per month.
router.post("/api/erp-test/reporte/anual", async (req, res) => {
  const vendedor = String(req.body?.vendedor || "").trim();
  const anio = String(req.body?.anio || "").trim();
  if (!vendedor || !/^\d{4}$/.test(anio)) {
    res.status(400).json({ error: "Faltan 'vendedor' y 'anio' (YYYY)." });
    return;
  }

  // Pull every (cliente, periodo) row for this seller/year. A big seller's year
  // can exceed Supabase's 1000-row cap, so page through until a short page.
  const PAGE = 1000;
  const data: any[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data: page, error } = await supabase
      .from("erp_ventas_cliente_mensual")
      .select("segmento_id, segmento_nombre, cliente_id, cliente_nombre, razon_social, periodo, importe")
      .eq("vendedor_id", vendedor)
      .gte("periodo", `${anio}-01`)
      .lte("periodo", `${anio}-12`)
      .range(from, from + PAGE - 1);
    if (error) {
      res.status(500).json({ error: `No se pudo leer el reporte: ${error.message}` });
      return;
    }
    if (!page || page.length === 0) break;
    data.push(...page);
    if (page.length < PAGE) break;
  }

  // Group: segmento → cliente → 12-month array.
  type Cli = { clave: string; nombre: string; razonSocial: string; meses: number[]; total: number };
  type Seg = { id: string; name: string; clientes: Map<string, Cli>; totalesMes: number[]; total: number };
  const segs = new Map<string, Seg>();
  const grandMes = new Array(12).fill(0);
  let grandTotal = 0;

  for (const r of data || []) {
    const m = Number(String(r.periodo).slice(5, 7)) - 1; // 0..11
    if (m < 0 || m > 11) continue;
    const imp = Number(r.importe) || 0;
    const segId = String(r.segmento_id || "—");
    let seg = segs.get(segId);
    if (!seg) {
      seg = { id: segId, name: String(r.segmento_nombre || segId), clientes: new Map(), totalesMes: new Array(12).fill(0), total: 0 };
      segs.set(segId, seg);
    }
    const cliId = String(r.cliente_id);
    let cli = seg.clientes.get(cliId);
    if (!cli) {
      cli = { clave: cliId, nombre: String(r.cliente_nombre || ""), razonSocial: String(r.razon_social || ""), meses: new Array(12).fill(0), total: 0 };
      seg.clientes.set(cliId, cli);
    }
    cli.meses[m] += imp;
    cli.total += imp;
    seg.totalesMes[m] += imp;
    seg.total += imp;
    grandMes[m] += imp;
    grandTotal += imp;
  }

  const segmentos = [...segs.values()]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((s) => ({
      id: s.id,
      name: s.name,
      total: s.total,
      totalesMes: s.totalesMes,
      clientes: [...s.clientes.values()].sort((a, b) => b.total - a.total),
    }));

  res.json({
    vendedor: { id: vendedor },
    anio,
    segmentos,
    totalesMes: grandMes,
    total: grandTotal,
    clientesConVenta: segmentos.reduce((n, s) => n + s.clientes.length, 0),
  });
});

export default router;
