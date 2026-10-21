import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Daily-grain twin of rentabilidad-core.ts, read from the mirror table
 * erp_rentabilidad_vendedor_diario (populated by the ERP sync over a rolling
 * window). Net profitability per day is derived with the SAME formulas as the
 * monthly report:
 *   importeNeto = venta_importe - dev_importe - boni_importe
 *   costoNeto   = venta_costo   - dev_costo
 *   utilidad    = importeNeto   - costoNeto
 *   rentabilidad = importeNeto ? utilidad / importeNeto : 0
 */

export type RentabilidadDiarioRow = {
  vendedor_id: string;
  vendedor_nombre: string;
  fecha: string; // 'YYYY-MM-DD'
  venta_importe: number;
  venta_costo: number;
  dev_importe: number;
  dev_costo: number;
  boni_importe: number;
};

export type CeldaDia = {
  fecha: string;
  importe: number;
  costo: number;
  utilidad: number;
  rentabilidad: number;
};
export type Celda = { importe: number; costo: number; utilidad: number; rentabilidad: number };
export type RentabilidadDiaria = {
  dias: CeldaDia[];
  total: Celda;
  vendedores: { id: string; nombre: string }[]; // for the filter dropdown
};

const COLS =
  "vendedor_id, vendedor_nombre, fecha, venta_importe, venta_costo, dev_importe, dev_costo, boni_importe";

// First day of the month after `mes` ('YYYY-MM') — the exclusive upper bound.
function nextMonthStart(mes: string): string {
  const y = Number(mes.slice(0, 4));
  const m = Number(mes.slice(5, 7)); // 1..12
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return `${ny}-${String(nm).padStart(2, "0")}-01`;
}

// All daily rows for one month ('YYYY-MM'). Paginate past Supabase's 1000-row cap
// (a busy month across all vendedores can exceed it).
export async function fetchRentabilidadDiarioRows(
  supabase: SupabaseClient,
  mes: string
): Promise<RentabilidadDiarioRow[]> {
  const desde = `${mes}-01`;
  const hasta = nextMonthStart(mes); // exclusive
  const PAGE = 1000;
  const rows: RentabilidadDiarioRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("erp_rentabilidad_vendedor_diario")
      .select(COLS)
      .gte("fecha", desde)
      .lt("fecha", hasta)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    rows.push(...(data as RentabilidadDiarioRow[]));
    if (data.length < PAGE) break;
  }
  return rows;
}

// All daily rows in an inclusive [desde, hasta] date range (both 'YYYY-MM-DD').
// Used by the authed Actividad Global dashboard (ventas/utilidad del día).
export async function fetchRentabilidadDiarioRange(
  supabase: SupabaseClient,
  desde: string,
  hasta: string
): Promise<RentabilidadDiarioRow[]> {
  const PAGE = 1000;
  const rows: RentabilidadDiarioRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("erp_rentabilidad_vendedor_diario")
      .select(COLS)
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    rows.push(...(data as RentabilidadDiarioRow[]));
    if (data.length < PAGE) break;
  }
  return rows;
}

function seal<T extends Celda>(c: T): T {
  c.utilidad = c.importe - c.costo;
  c.rentabilidad = c.importe !== 0 ? c.utilidad / c.importe : 0;
  return c;
}

// Collapse (vendedor, día) rows into one net cell per day. `vendedorId` (optional)
// restricts the totals to a single seller; the `vendedores` list is always the
// full distinct set for the month so the dropdown stays complete.
export function groupRentabilidadDiaria(
  rows: RentabilidadDiarioRow[],
  vendedorId?: string
): RentabilidadDiaria {
  const vendedores = new Map<string, string>();
  for (const r of rows) vendedores.set(String(r.vendedor_id), String(r.vendedor_nombre || r.vendedor_id));

  const byDay = new Map<string, CeldaDia>();
  const total: Celda = { importe: 0, costo: 0, utilidad: 0, rentabilidad: 0 };

  for (const r of rows) {
    if (vendedorId && String(r.vendedor_id) !== vendedorId) continue;
    const importe =
      (Number(r.venta_importe) || 0) - (Number(r.dev_importe) || 0) - (Number(r.boni_importe) || 0);
    const costo = (Number(r.venta_costo) || 0) - (Number(r.dev_costo) || 0);

    const fecha = String(r.fecha).slice(0, 10);
    let d = byDay.get(fecha);
    if (!d) {
      d = { fecha, importe: 0, costo: 0, utilidad: 0, rentabilidad: 0 };
      byDay.set(fecha, d);
    }
    d.importe += importe;
    d.costo += costo;
    total.importe += importe;
    total.costo += costo;
  }

  const dias = [...byDay.values()].sort((a, b) => a.fecha.localeCompare(b.fecha)).map(seal);
  seal(total);

  return {
    dias,
    total,
    vendedores: [...vendedores.entries()]
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre)),
  };
}
