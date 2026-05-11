/**
 * Memoized derivations for the Faltantes screen.
 *
 * Takes the user-controlled filter state as input; returns the month-options
 * list, filtered faltantes, and the admin rollup (top productos, por sucursal,
 * cobertura del catálogo, recurrencia crónica, clientes más afectados,
 * productos nuevos del mes).
 */
import { useMemo } from "react";
import { useAppData } from "../../state/AppDataContext";
import { MESES } from "../../lib/helpers";
import type { ProductoFaltante } from "../../types";

export interface FaltantesFilterState {
  sucursal: string;                        // "all" or sucursal name
  month: string;                           // "all" or "YYYY-MM"
  estado: "all" | "pendiente" | "resuelto";
}

export interface TopProduct {
  name: string;
  productoId: string | null;
  incidentes: number;
  cantidad: number;
  sucursales: Set<string>;
}

export interface BySucursalRow {
  name: string;
  incidentes: number;
  topProduct: string | null;
  topProductCount: number;
}

export interface TopClienteRow {
  id: string;
  name: string;
  incidentes: number;
  cantidad: number;
}

export interface RecurrenteRow {
  key: string;
  name: string;
  productoId: string | null;
  meses: number;
}

export interface ProductoNuevoRow {
  key: string;
  name: string;
  productoId: string | null;
  cantidad: number;
  incidentes: number;
}

export interface FaltantesRollup {
  topProducts: TopProduct[];
  bySucursal: BySucursalRow[];
  totalIncidentes: number;
  freeTextPct: number;
  freeTextCount: number;
  topClientes: TopClienteRow[];
  currLabel: string;
  recurrentes: RecurrenteRow[];
  productosNuevos: ProductoNuevoRow[];
}

export function useFaltantesRollup(filter: FaltantesFilterState) {
  const { faltantes, currentUser } = useAppData();

  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    const now = new Date();
    set.add(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
    for (const f of faltantes) {
      const d = new Date(f.createdAt);
      if (!isNaN(d.getTime())) {
        set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      }
    }
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [faltantes]);

  const filtered = useMemo<ProductoFaltante[]>(() => {
    return faltantes.filter((f) => {
      if (currentUser?.role === "Seller" && f.vendedorId !== currentUser.id) return false;
      if (filter.estado !== "all" && f.estado !== filter.estado) return false;
      if (filter.sucursal !== "all" && f.sucursalName !== filter.sucursal) return false;
      if (filter.month !== "all") {
        const d = new Date(f.createdAt);
        if (isNaN(d.getTime())) return false;
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (ym !== filter.month) return false;
      }
      return true;
    });
  }, [faltantes, currentUser, filter.estado, filter.sucursal, filter.month]);

  // Admin rollup — derived from the same filtered set so the rollup and the
  // list always agree. Cross-month metrics (recurrencia, productos nuevos del
  // mes actual) ignore the month filter and only respect role + sucursal
  // scoping so they stay meaningful regardless of which month the admin is
  // inspecting.
  const rollup = useMemo<FaltantesRollup>(() => {
    type ProductAgg = { name: string; productoId: string | null; incidentes: number; cantidad: number; sucursales: Set<string> };
    const productAgg = new Map<string, ProductAgg>();
    const sucursalAgg = new Map<string, { incidentes: number; products: Map<string, number> }>();
    const clienteAgg = new Map<string, { name: string; incidentes: number; cantidad: number }>();
    let freeTextCount = 0;

    for (const f of filtered) {
      const productKey = f.productoId || `__free:${f.productoDescripcion.toLowerCase().trim()}`;
      const productName = f.productoDescripcion;
      const p = productAgg.get(productKey) || { name: productName, productoId: f.productoId ?? null, incidentes: 0, cantidad: 0, sucursales: new Set<string>() };
      p.incidentes += 1;
      p.cantidad += Number(f.cantidad) || 0;
      if (f.sucursalName) p.sucursales.add(f.sucursalName);
      productAgg.set(productKey, p);

      if (f.sucursalName) {
        const s = sucursalAgg.get(f.sucursalName) || { incidentes: 0, products: new Map<string, number>() };
        s.incidentes += 1;
        s.products.set(productName, (s.products.get(productName) || 0) + 1);
        sucursalAgg.set(f.sucursalName, s);
      }

      if (!f.productoId) freeTextCount += 1;

      if (f.clienteId && f.clienteName) {
        const c = clienteAgg.get(f.clienteId) || { name: f.clienteName, incidentes: 0, cantidad: 0 };
        c.incidentes += 1;
        c.cantidad += Number(f.cantidad) || 0;
        clienteAgg.set(f.clienteId, c);
      }
    }

    const topProducts: TopProduct[] = [...productAgg.values()]
      .sort((a, b) => b.incidentes - a.incidentes || b.cantidad - a.cantidad)
      .slice(0, 10);

    const bySucursal: BySucursalRow[] = [...sucursalAgg.entries()]
      .map(([name, v]) => {
        const top = [...v.products.entries()].sort((a, b) => b[1] - a[1])[0];
        return { name, incidentes: v.incidentes, topProduct: top ? top[0] : null, topProductCount: top ? top[1] : 0 };
      })
      .sort((a, b) => b.incidentes - a.incidentes);

    const topClientes: TopClienteRow[] = [...clienteAgg.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.incidentes - a.incidentes || b.cantidad - a.cantidad)
      .slice(0, 8);

    const totalIncidentes = filtered.length;
    const freeTextPct = totalIncidentes ? Math.round((freeTextCount / totalIncidentes) * 100) : 0;

    // Cross-month subset for recurrencia & productos-nuevos — month filter not applied.
    const norm = (v?: string) => (v || "").trim();
    const crossScopeBase = faltantes.filter((f) => {
      if (currentUser?.role === "Seller" && f.vendedorId !== currentUser.id) return false;
      if (filter.sucursal !== "all" && f.sucursalName !== filter.sucursal) return false;
      return true;
    });

    const now = new Date();
    const currYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const currLabel = `${MESES[now.getMonth()].slice(0, 3)} ${String(now.getFullYear()).slice(2)}`;

    const productMonthSet = new Map<string, Set<string>>();
    const productFirstSeen = new Map<string, string>();
    const productNamesXM = new Map<string, string>();
    const productIdsXM = new Map<string, string | null>();
    const productCantidadCurrMonth = new Map<string, number>();
    const productIncidentesCurrMonth = new Map<string, number>();

    for (const f of crossScopeBase) {
      const d = new Date(f.createdAt);
      if (isNaN(d.getTime())) continue;
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

      const key = f.productoId || `__free:${norm(f.productoDescripcion).toLowerCase()}`;
      const set = productMonthSet.get(key) || new Set<string>();
      set.add(ym);
      productMonthSet.set(key, set);
      productNamesXM.set(key, f.productoDescripcion);
      productIdsXM.set(key, f.productoId ?? null);
      const earliest = productFirstSeen.get(key);
      if (!earliest || ym < earliest) productFirstSeen.set(key, ym);

      if (ym === currYm) {
        productCantidadCurrMonth.set(key, (productCantidadCurrMonth.get(key) || 0) + (Number(f.cantidad) || 0));
        productIncidentesCurrMonth.set(key, (productIncidentesCurrMonth.get(key) || 0) + 1);
      }
    }

    const recurrentes: RecurrenteRow[] = [...productMonthSet.entries()]
      .filter(([, months]) => months.size >= 3)
      .map(([key, months]) => ({
        key,
        name: productNamesXM.get(key) || key,
        productoId: productIdsXM.get(key) || null,
        meses: months.size,
      }))
      .sort((a, b) => b.meses - a.meses)
      .slice(0, 8);

    const productosNuevos: ProductoNuevoRow[] = [...productCantidadCurrMonth.keys()]
      .filter((key) => productFirstSeen.get(key) === currYm)
      .map((key) => ({
        key,
        name: productNamesXM.get(key) || key,
        productoId: productIdsXM.get(key) || null,
        cantidad: productCantidadCurrMonth.get(key) || 0,
        incidentes: productIncidentesCurrMonth.get(key) || 0,
      }))
      .sort((a, b) => b.incidentes - a.incidentes || b.cantidad - a.cantidad)
      .slice(0, 8);

    return {
      topProducts,
      bySucursal,
      totalIncidentes,
      freeTextPct,
      freeTextCount,
      topClientes,
      currLabel,
      recurrentes,
      productosNuevos,
    };
  }, [filtered, faltantes, currentUser, filter.sucursal]);

  return { monthOptions, filtered, rollup };
}
