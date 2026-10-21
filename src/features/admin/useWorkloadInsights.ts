/**
 * Admin "Carga de Trabajo" insights — per-vendedor stats and the stuck-leads
 * intervention pile. Filters come from the screen's filter row (period +
 * vendedor + sucursal).
 *
 * Staleness ("stuck") is measured from each lead's REAL last activity — the
 * newest of its history timestamps, not Cl_UpdatedAt_CRM, which doesn't move on
 * every stage movement / comment. See getLeadLastActivity.
 *
 * "Cerrados del mes" is bucketed by the month the sale landed (FACTURADO /
 * ENTREGADO invoice date), scoped to the period the screen is viewing.
 */
import { useMemo } from "react";
import { useAppData } from "../../state/AppDataContext";
import { getStuckLevel, getLeadLastActivity, facturadoMonth } from "../../lib/helpers";
import type { Lead, LeadStatus, User } from "../../types";

export interface WorkloadFilterState {
  vendedor: string;             // "all" | "unassigned" | vendedor id
  sucursal: string;             // "all" or sucursal name
  ym: string;                   // selected period, "YYYY-MM"
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
    const sucursalIdFilter: string | null =
      filter.sucursal === "all"
        ? null
        : sucursales.find((s) => s.name === filter.sucursal)?.id || null;
    const vendedorIdFilter: string | null =
      filter.vendedor !== "all" && filter.vendedor !== "unassigned" ? filter.vendedor : null;

    const filteredUsers: User[] = users.filter((u) => {
      if (sucursalIdFilter && u.sucursalId !== sucursalIdFilter) return false;
      if (vendedorIdFilter && u.id !== vendedorIdFilter) return false;
      return true;
    });

    const stats: WorkloadStat[] = filteredUsers
      .map((u) => {
        const userLeads = leads.filter((l) => l.assignedTo === u.id);
        const activeLeads = userLeads.filter((l) => isActive(l.status));
        const pipelineValue = activeLeads.reduce((acc, l) => acc + (l.value || 0), 0);
        const stuckCount = activeLeads.filter((l) => getStuckLevel(getLeadLastActivity(l)) !== "normal").length;
        // Cerrados del mes: bucketed by the month the sale was invoiced, scoped
        // to the period the screen is viewing (not "current month").
        const closedThisMonth = userLeads.filter(
          (l) => isClosed(l.status) && facturadoMonth(l) === filter.ym
        ).length;
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
        if (getStuckLevel(getLeadLastActivity(l)) === "normal") return false;
        if (vendedorIdFilter && l.assignedTo !== vendedorIdFilter) return false;
        if (filter.vendedor === "unassigned" && l.assignedTo) return false;
        if (sucursalIdFilter) {
          const owner = users.find((u) => u.id === l.assignedTo);
          if (!owner || owner.sucursalId !== sucursalIdFilter) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const la = getStuckLevel(getLeadLastActivity(a));
        const lb = getStuckLevel(getLeadLastActivity(b));
        if (rank(la) !== rank(lb)) return rank(la) - rank(lb);
        return new Date(getLeadLastActivity(a)).getTime() - new Date(getLeadLastActivity(b)).getTime();
      });

    return { stats, teamAvgConv, stuckLeads };
  }, [leads, users, sucursales, filter.vendedor, filter.sucursal, filter.ym]);
}
