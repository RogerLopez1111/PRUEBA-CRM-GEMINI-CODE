/**
 * Pure helpers used across the CRM. Module-scope, no React, no side effects.
 * Moved here from App.tsx during Phase 1 of the file split.
 */

import type { Lead, LeadStatus } from "../types";

export const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// CRM-only client IDs are random alphanumeric (created in the new-lead flow);
// ERP clients have all-numeric ids.
export const isCrmClientId = (id: string | undefined | null) =>
  !!id && !/^\d+$/.test(id);

// For a list of leads belonging to one seller, returns Map<"YYYY-MM", count>
// of brand-new clients the seller brought on. Attribution is anchored to the
// lead.newClient flag (Cl_New_Client_CRM) — set true when the lead was created
// against a brand-new prospect — so credit survives the ERP re-point that
// happens on FACTURADO. The clientId itself can flip from CRM-alphanumeric to
// ERP-numeric, which would otherwise erase historical credit.
export function newClientsByMonth(sellerLeads: Lead[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const l of sellerLeads) {
    if (!l.newClient) continue;
    const d = new Date(l.createdAt);
    if (isNaN(d.getTime())) continue;
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    counts.set(ym, (counts.get(ym) || 0) + 1);
  }
  return counts;
}

// Subset of newClientsByMonth: brand-new-client leads that actually reached
// FACTURADO (or downstream ENTREGADO). Bucketed by createdAt so the count is
// directly comparable to newClientsByMonth for a conversion rate.
export function newClientsConvertedByMonth(sellerLeads: Lead[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const l of sellerLeads) {
    if (!l.newClient) continue;
    if (l.status !== "FACTURADO" && l.status !== "ENTREGADO") continue;
    const d = new Date(l.createdAt);
    if (isNaN(d.getTime())) continue;
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    counts.set(ym, (counts.get(ym) || 0) + 1);
  }
  return counts;
}

export const currentYearMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

// The month ('YYYY-MM') a lead REACHED a given stage — the timestamp of its last
// history entry with that status. Lets a metric count in the month its event
// happened (quoted / facturado), no matter when the lead was created. Falls back
// to createdAt for legacy/edge rows that are in the stage yet never recorded the
// transition, so a real quote/sale is never silently dropped from the totals.
export function stageMonth(lead: Lead, status: LeadStatus): string | null {
  const entry = [...lead.history].reverse().find(h => h.status === status);
  const iso = entry?.timestamp ?? lead.createdAt;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// The month ('YYYY-MM') a lead was INVOICED in — when its sale should count.
export const facturadoMonth = (lead: Lead) => stageMonth(lead, "FACTURADO");

// Leads whose sale landed in a given month ('YYYY-MM'), bucketed by facturación
// date (NOT lead creation date). A lead counts as sold once it reaches FACTURADO
// or the downstream ENTREGADO state.
export function soldLeadsInMonth(leads: Lead[], ym: string): Lead[] {
  return leads.filter(l =>
    (l.status === "FACTURADO" || l.status === "ENTREGADO") && facturadoMonth(l) === ym
  );
}

// Active quotes bucketed by the month the lead reached the COTIZADO stage (NOT
// lead creation date). Still restricted to leads currently in COTIZADO, so the
// "cotizaciones activas" count stays accurate — only the month bucket changes.
export function quotedLeadsInMonth(leads: Lead[], ym: string): Lead[] {
  return leads.filter(l => l.status === "COTIZADO" && stageMonth(l, "COTIZADO") === ym);
}

export const getTimeStuck = (updatedAt: string) => {
  const lastUpdate = new Date(updatedAt).getTime();
  const now = new Date().getTime();
  const diffInMs = now - lastUpdate;
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays > 0) return `${diffInDays}d ${diffInHours % 24}h`;
  if (diffInHours > 0) return `${diffInHours}h`;
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  return `${diffInMinutes}m`;
};

export const getStuckLevel = (updatedAt: string) => {
  const lastUpdate = new Date(updatedAt).getTime();
  const now = new Date().getTime();
  const diffInHours = (now - lastUpdate) / (1000 * 60 * 60);
  if (diffInHours > 72) return "critical";
  if (diffInHours > 24) return "warning";
  return "normal";
};

// The true "last activity" of a lead: the most recent of its creation, its
// Cl_UpdatedAt_CRM, and EVERY history entry's timestamp. `updatedAt` alone is
// unreliable for staleness — it doesn't move for every stage movement / comment
// path, so a lead that was actually worked still looks stuck. Any history row
// (a stage move, a note, evidence) counts as a genuine update. Use this instead
// of `updatedAt` wherever "sin actualizar" / stuck is measured.
export const getLeadLastActivity = (lead: Lead): string => {
  let latest = lead.createdAt;
  let latestMs = new Date(lead.createdAt).getTime();
  if (isNaN(latestMs)) latestMs = 0;
  const consider = (ts?: string) => {
    if (!ts) return;
    const ms = new Date(ts).getTime();
    if (!isNaN(ms) && ms > latestMs) { latestMs = ms; latest = ts; }
  };
  consider(lead.updatedAt);
  for (const h of lead.history || []) consider(h.timestamp);
  return latest;
};

// Median days between the first ASIGNADO and the first CONTACTADO history entry.
export function timeToFirstContact(leads: Lead[]): { median: number | null; count: number } {
  const days: number[] = [];
  for (const l of leads) {
    const asig = l.history.find(h => h.status === "ASIGNADO");
    const cont = l.history.find(h => h.status === "CONTACTADO");
    if (!asig || !cont) continue;
    const diff = (new Date(cont.timestamp).getTime() - new Date(asig.timestamp).getTime()) / (1000 * 60 * 60 * 24);
    if (isFinite(diff) && diff >= 0) days.push(diff);
  }
  if (days.length === 0) return { median: null, count: 0 };
  const sorted = [...days].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  return { median, count: sorted.length };
}

// Pareto of rechazo motivos for a set of leads — lost value (pesos) drives the order.
export function rechazoMotivosPareto(leads: Lead[]): { name: string; count: number; lostValue: number }[] {
  const map = new Map<string, { count: number; lostValue: number }>();
  for (const l of leads) {
    if (l.status !== "RECHAZADO") continue;
    const lastRej = [...l.history].reverse().find(h => h.status === "RECHAZADO");
    const motivo = lastRej?.rechazoMotivo || "Sin motivo";
    const ex = map.get(motivo) || { count: 0, lostValue: 0 };
    ex.count += 1;
    ex.lostValue += l.value || 0;
    map.set(motivo, ex);
  }
  return [...map.entries()]
    .map(([name, v]) => ({ name, count: v.count, lostValue: v.lostValue }))
    .sort((a, b) => b.lostValue - a.lostValue || b.count - a.count);
}

// Stage-by-stage funnel. For each lead, the deepest stage it ever touched
// (via current status or any history entry) counts toward every prior stage.
// RECHAZADO is treated as a terminal off-funnel state, not a stage.
export const FUNNEL_STAGES: LeadStatus[] = ["ASIGNADO", "CONTACTADO", "NEGOCIACION", "COTIZADO", "FACTURADO", "ENTREGADO"];

export function funnelByStage(leads: Lead[]): { stage: LeadStatus; count: number; pctOfTop: number; stepConversion: number | null }[] {
  const counts: Record<string, number> = {};
  for (const s of FUNNEL_STAGES) counts[s] = 0;
  for (const l of leads) {
    let deepest = -1;
    for (const h of l.history) {
      const i = FUNNEL_STAGES.indexOf(h.status as LeadStatus);
      if (i > deepest) deepest = i;
    }
    const cur = FUNNEL_STAGES.indexOf(l.status as LeadStatus);
    if (cur > deepest) deepest = cur;
    if (deepest < 0) continue;
    for (let i = 0; i <= deepest; i++) counts[FUNNEL_STAGES[i]] += 1;
  }
  const top = counts[FUNNEL_STAGES[0]] || 1;
  return FUNNEL_STAGES.map((stage, idx) => {
    const prev = idx === 0 ? null : counts[FUNNEL_STAGES[idx - 1]];
    const stepConversion = prev && prev > 0 ? (counts[stage] / prev) * 100 : (idx === 0 ? null : null);
    return {
      stage,
      count: counts[stage],
      pctOfTop: top > 0 ? (counts[stage] / top) * 100 : 0,
      stepConversion,
    };
  });
}

export const formatDays = (d: number) => {
  if (d < 1) {
    const hours = Math.round(d * 24);
    return `${hours}h`;
  }
  if (d < 10) return `${d.toFixed(1)}d`;
  return `${Math.round(d)}d`;
};
