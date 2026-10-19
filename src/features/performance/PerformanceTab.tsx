/**
 * Performance tab — team summary table (admin) and per-user scorecard with
 * pipeline distribution, rejection reasons, conversion funnel, time-to-first-
 * contact, Pareto of rechazo motivos, and monthly goals timeline.
 *
 * Owns its own vendedor filter and the goals-timeline fetch keyed to whichever
 * user is being viewed. Sellers see only their own card; admins default to the
 * team summary table and can click a row to drill into a single seller.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  TrendingUp, CheckCircle2, AlertCircle, UserCheck, BarChart3, FileText, Receipt, RefreshCw,
} from "lucide-react";
import { motion } from "motion/react";
import {
  PieChart, Pie, Cell, Legend,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

import { cn } from "@/lib/utils";
import {
  MESES,
  newClientsByMonth,
  newClientsConvertedByMonth,
  currentYearMonth,
  soldLeadsInMonth,
  quotedLeadsInMonth,
  timeToFirstContact,
  rechazoMotivosPareto,
  funnelByStage,
  formatDays,
} from "../../lib/helpers";
import { useAppData } from "../../state/AppDataContext";
import { apiFetch } from "../../lib/api";
import type { SalesGoal, User } from "../../types";

const STAGE_COLOR: Record<string, string> = {
  ASIGNADO: "bg-slate-400",
  CONTACTADO: "bg-blue-500",
  NEGOCIACION: "bg-purple-500",
  COTIZADO: "bg-orange-500",
  FACTURADO: "bg-indigo-500",
  ENTREGADO: "bg-emerald-500",
};

const GOAL_MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// ERP "general sales" stream — total ventas invoiced per vendedor for the month,
// pulled live from the ERP (not mirrored). Kept visually SEPARATE from the
// leads/pipeline numbers so the two are never conflated.
type ErpVentasRow = { count: number; subtotal: number; total: number; error?: string };
type ErpVentas = {
  available: boolean;
  byVendedor: Record<string, ErpVentasRow>;
  grand: { count: number; subtotal: number; total: number };
  fromDevice?: boolean; // true when served from the browser's local cache (ERP unreachable)
  savedAt?: string; // ISO timestamp of the last successful pull saved on THIS device
};

// Local datetime for a cached-pull timestamp.
function formatFetched(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

// --- Device (browser) persistence -------------------------------------------
// The ERP is LAN-only, so the live pull works only inside the office. We save
// each successful pull in localStorage ON THE DEVICE, keyed by user + month, so
// when the user leaves the LAN the fields still show the last-known numbers with
// a "last pulled" timestamp instead of going empty.
type DeviceCache = { byVendedor: Record<string, ErpVentasRow>; savedAt: string };

const deviceKey = (userId: string, month: string) => `erp_ventas:${userId}:${month}`;

function loadDeviceCache(userId: string, month: string): DeviceCache | null {
  try {
    const raw = localStorage.getItem(deviceKey(userId, month));
    if (!raw) return null;
    const p = JSON.parse(raw);
    return p && p.byVendedor && p.savedAt ? (p as DeviceCache) : null;
  } catch {
    return null;
  }
}

function saveDeviceCache(userId: string, month: string, byVendedor: Record<string, ErpVentasRow>, savedAt: string) {
  try {
    localStorage.setItem(deviceKey(userId, month), JSON.stringify({ byVendedor, savedAt }));
  } catch {
    /* quota / private mode — non-fatal */
  }
}

function grandOf(byVendedor: Record<string, ErpVentasRow>) {
  return Object.values(byVendedor).reduce(
    (a, v) => ({ count: a.count + v.count, subtotal: a.subtotal + v.subtotal, total: a.total + v.total }),
    { count: 0, subtotal: 0, total: 0 }
  );
}

// Prominent, distinctly-styled banner showing the ERP total for one seller.
// Deliberately indigo + "ERP · en vivo" badge so it never reads as a pipeline
// (leads) metric.
function ErpVentasBanner({ data, available, loading, onRetry, stale, fetchedAt }: {
  data: ErpVentasRow | undefined;
  available: boolean;
  loading: boolean;
  onRetry: () => void;
  stale: boolean; // served from this device's local cache (ERP unreachable)
  fetchedAt?: string;
}) {
  // "Busy" = ERP unreachable AND nothing cached, or this seller came back with an
  // ERP error. Offer a manual retry rather than auto-hammering.
  const busy = !loading && (!available || !!data?.error);
  return (
    <Card className="bg-white overflow-hidden border-indigo-200">
      <div className="h-1.5 bg-indigo-500 w-full" />
      <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center">
            <Receipt className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-brand-gray">Ventas Facturadas (sin IVA)</p>
              <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px]">ERP · en vivo</Badge>
            </div>
            {loading ? (
              <p className="text-sm text-slate-400 italic mt-1">Consultando ERP…</p>
            ) : busy ? (
              <div className="mt-1 flex items-center gap-3">
                <span className="text-sm text-amber-600 italic">ERP ocupado{data?.error && data.error !== "1001" ? ` (${data.error})` : ""}</span>
                <Button variant="outline" size="sm" onClick={onRetry} className="text-amber-700 border-amber-200">
                  <RefreshCw className="w-3.5 h-3.5" /> Reintentar
                </Button>
              </div>
            ) : (
              <>
                <p className="text-2xl font-bold text-indigo-700">${(data?.subtotal ?? 0).toLocaleString()}</p>
                <p className="text-[11px] text-slate-500">
                  {data?.count ?? 0} facturas este mes · con IVA ${(data?.total ?? 0).toLocaleString()}
                </p>
                {stale && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
                      en caché · {formatFetched(fetchedAt)}
                    </Badge>
                    <Button variant="outline" size="sm" onClick={onRetry} className="text-amber-700 border-amber-200">
                      <RefreshCw className="w-3.5 h-3.5" /> Actualizar
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        <div className="max-w-xs text-[11px] text-slate-500 leading-snug">
          Reconocimiento general de ventas del ERP: incluye ventas sin lead (mostrador, recompras).{" "}
          <span className="font-semibold text-slate-600">No confundir</span> con el pipeline de leads de abajo, que mide lo logrado persiguiendo leads.
        </div>
      </CardContent>
    </Card>
  );
}

function UserScorecard({ user, leadsAll, faltantesAll, goalsTimeline, filterMonth, erpVentas, erpLoading, onErpRetry, erpEnabled, metaVentas }: {
  key?: string;
  user: User;
  leadsAll: ReturnType<typeof useAppData>["leads"];
  faltantesAll: ReturnType<typeof useAppData>["faltantes"];
  goalsTimeline: SalesGoal[];
  filterMonth: string;
  erpVentas: ErpVentas | null;
  erpLoading: boolean;
  onErpRetry: () => void;
  erpEnabled: boolean;
  metaVentas: number; // stored ERP sales (subtotal) for this seller + month — the Progreso Meta numerator
}) {
  // allUserLeads used for sparkline (6-month context); userLeads scoped to filterMonth (by createdAt).
  // EXCEPTION: Vendido and Cotizado bucket by the month the lead reached that stage (facturación /
  // cotización date), not createdAt, so they draw from allUserLeads (incl. leads created earlier).
  // Perdido and the remaining KPIs stay on the createdAt cohort (userLeads).
  const allUserLeads = leadsAll.filter(l => l.assignedTo === user.id);
  const userLeads = allUserLeads.filter(l => {
    const d = new Date(l.createdAt);
    return !isNaN(d.getTime()) && `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === filterMonth;
  });

  const soldLeads = soldLeadsInMonth(allUserLeads, filterMonth);
  const soldValue = soldLeads.reduce((acc, l) => acc + (l.invoicedAmount ?? l.value), 0);
  const quotedLeads = quotedLeadsInMonth(allUserLeads, filterMonth);
  const quotedValue = quotedLeads.reduce((acc, l) => acc + (l.quotedAmount ?? l.value), 0);
  const lostValue = userLeads.filter(l => l.status === "RECHAZADO").reduce((acc, l) => acc + l.value, 0);

  const soldCount = soldLeads.length;
  const quotedCount = quotedLeads.length;
  const lostCount = userLeads.filter(l => l.status === "RECHAZADO").length;

  const pieData = [
    { name: "Vendido", value: soldValue, color: "#10b981" },
    { name: "Cotizado", value: quotedValue, color: "#f59e0b" },
    { name: "Perdido", value: lostValue, color: "#ef4444" },
  ].filter(d => d.value > 0);

  const lostLeads = userLeads.filter(l => l.status === "RECHAZADO");

  const clientInitiatedCount = userLeads.filter(l => l.clientInitiated).length;
  const sellerInitiatedCount = userLeads.length - clientInitiatedCount;
  const clientInitiatedPct = userLeads.length > 0
    ? Math.round((clientInitiatedCount / userLeads.length) * 100)
    : 0;

  const userFaltantes = faltantesAll.filter(f => f.vendedorId === user.id);
  const faltantesThisMonth = userFaltantes.filter(f => {
    const d = new Date(f.createdAt);
    return !isNaN(d.getTime()) && `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === filterMonth;
  }).length;
  const faltantesPendientes = userFaltantes.filter(f => f.estado === "pendiente").length;

  // Sparkline always shows 6 months of context using allUserLeads so the chart
  // gives historical perspective even when filterMonth is a past month.
  const newClientCounts = newClientsByMonth(allUserLeads);
  const convertedCounts = newClientsConvertedByMonth(allUserLeads);
  const recentMonthsForUser = (() => {
    const out: { ym: string; label: string; count: number; converted: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      out.push({
        ym,
        label: `${MESES[d.getMonth()].slice(0, 3)} ${String(d.getFullYear()).slice(2)}`,
        count: newClientCounts.get(ym) || 0,
        converted: convertedCounts.get(ym) || 0,
      });
    }
    return out;
  })();
  const newClientsForMonth = newClientCounts.get(filterMonth) || 0;
  const newClientsTotal = [...newClientCounts.values()].reduce((a, b) => a + b, 0);
  const convertedForMonth = convertedCounts.get(filterMonth) || 0;
  const convertedTotal = [...convertedCounts.values()].reduce((a, b) => a + b, 0);
  const convertedPct = newClientsTotal > 0 ? Math.round((convertedTotal / newClientsTotal) * 100) : 0;
  const maxBar = Math.max(1, ...recentMonthsForUser.map(m => m.count));

  // Goal for the selected month (server has per-month breakdown in goalsTimeline)
  const [filterYear, filterMonthNum] = filterMonth.split("-").map(Number);
  const goalForMonth = goalsTimeline.find(g => g.year === filterYear && g.month === filterMonthNum);
  const effectiveSalesGoal = goalForMonth?.meta ?? user.performance.salesGoal;

  const userTtfc = timeToFirstContact(userLeads);
  const userFunnelData = funnelByStage(userLeads);
  const userPareto = rechazoMotivosPareto(userLeads);
  const totalLost = userPareto.reduce((s, m) => s + m.lostValue, 0);

  return (
    <div className="lg:col-span-3 space-y-6">
      {/* ERP stream — general total sales, kept separate from the leads KPIs below.
          Only shown on the local/LAN build (hidden on the Vercel web build). */}
      {erpEnabled && (
        <ErpVentasBanner
          data={erpVentas?.byVendedor[user.id]}
          available={erpVentas?.available ?? false}
          loading={erpLoading}
          onRetry={onErpRetry}
          stale={erpVentas?.fromDevice ?? false}
          fetchedAt={erpVentas?.savedAt}
        />
      )}

      {/* Leads/pipeline stream — what the seller achieved working tracked leads */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-brand-gray">Vendido (leads)</p>
              <p className="text-xl font-bold text-green-600">${soldValue.toLocaleString()}</p>
              <p className="text-[10px] text-slate-400">{soldCount} tratos cerrados</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
              <FileText className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-brand-gray">Total Cotizado</p>
              <p className="text-xl font-bold text-amber-600">${quotedValue.toLocaleString()}</p>
              <p className="text-[10px] text-slate-400">{quotedCount} cotizaciones activas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-brand-gray">Total Perdido</p>
              <p className="text-xl font-bold text-red-600">${lostValue.toLocaleString()}</p>
              <p className="text-[10px] text-slate-400">{lostCount} tratos perdidos</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/5 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-xs font-semibold text-brand-gray">Meta de Ventas</p>
              <p className="text-xl font-bold text-slate-900">${effectiveSalesGoal.toLocaleString()}</p>
              <p className="text-[10px] text-slate-400">{effectiveSalesGoal > 0 ? Math.min(100, Math.round((metaVentas / effectiveSalesGoal) * 100)) : 0}% · ${metaVentas.toLocaleString()} ventas ERP</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="bg-white overflow-hidden lg:col-span-1">
          <div className="h-2 bg-primary w-full opacity-20" />
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center border">
                  <UserCheck className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <CardTitle className="text-base">{user.name}</CardTitle>
                  <CardDescription>{user.role === "Admin" ? "Administrador" : "Vendedor"}</CardDescription>
                </div>
              </div>
              {effectiveSalesGoal > 0 && metaVentas >= effectiveSalesGoal && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Meta Cumplida</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500 font-medium">Progreso de Meta <span className="text-[10px] text-slate-400">(ventas ERP)</span></span>
                <span className="font-bold">{effectiveSalesGoal > 0 ? Math.min(100, Math.round((metaVentas / effectiveSalesGoal) * 100)) : 0}%</span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${effectiveSalesGoal > 0 ? Math.min(100, (metaVentas / effectiveSalesGoal) * 100) : 0}%` }}
                  className={cn(
                    "h-full transition-all",
                    effectiveSalesGoal > 0 && metaVentas >= effectiveSalesGoal ? "bg-green-500" : "bg-primary"
                  )}
                />
              </div>
            </div>

            <div className="pt-4 border-t space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Tasa de Conversión</span>
                <span className="text-sm font-bold">{(user.performance.conversionRate * 100).toFixed(1)}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Leads Activos</span>
                <span className="text-sm font-bold">{user.workload?.activeLeads || 0}</span>
              </div>
            </div>

            <div className="pt-4 border-t space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-brand-navy">Origen del Contacto</span>
                <span className="text-[10px] text-slate-400">{userLeads.length} total</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-2">
                  <p className="text-xs font-semibold text-blue-700">Cliente</p>
                  <p className="text-lg font-bold text-blue-700 leading-tight">{clientInitiatedCount}</p>
                  <p className="text-[10px] text-blue-600/70">{clientInitiatedPct}% del total</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <p className="text-xs font-semibold text-brand-gray">Vendedor</p>
                  <p className="text-lg font-bold text-slate-700 leading-tight">{sellerInitiatedCount}</p>
                  <p className="text-[10px] text-slate-500">{100 - clientInitiatedPct}% del total</p>
                </div>
              </div>
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                <div className="h-full bg-blue-500" style={{ width: `${clientInitiatedPct}%` }} />
                <div className="h-full bg-slate-400" style={{ width: `${100 - clientInitiatedPct}%` }} />
              </div>
            </div>

            <div className="pt-4 border-t space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-brand-navy">Faltantes</span>
                <span className="text-[10px] text-slate-400">{userFaltantes.length} total</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-amber-100 bg-amber-50/60 p-2">
                  <p className="text-xs font-semibold text-amber-700">Este mes</p>
                  <p className="text-lg font-bold text-amber-700 leading-tight">{faltantesThisMonth}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <p className="text-xs font-semibold text-brand-gray">Pendientes</p>
                  <p className="text-lg font-bold text-slate-700 leading-tight">{faltantesPendientes}</p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-brand-navy">Nuevos Clientes</span>
                <span className="text-[10px] text-slate-400">{newClientsTotal} total</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-2">
                  <p className="text-xs font-semibold text-emerald-700">Nuevos</p>
                  <p className="text-lg font-bold text-emerald-700 leading-tight">{newClientsForMonth}</p>
                  <p className="text-[10px] text-emerald-600/70">este mes</p>
                </div>
                <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-2">
                  <p className="text-xs font-semibold text-indigo-700">Convertidos</p>
                  <p className="text-lg font-bold text-indigo-700 leading-tight">{convertedForMonth}</p>
                  <p className="text-[10px] text-indigo-600/70">{convertedTotal} total · {convertedPct}%</p>
                </div>
              </div>
              <div className="flex items-end gap-1 h-12 pt-1">
                {recentMonthsForUser.map(m => {
                  const isCurrent = m.ym === currentYearMonth();
                  const heightPct = (m.count / maxBar) * 100;
                  const convertedHeightPct = m.count > 0 ? (m.converted / m.count) * heightPct : 0;
                  const tooltip = `${m.label}: ${m.converted}/${m.count} convertidos`;
                  return (
                    <div key={m.ym} className="flex-1 flex flex-col items-center gap-0.5" title={tooltip}>
                      <span className="text-[9px] font-semibold text-slate-600">
                        {m.count ? `${m.converted}/${m.count}` : ""}
                      </span>
                      <div className="w-full bg-slate-100 rounded-t flex items-end relative" style={{ height: "100%" }}>
                        <div
                          className={`w-full rounded-t ${isCurrent ? "bg-emerald-500" : "bg-emerald-300"} relative`}
                          style={{ height: `${m.count === 0 ? 0 : Math.max(8, heightPct)}%` }}
                        >
                          {m.converted > 0 && (
                            <div
                              className={`absolute bottom-0 left-0 w-full ${isCurrent ? "bg-indigo-600" : "bg-indigo-400"} rounded-t`}
                              style={{ height: `${(m.converted / m.count) * 100}%` }}
                            />
                          )}
                        </div>
                      </div>
                      <span className="text-[9px] text-slate-400">{m.label}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-3 text-[10px] text-slate-500 pt-0.5">
                <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-emerald-400" />Nuevos</span>
                <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-indigo-500" />Convertidos</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base font-bold text-brand-navy">Distribución de Pipeline ($)</CardTitle>
          </CardHeader>
          <CardContent className="h-[250px]">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%" cy="50%"
                    innerRadius={60} outerRadius={80}
                    paddingAngle={5} dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(value: number) => `$${value.toLocaleString()}`}
                    contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                  />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                <BarChart3 className="w-8 h-8 opacity-20" />
                <p className="text-xs italic">No hay datos para visualizar</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base font-bold text-brand-navy">Motivos de Rechazo</CardTitle>
            <CardDescription className="text-[10px]">Últimos comentarios de tratos perdidos.</CardDescription>
          </CardHeader>
          <CardContent className="max-h-[250px] overflow-y-auto space-y-3">
            {lostLeads.length > 0 ? (
              lostLeads.map(lead => {
                const lastRejection = lead.history.filter(h => h.status === "RECHAZADO").pop();
                const motivo = lastRejection?.rechazoMotivo;
                const comment = lastRejection?.comment;
                return (
                  <div key={lead.id} className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-xs font-bold text-slate-700">{lead.company}</p>
                      <span className="text-[10px] font-mono text-slate-400">${lead.value.toLocaleString()}</span>
                    </div>
                    <p className="text-xs font-semibold text-red-700">
                      {motivo || "Sin motivo registrado"}
                    </p>
                    {comment && (
                      <p className="mt-1 text-[11px] font-light italic text-slate-500 leading-snug">
                        {comment}
                      </p>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2 py-12">
                <TrendingUp className="w-8 h-8 opacity-20" />
                <p className="text-xs italic">Aún no hay tratos perdidos</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-brand-navy">Embudo de Conversión</CardTitle>
            <CardDescription className="text-[10px]">Leads que tocaron cada etapa, % vs ASIGNADO y conversión paso a paso</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {userFunnelData[0].count === 0 ? (
              <p className="text-xs italic text-slate-400 text-center py-6">Sin leads.</p>
            ) : (
              userFunnelData.map((s) => (
                <div key={s.stage} className="space-y-0.5">
                  <div className="flex items-baseline justify-between text-[11px]">
                    <span className="font-semibold text-slate-700">{s.stage}</span>
                    <div className="flex items-baseline gap-2">
                      {s.stepConversion !== null && (
                        <span className="text-[10px] text-slate-400">{s.stepConversion.toFixed(0)}% ↓</span>
                      )}
                      <span className="font-bold text-slate-900">{s.count}</span>
                      <span className="text-[10px] text-slate-500">{s.pctOfTop.toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${STAGE_COLOR[s.stage] || "bg-slate-400"}`} style={{ width: `${s.pctOfTop}%` }} />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="bg-white lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-brand-navy">Tiempo a Primer Contacto</CardTitle>
            <CardDescription className="text-[10px]">Tiempo entre asignación y primer CONTACTADO</CardDescription>
          </CardHeader>
          <CardContent>
            {userTtfc.median === null ? (
              <p className="text-xs italic text-slate-400 text-center py-6">Aún no hay leads contactados.</p>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-3xl font-bold text-slate-900 leading-none">{formatDays(userTtfc.median)}</p>
                  <p className="text-[10px] text-slate-500 mt-1">mediana sobre {userTtfc.count} leads</p>
                </div>
                <div className="text-[10px] text-slate-500 leading-relaxed">
                  Tiempo a primer contacto correlaciona fuertemente con la tasa de cierre. Por debajo de 1 día es ideal; arriba de 3 días la conversión cae rápido.
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-brand-navy">Pareto de Motivos</CardTitle>
            <CardDescription className="text-[10px]">
              {totalLost > 0 ? `$${totalLost.toLocaleString()} en valor perdido` : "Sin valor perdido aún"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[250px] overflow-y-auto">
            {userPareto.length === 0 ? (
              <p className="text-xs italic text-slate-400 text-center py-6">Sin tratos rechazados.</p>
            ) : (() => {
              const max = userPareto[0].lostValue || 1;
              return userPareto.map((m) => (
                <div key={m.name} className="space-y-0.5">
                  <div className="flex items-baseline justify-between text-[11px]">
                    <span className="font-medium text-slate-700 truncate pr-2">{m.name}</span>
                    <div className="flex items-baseline gap-2 shrink-0">
                      <span className="text-[10px] text-slate-500">×{m.count}</span>
                      <span className="font-bold text-red-700">${m.lostValue.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-red-400 rounded-full" style={{ width: `${(m.lostValue / max) * 100}%` }} />
                  </div>
                </div>
              ));
            })()}
          </CardContent>
        </Card>

        <Card className="bg-white lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-brand-navy">Historial de Metas Mensuales</CardTitle>
          </CardHeader>
          <CardContent>
            {goalsTimeline.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4 text-center">Sin metas registradas para este vendedor.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {goalsTimeline.map((g) => {
                  const pct = g.meta > 0 ? Math.min(100, Math.round((g.invoiced / g.meta) * 100)) : 0;
                  const badgeClass = g.status === "achieved" ? "bg-green-50 text-green-700 border-green-200"
                    : g.status === "missed" ? "bg-red-50 text-red-700 border-red-200"
                    : g.status === "current" ? "bg-blue-50 text-blue-700 border-blue-200"
                    : "bg-slate-50 text-slate-500 border-slate-200";
                  const badgeLabel = g.status === "achieved" ? "Cumplida" : g.status === "missed" ? "No cumplida" : g.status === "current" ? "En curso" : "Próxima";
                  return (
                    <div key={g.id} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">{GOAL_MONTHS[g.month - 1]} {g.year}</span>
                        <Badge variant="outline" className={`text-[10px] ${badgeClass}`}>{badgeLabel}</Badge>
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-500">
                        <span>Meta: <span className="font-semibold text-slate-700">${g.meta.toLocaleString()}</span></span>
                        <span>Facturado: <span className="font-semibold text-slate-700">${g.invoiced.toLocaleString()}</span></span>
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex justify-end text-[10px] font-bold">{pct}%</div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${g.status === "achieved" ? "bg-green-500" : g.status === "missed" ? "bg-red-400" : "bg-primary"}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function PerformanceTab() {
  const { leads, users, currentUser, faltantes } = useAppData();

  // Admins default to team summary; sellers see their own card.
  const [userFilter, setUserFilter] = useState<string>(() =>
    currentUser?.role === "Seller" ? currentUser.id : "all"
  );

  // Goals timeline scoped to whoever is currently being viewed. For the team
  // summary (admin, "all") we don't need any goals.
  const [goalsTimeline, setGoalsTimeline] = useState<SalesGoal[]>([]);
  const viewedUserId = currentUser?.role === "Seller"
    ? currentUser.id
    : (userFilter !== "all" ? userFilter : null);

  useEffect(() => {
    if (!viewedUserId) {
      setGoalsTimeline([]);
      return;
    }
    let aborted = false;
    apiFetch(`/api/users/${viewedUserId}/goals`)
      .then(r => (r.ok ? r.json() : []))
      .then((data: SalesGoal[]) => { if (!aborted) setGoalsTimeline(data); })
      .catch(() => { if (!aborted) setGoalsTimeline([]); });
    return () => { aborted = true; };
  }, [viewedUserId]);

  // Month filter — defaults to current month, scopes all metrics.
  const [filterMonth, setFilterMonth] = useState<string>(currentYearMonth());

  // The ERP stream only works on the local/LAN build (the server calls the
  // LAN-only ERP directly). On the Vercel web build the server reports
  // erpEnabled:false and we hide every ERP-specific control. Default false so
  // nothing ERP-related flashes before the flag resolves.
  const [erpEnabled, setErpEnabled] = useState(false);
  useEffect(() => {
    let aborted = false;
    apiFetch("/api/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg: { erpEnabled?: boolean } | null) => { if (!aborted) setErpEnabled(!!cfg?.erpEnabled); })
      .catch(() => { if (!aborted) setErpEnabled(false); });
    return () => { aborted = true; };
  }, []);

  // ERP "general sales" stream for the selected month. Fetched once per month
  // (role-scoped server-side: admins get all sellers, a seller gets only self).
  const [erpVentas, setErpVentas] = useState<ErpVentas | null>(null);
  const [erpLoading, setErpLoading] = useState(false);
  // Monotonic request id so a manual retry and the month-change effect can't
  // clobber each other — only the latest request's result is applied.
  const erpReqRef = useRef(0);

  // Stored ERP sales per seller for the selected month (from Supabase, NOT the
  // live ERP). Drives Progreso Meta vs real sales and works on every build —
  // incl. the Vercel web one that can't reach the ERP. Topped up whenever any
  // LAN user reads the ERP.
  const [erpStored, setErpStored] = useState<Record<string, { subtotal: number; total: number; facturas: number; updatedAt: string }>>({});
  useEffect(() => {
    let aborted = false;
    apiFetch(`/api/performance/ventas-stored?periodo=${filterMonth}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { byVendedor?: Record<string, { subtotal: number; total: number; facturas: number; updatedAt: string }> } | null) => {
        if (!aborted && d) setErpStored(d.byVendedor || {});
      })
      .catch(() => { if (!aborted) setErpStored({}); });
    return () => { aborted = true; };
  }, [filterMonth]);
  // Progreso Meta source:
  //  - LAN build (erpEnabled): print from the LIVE API read (erpVentas).
  //  - Vercel/web build: read the amount stored in the DB (ventas-stored).
  // The DB value also backs up the LAN case while the live read is still loading
  // or when a seller's live read didn't land (busy/error).
  const metaVentas = (vendedorId: string) => {
    if (erpEnabled) {
      const live = erpVentas?.byVendedor[vendedorId];
      if (live && !live.error) return live.subtotal;
    }
    return erpStored[vendedorId]?.subtotal ?? 0;
  };

  const loadErpVentas = useCallback(() => {
    const [y, m] = filterMonth.split("-").map(Number);
    const desde = `${filterMonth}-01`;
    // For the current month, cap at today ("mes a la fecha"); past months use
    // their real month-end.
    const isCurrentMonth = filterMonth === currentYearMonth();
    const lastDay = isCurrentMonth ? new Date().getDate() : new Date(y, m, 0).getDate();
    const hasta = `${filterMonth}-${String(lastDay).padStart(2, "0")}`;
    const userId = currentUser?.id || "me";

    // When the live pull fails (off-LAN / ERP busy), show whatever this device
    // last saved for this month, tagged with when it was pulled.
    const serveFromDevice = () => {
      const cached = loadDeviceCache(userId, filterMonth);
      if (cached) {
        setErpVentas({ available: true, byVendedor: cached.byVendedor, grand: grandOf(cached.byVendedor), fromDevice: true, savedAt: cached.savedAt });
        return true;
      }
      return false;
    };

    const reqId = ++erpReqRef.current;
    setErpLoading(true);
    apiFetch(`/api/performance/ventas?desde=${desde}&hasta=${hasta}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: ErpVentas | null) => {
        if (erpReqRef.current !== reqId) return;
        const freshRows = data && data.available
          ? Object.entries(data.byVendedor || {}).filter(([, v]) => !v.error)
          : [];
        if (freshRows.length > 0) {
          // Live pull worked (we're on the LAN). Show it AND save to the device,
          // merging the fresh rows over any previously-cached ones for the month.
          const savedAt = new Date().toISOString();
          const merged = { ...(loadDeviceCache(userId, filterMonth)?.byVendedor || {}) };
          for (const [id, v] of freshRows) merged[id] = v;
          saveDeviceCache(userId, filterMonth, merged, savedAt);
          setErpVentas({ available: true, byVendedor: data!.byVendedor, grand: data!.grand, fromDevice: false, savedAt });
        } else if (!serveFromDevice()) {
          setErpVentas(data); // no live data and nothing cached yet
        }
      })
      .catch(() => {
        if (erpReqRef.current !== reqId) return;
        if (!serveFromDevice()) setErpVentas(null);
      })
      .finally(() => { if (erpReqRef.current === reqId) setErpLoading(false); });
  }, [filterMonth, currentUser]);

  // Initial load + whenever the month changes: check that month (current month
  // on first render). Only when the ERP stream is enabled (local build).
  useEffect(() => { if (erpEnabled) loadErpVentas(); }, [loadErpVentas, erpEnabled]);

  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    set.add(currentYearMonth());
    for (const l of leads) {
      const d = new Date(l.createdAt);
      if (!isNaN(d.getTime())) {
        set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      }
    }
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [leads]);

  // Keep filter in sync if the user switches accounts.
  useEffect(() => {
    if (currentUser?.role === "Seller") setUserFilter(currentUser.id);
    else setUserFilter("all");
  }, [currentUser]);

  if (!currentUser) return null;

  const summaryUsers: User[] = currentUser.role === "Admin"
    ? users.filter(u => u.id === userFilter)
    : users.filter(u => u.id === currentUser.id);

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Análisis de Rendimiento</h2>
          <p className="text-slate-500">
            {currentUser.role === "Admin"
              ? "Rendimiento de ventas de todo el equipo y salud del pipeline."
              : "Tus métricas de ventas personales y progreso del pipeline."}
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          {currentUser.role === "Admin" && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-brand-gray ml-1">Filtrar por Vendedor</p>
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger className="w-[200px] h-10">
                  <SelectValue placeholder="Seleccionar Vista" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Resumen del Equipo</SelectItem>
                  {users.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1">
            <p className="text-xs font-medium text-brand-gray ml-1">Mes</p>
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="w-[160px] h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map(ym => {
                  const [y, m] = ym.split("-").map(Number);
                  return <SelectItem key={ym} value={ym}>{`${MESES[m - 1]} ${y}`}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>

          {erpEnabled && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-brand-gray ml-1">Ventas ERP</p>
              <div className="h-10 flex items-center">
                {erpLoading ? (
                  <span className="text-xs text-slate-400 flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5 animate-spin" />Consultando…</span>
                ) : erpVentas?.fromDevice ? (
                  <Button variant="outline" size="sm" onClick={loadErpVentas} className="text-amber-700 border-amber-200" title={`Guardado en este dispositivo · ${formatFetched(erpVentas.savedAt)}`}>
                    <RefreshCw className="w-3.5 h-3.5" /> En caché · {formatFetched(erpVentas.savedAt)}
                  </Button>
                ) : erpVentas && erpVentas.available && Object.values(erpVentas.byVendedor).some((v: ErpVentasRow) => !v.error) ? (
                  <span className="text-xs text-emerald-600 flex items-center gap-1.5"><Receipt className="w-3.5 h-3.5" />en vivo</span>
                ) : (
                  <Button variant="outline" size="sm" onClick={loadErpVentas} className="text-amber-700 border-amber-200">
                    <RefreshCw className="w-3.5 h-3.5" /> ERP no disponible — reintentar
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {currentUser.role === "Admin" && userFilter === "all" ? (
        <Card className="bg-white overflow-hidden">
          <CardHeader>
            <CardTitle>Resumen de Rendimiento del Equipo</CardTitle>
            <CardDescription>
              {erpEnabled
                ? <>Las columnas <span className="font-semibold text-indigo-600">ERP</span> son ventas facturadas, subtotal sin IVA (en vivo, incluye ventas sin lead); el resto proviene del pipeline de leads.</>
                : "Resumen de todos los vendedores y su estado actual del pipeline."}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50">
                    <TableHead className="font-semibold">Vendedor</TableHead>
                    {erpEnabled && (<>
                      <TableHead className="font-semibold bg-indigo-50/50 text-indigo-700">Facturado ERP (s/IVA)</TableHead>
                      <TableHead className="font-semibold bg-indigo-50/50 text-indigo-700"># Facturas ERP</TableHead>
                    </>)}
                    <TableHead className="font-semibold">Vendido leads ($)</TableHead>
                    <TableHead className="font-semibold">Cotizado ($)</TableHead>
                    <TableHead className="font-semibold">Perdido ($)</TableHead>
                    <TableHead className="font-semibold">Origen</TableHead>
                    <TableHead className="font-semibold">Nuevos Clientes</TableHead>
                    <TableHead className="font-semibold">Convertidos</TableHead>
                    <TableHead className="font-semibold">1er Contacto</TableHead>
                    <TableHead className="font-semibold">COT→FACT</TableHead>
                    <TableHead className="font-semibold">Progreso Meta</TableHead>
                    <TableHead className="text-right font-semibold">Conversión</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => {
                    const userAllLeads = leads.filter(l => l.assignedTo === user.id);
                    const userLeads = userAllLeads.filter(l => {
                      const d = new Date(l.createdAt);
                      return !isNaN(d.getTime()) && `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === filterMonth;
                    });
                    // Vendido / Cotizado bucket by the month the lead reached that stage (not createdAt).
                    const soldValue = soldLeadsInMonth(userAllLeads, filterMonth).reduce((acc, l) => acc + (l.invoicedAmount ?? l.value), 0);
                    const quotedValue = quotedLeadsInMonth(userAllLeads, filterMonth).reduce((acc, l) => acc + (l.quotedAmount ?? l.value), 0);
                    const lostValue = userLeads.filter(l => l.status === "RECHAZADO").reduce((acc, l) => acc + l.value, 0);
                    const clientInitiated = userLeads.filter(l => l.clientInitiated).length;
                    const sellerInitiated = userLeads.length - clientInitiated;
                    const newClientsForMonth = userLeads.filter(l => l.newClient).length;
                    const convertedForMonth = userLeads.filter(l => l.newClient && (l.status === "FACTURADO" || l.status === "ENTREGADO")).length;
                    const ttfc = timeToFirstContact(userLeads);
                    const userFunnel = funnelByStage(userLeads);
                    const cotToFact = userFunnel.find(s => s.stage === "FACTURADO")?.stepConversion ?? null;
                    // Progreso Meta compares the goal to stored ERP sales (not leads).
                    const metaVentasUser = metaVentas(user.id);
                    const progress = user.performance.salesGoal > 0
                      ? Math.min(100, Math.round((metaVentasUser / user.performance.salesGoal) * 100))
                      : 0;
                    const erp = erpVentas?.byVendedor[user.id];
                    const erpStale = erpVentas?.fromDevice ?? false;

                    return (
                      <TableRow key={user.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setUserFilter(user.id)}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                              {user.name.charAt(0)}
                            </div>
                            {user.name}
                          </div>
                        </TableCell>
                        {erpEnabled && (<>
                          <TableCell className="bg-indigo-50/30 font-bold">
                            {erpLoading ? <span className="text-slate-300">…</span>
                              : erp && !erp.error ? (
                                  <span className={erpStale ? "text-amber-600" : "text-indigo-700"}
                                    title={erpStale ? `En caché · ${formatFetched(erpVentas?.savedAt)}` : undefined}>
                                    ${erp.subtotal.toLocaleString()}{erpStale ? " *" : ""}
                                  </span>
                                )
                              : <span className="text-slate-300" title={erp?.error || "ERP no disponible"}>—</span>}
                          </TableCell>
                          <TableCell className={`bg-indigo-50/30 font-semibold ${erpStale ? "text-amber-600" : "text-indigo-700"}`}>
                            {erpLoading ? <span className="text-slate-300">…</span>
                              : erp && !erp.error ? erp.count
                              : <span className="text-slate-300">—</span>}
                          </TableCell>
                        </>)}
                        <TableCell className="font-bold text-green-600">${soldValue.toLocaleString()}</TableCell>
                        <TableCell className="text-amber-600">${quotedValue.toLocaleString()}</TableCell>
                        <TableCell className="text-red-600">
                          <span className="text-sm font-bold">${lostValue.toLocaleString()}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5 leading-tight">
                            <span className="text-[11px] text-blue-600">Cliente: <span className="font-bold">{clientInitiated}</span></span>
                            <span className="text-[11px] text-slate-600">Vendedor: <span className="font-bold">{sellerInitiated}</span></span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-bold text-emerald-700">{newClientsForMonth}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-bold text-indigo-700">{convertedForMonth}</span>
                        </TableCell>
                        <TableCell>
                          {ttfc.median !== null ? (
                            <div className="flex flex-col gap-0.5 leading-tight">
                              <span className="text-sm font-bold text-slate-900">{formatDays(ttfc.median)}</span>
                              <span className="text-[10px] text-slate-500">mediana · n={ttfc.count}</span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">sin datos</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {cotToFact !== null ? (
                            <span className="text-xs font-bold text-slate-900">{cotToFact.toFixed(0)}%</span>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden border">
                              <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
                            </div>
                            <span className="text-xs font-bold">{progress}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{(user.performance.conversionRate * 100).toFixed(1)}%</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {summaryUsers.map((user) => (
            <UserScorecard
              key={user.id}
              user={user}
              leadsAll={leads}
              faltantesAll={faltantes}
              goalsTimeline={goalsTimeline}
              filterMonth={filterMonth}
              erpVentas={erpVentas}
              erpLoading={erpLoading}
              onErpRetry={loadErpVentas}
              erpEnabled={erpEnabled}
              metaVentas={metaVentas(user.id)}
            />
          ))}
        </div>
      )}
    </>
  );
}
