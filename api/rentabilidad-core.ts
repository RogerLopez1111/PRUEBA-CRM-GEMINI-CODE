import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Shared builder for the "REPORTE DE RENTABILIDAD" (por Vendedor) matrix, read
 * from the materialized mirror table erp_rentabilidad_vendedor_mensual (populated
 * by the ERP sync). Used by both the ?erp-test route and the authed Performance
 * endpoint so the two can never drift apart.
 *
 * Net profitability per (vendedor, mes) is derived exactly like ManagementPro
 * RPVNA06 chains it for the Vendedor grouping:
 *   importeNeto = venta_importe - dev_importe - boni_importe
 *   costoNeto   = venta_costo   - dev_costo
 *   utilidad    = importeNeto   - costoNeto
 *   rentabilidad = importeNeto ? utilidad / importeNeto : 0
 */

export type RentabilidadRow = {
  vendedor_id: string;
  vendedor_nombre: string;
  periodo: string; // 'YYYY-MM'
  venta_importe: number;
  venta_costo: number;
  dev_importe: number;
  dev_costo: number;
  boni_importe: number;
};

// A single (vendedor, mes) or an aggregated total cell.
export type Celda = { importe: number; costo: number; utilidad: number; rentabilidad: number };
export type RentabilidadVendedor = { id: string; nombre: string; meses: Celda[]; total: Celda };
export type RentabilidadAnual = {
  vendedores: RentabilidadVendedor[];
  totalesMes: Celda[];
  total: Celda;
  vendedoresConVenta: number;
};

const RENTAB_COLS =
  "vendedor_id, vendedor_nombre, periodo, venta_importe, venta_costo, dev_importe, dev_costo, boni_importe";

// A full year across all vendedores can exceed Supabase's 1000-row cap, so page
// until a short page.
export async function fetchRentabilidadRows(
  supabase: SupabaseClient,
  anio: string
): Promise<RentabilidadRow[]> {
  const PAGE = 1000;
  const rows: RentabilidadRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("erp_rentabilidad_vendedor_mensual")
      .select(RENTAB_COLS)
      .gte("periodo", `${anio}-01`)
      .lte("periodo", `${anio}-12`)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    rows.push(...(data as RentabilidadRow[]));
    if (data.length < PAGE) break;
  }
  return rows;
}

const emptyCell = (): Celda => ({ importe: 0, costo: 0, utilidad: 0, rentabilidad: 0 });

// Finalize a cell's derived fields from its accumulated net importe/costo.
function seal(c: Celda): Celda {
  c.utilidad = c.importe - c.costo;
  c.rentabilidad = c.importe !== 0 ? c.utilidad / c.importe : 0;
  return c;
}

// Group flat (vendedor, periodo) rows into vendedor → 12-month cells, netting
// devoluciones/rechazos and bonificaciones exactly as the ERP does.
export function groupRentabilidadAnual(rows: RentabilidadRow[]): RentabilidadAnual {
  type Acc = { id: string; nombre: string; meses: Celda[]; total: Celda };
  const vends = new Map<string, Acc>();
  const grandMes: Celda[] = Array.from({ length: 12 }, emptyCell);
  const grandTotal = emptyCell();

  for (const r of rows) {
    const m = Number(String(r.periodo).slice(5, 7)) - 1; // 0..11
    if (m < 0 || m > 11) continue;

    // Net importe/costo for this (vendedor, mes).
    const importe = (Number(r.venta_importe) || 0) - (Number(r.dev_importe) || 0) - (Number(r.boni_importe) || 0);
    const costo = (Number(r.venta_costo) || 0) - (Number(r.dev_costo) || 0);

    const vid = String(r.vendedor_id);
    let v = vends.get(vid);
    if (!v) {
      v = { id: vid, nombre: String(r.vendedor_nombre || vid), meses: Array.from({ length: 12 }, emptyCell), total: emptyCell() };
      vends.set(vid, v);
    }
    // Keep the freshest non-empty name.
    if (r.vendedor_nombre) v.nombre = String(r.vendedor_nombre);

    v.meses[m].importe += importe;
    v.meses[m].costo += costo;
    v.total.importe += importe;
    v.total.costo += costo;

    grandMes[m].importe += importe;
    grandMes[m].costo += costo;
    grandTotal.importe += importe;
    grandTotal.costo += costo;
  }

  // Seal every derived field (utilidad / % rentabilidad) once sums are final.
  const vendedores: RentabilidadVendedor[] = [...vends.values()]
    .map((v) => {
      v.meses.forEach(seal);
      seal(v.total);
      return v;
    })
    .sort((a, b) => b.total.utilidad - a.total.utilidad);

  grandMes.forEach(seal);
  seal(grandTotal);

  return {
    vendedores,
    totalesMes: grandMes,
    total: grandTotal,
    vendedoresConVenta: vendedores.length,
  };
}
