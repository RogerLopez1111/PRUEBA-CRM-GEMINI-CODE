/**
 * Admin "Carga de Trabajo" insights — per-vendedor stats and the stuck-leads
 * intervention pile. Filters come from the screen's filter row.
 *
 * Origin filters (clientInitiated / mostrador) intersect with the other
 * filters; estado is intentionally not used here (workload is about active
 * and stuck leads, not arbitrary statuses).
 */
import { useMemo } from "react";
import { useAppData } from "../../state/AppDataContext";
import { getStuckLevel } from "../../lib/helpers";
import type { Lead, LeadStatus, User } from "../../types";

export interface WorkloadFilterState {
  vendedor: string;             // "all" | "unassigned" | vendedor id
  sucursal: string;             // "all" or sucursal name
  search: string;
  clientInitiated: boolean;
  mostrador: boolean;
  newClient: boolean;
}

export interface WorkloadStat {
  user: User;
  sucursalName: string;
  activeLeads: number;
  pipelineValue: number;
  stuckCount: number;
  closedThisMonth: number;
  convPct: number;
}

export interface WorkloadInsights {
  stats: WorkloadStat[];
  teamAvgConv: number;
  stuckLeads: Lead[];
}

const isActive = (s: LeadStatus) => s !== "FACTURADO" && s !== "ENTREGADO" && s !== "RECHAZADO";
const isClosed = (s: LeadStatus) => s === "FACTURADO" || s === "ENTREGADO";
const rank = (lvl: string) => (lvl === "critical" ? 0 : lvl === "warning" ? 1 : 2);

export function useWorkloadInsights(filter: WorkloadFilterState): WorkloadInsights {
  const { leads, users, sucursales } = useAppData();

  return useMemo<WorkloadInsights>(() => {
    const now = new Date();
    const currYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const sucursalIdFilter: string | null =
      filter.sucursal === "all"
        ? null
        : sucursales.find((s) => s.name === filter.sucursal)?.id || null;
    const vendedorIdFilter: string | null =
      filter.vendedor !== "all" && filter.vendedor !== "unassigned" ? filter.vendedor : null;
    const q = filter.search.trim().toLowerCase();

    const matchUserSearch = (u: User) => !q || u.name.toLowerCase().includes(q);

    const filteredUsers: User[] = users.filter((u) => {
      if (sucursalIdFilter && u.sucursalId !== sucursalIdFilter) return false;
      if (vendedorIdFilter && u.id !== vendedorIdFilter) return false;
      if (!matchUserSearch(u)) return false;
      return true;
    });

    const matchesOrigin = (l: Lead) => {
      if (filter.clientInitiated && !l.clientInitiated) return false;
      if (filter.mostrador && !l.mostrador) return false;
      if (filter.newClient && !l.newClient) return false;
      return true;
    };

    const stats: WorkloadStat[] = filteredUsers
      .map((u) => {
        const userLeads = leads.filter((l) => l.assignedTo === u.id && matchesOrigin(l));
        const activeLeads = userLeads.filter((l) => isActive(l.status));
        const pipelineValue = activeLeads.reduce((acc, l) => acc + (l.value || 0), 0);
        const stuckCount = activeLeads.filter((l) => getStuckLevel(l.updatedAt) !== "normal").length;
        const closedThisMonth = userLeads.filter((l) => {
          if (!isClosed(l.status)) return false;
          const d = new Date(l.updatedAt);
          if (isNaN(d.getTime())) return false;
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === currYm;
        }).length;
        const closedTotal = userLeads.filter((l) => isClosed(l.status)).length;
        const convPct = userLeads.length ? Math.round((closedTotal / userLeads.length) * 100) : 0;
        return {
          user: u,
          sucursalName: sucursales.find((s) => s.id === u.sucursalId)?.name || "—",
          activeLeads: activeLeads.length,
          pipelineValue,
          stuckCount,
          closedThisMonth,
          convPct,
        };
      })
      .sort((a, b) => b.activeLeads - a.activeLeads || b.pipelineValue - a.pipelineValue);

    const teamAvgConv = stats.length
      ? Math.round(stats.reduce((acc, x) => acc + x.convPct, 0) / stats.length)
      : 0;

    const stuckLeads: Lead[] = leads
      .filter((l) => {
        if (!isActive(l.status)) return false;
        if (getStuckLevel(l.updatedAt) === "normal") return false;
        if (vendedorIdFilter && l.assignedTo !== vendedorIdFilter) return false;
        if (filter.vendedor === "unassigned" && l.assignedTo) return false;
        if (sucursalIdFilter) {
          const owner = users.find((u) => u.id === l.assignedTo);
          if (!owner || owner.sucursalId !== sucursalIdFilter) return false;
        }
        if (q && !l.name.toLowerCase().includes(q) && !l.company.toLowerCase().includes(q)) return false;
        if (!matchesOrigin(l)) return false;
        return true;
      })
      .sort((a, b) => {
        const la = getStuckLevel(a.updatedAt);
        const lb = getStuckLevel(b.updatedAt);
        if (rank(la) !== rank(lb)) return rank(la) - rank(lb);
        return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      });

    return { stats, teamAvgConv, stuckLeads };
  }, [
    leads, users, sucursales,
    filter.vendedor, filter.sucursal, filter.search, filter.clientInitiated, filter.mostrador, filter.newClient,
  ]);
}
