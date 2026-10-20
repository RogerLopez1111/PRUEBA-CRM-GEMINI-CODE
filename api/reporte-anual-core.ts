import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Shared builder for the "REPORTE ANALÍTICO DE VENTAS ANUAL (CLIENTE)" matrix,
 * read from the materialized mirror table erp_ventas_cliente_mensual (populated
 * by the ERP sync). Used by both the ?erp-test route and the authed Performance
 * endpoint so the two can never drift apart.
 */

export type ReporteRow = {
  segmento_id: string;
  segmento_nombre: string;
  cliente_id: string;
  cliente_nombre: string;
  razon_social: string;
  periodo: string; // 'YYYY-MM'
  importe: number;
};

export type ReporteCliente = { clave: string; nombre: string; razonSocial: string; meses: number[]; total: number };
export type ReporteSegmento = { id: string; name: string; clientes: ReporteCliente[]; totalesMes: number[]; total: number };
export type ReporteAnual = {
  segmentos: ReporteSegmento[];
  totalesMes: number[];
  total: number;
  clientesConVenta: number;
};

const REPORTE_COLS =
  "segmento_id, segmento_nombre, cliente_id, cliente_nombre, razon_social, periodo, importe";

// A big seller's year can exceed Supabase's 1000-row cap, so page until a short page.
export async function fetchReporteAnualRows(
  supabase: SupabaseClient,
  vendedor: string,
  anio: string
): Promise<ReporteRow[]> {
  const PAGE = 1000;
  const rows: ReporteRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("erp_ventas_cliente_mensual")
      .select(REPORTE_COLS)
      .eq("vendedor_id", vendedor)
      .gte("periodo", `${anio}-01`)
      .lte("periodo", `${anio}-12`)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    rows.push(...(data as ReporteRow[]));
    if (data.length < PAGE) break;
  }
  return rows;
}

// Group flat (cliente, periodo) rows into segmento → cliente → 12-month arrays.
export function groupReporteAnual(rows: ReporteRow[]): ReporteAnual {
  type SegAcc = { id: string; name: string; clientes: Map<string, ReporteCliente>; totalesMes: number[]; total: number };
  const segs = new Map<string, SegAcc>();
  const grandMes = new Array(12).fill(0);
  let grandTotal = 0;

  for (const r of rows) {
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

  const segmentos: ReporteSegmento[] = [...segs.values()]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((s) => ({
      id: s.id,
      name: s.name,
      total: s.total,
      totalesMes: s.totalesMes,
      clientes: [...s.clientes.values()].sort((a, b) => b.total - a.total),
    }));

  return {
    segmentos,
    totalesMes: grandMes,
    total: grandTotal,
    clientesConVenta: segmentos.reduce((n, s) => n + s.clientes.length, 0),
  };
}
