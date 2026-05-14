/**
 * Memoized derivations for the Pedidos Extraordinarios screen.
 * Takes the user-controlled filter state as input; returns the month-options
 * list, filtered pedidos, and the KPI rollup (pendientes, aprobado/rechazado
 * counts, valor aprobado del mes, % aprobación, tiempo promedio de resolución).
 */
import { useMemo } from "react";
import { useAppData } from "../../state/AppDataContext";
import type { PedidoExtraordinario, PedidoExtraordinarioEstado } from "../../types";

export interface PedidosRollup {
  pendientes: number;
  aprobados: number;
  rechazados: number;
  valorAprobadoMes: number;
  valorPendienteTotal: number;
  aprobacionPct: number;
  tiempoPromedioDias: number | null;
}

export interface PedidosFilterState {
  sucursal: string;       // "all" or sucursal name
  month: string;          // "all" or "YYYY-MM"
  estado: "all" | PedidoExtraordinarioEstado;
}

export function usePedidosRollup(filter: PedidosFilterState) {
  const { pedidos, currentUser } = useAppData();

  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    const now = new Date();
    set.add(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
    for (const p of pedidos) {
      const d = new Date(p.createdAt);
      if (!isNaN(d.getTime())) {
        set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      }
    }
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [pedidos]);

  const filtered = useMemo<PedidoExtraordinario[]>(() => {
    return pedidos.filter((p) => {
      if (currentUser?.role === "Seller" && p.vendedorId !== currentUser.id) return false;
      if (filter.estado !== "all" && p.estado !== filter.estado) return false;
      if (filter.sucursal !== "all" && p.sucursalName !== filter.sucursal) return false;
      if (filter.month !== "all") {
        const d = new Date(p.createdAt);
        if (isNaN(d.getTime())) return false;
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (ym !== filter.month) return false;
      }
      return true;
    });
  }, [pedidos, currentUser, filter.estado, filter.sucursal, filter.month]);

  const rollup = useMemo<PedidosRollup>(() => {
    const now = new Date();
    const currYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    let pendientes = 0;
    let aprobados = 0;
    let rechazados = 0;
    let valorAprobadoMes = 0;
    let valorPendienteTotal = 0;
    const resolutionDays: number[] = [];

    for (const p of filtered) {
      if (p.estado === "solicitado") {
        pendientes += 1;
        valorPendienteTotal += p.valorEstimado || 0;
      }
      if (p.estado === "aprobado") {
        aprobados += 1;
        if (p.resueltoAt) {
          const d = new Date(p.resueltoAt);
          if (!isNaN(d.getTime()) && `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === currYm) {
            valorAprobadoMes += p.valorEstimado || 0;
          }
        }
      }
      if (p.estado === "rechazado") rechazados += 1;
      if (p.resueltoAt && (p.estado === "aprobado" || p.estado === "rechazado")) {
        const ms = new Date(p.resueltoAt).getTime() - new Date(p.createdAt).getTime();
        if (!isNaN(ms) && ms >= 0) resolutionDays.push(ms / (1000 * 60 * 60 * 24));
      }
    }

    const aprobadosMasRechazados = aprobados + rechazados;
    const aprobacionPct = aprobadosMasRechazados
      ? Math.round((aprobados / aprobadosMasRechazados) * 100)
      : 0;
    const tiempoPromedioDias = resolutionDays.length
      ? Math.round((resolutionDays.reduce((a, b) => a + b, 0) / resolutionDays.length) * 10) / 10
      : null;

    return { pendientes, aprobados, rechazados, valorAprobadoMes, valorPendienteTotal, aprobacionPct, tiempoPromedioDias };
  }, [filtered]);

  return { monthOptions, filtered, rollup };
}
