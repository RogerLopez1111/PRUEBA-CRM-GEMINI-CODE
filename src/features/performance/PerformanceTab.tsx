/**
 * Performance tab — team summary table (admin) and per-user scorecard with
 * pipeline distribution, rejection reasons, conversion funnel, time-to-first-
 * contact, Pareto of rechazo motivos, and monthly goals timeline.
 *
 * Owns its own vendedor filter and the goals-timeline fetch keyed to whichever
 * user is being viewed. Sellers see only their own card; admins default to the
 * team summary table and can click a row to drill into a single seller.
 */
import { useEffect, useState } from "react";
import {
  TrendingUp, CheckCircle2, AlertCircle, UserCheck, BarChart3, FileText,
} from "lucide-react";
import { motion } from "motion/react";
import {
  PieChart, Pie, Cell, Legend,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  currentYearMonth,
  timeToFirstContact,
  rechazoMotivosPareto,
  funnelByStage,
  formatDays,
} from "../../lib/helpers";
import { useAppData } from "../../state/AppDataContext";
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

function UserScorecard({ user, leadsAll, faltantesAll, goalsTimeline }: {
  key?: string;
  user: User;
  leadsAll: ReturnType<typeof useAppData>["leads"];
  faltantesAll: ReturnType<typeof useAppData>["faltantes"];
  goalsTimeline: SalesGoal[];
}) {
  const userLeads = leadsAll.filter(l => l.assignedTo === user.id);
  const soldValue = userLeads.filter(l => l.status === "FACTURADO" || l.status === "ENTREGADO").reduce((acc, l) => acc + (l.invoicedAmount ?? l.value), 0);
  const quotedValue = userLeads.filter(l => l.status === "COTIZADO").reduce((acc, l) => acc + (l.quotedAmount ?? l.value), 0);
  const lostValue = userLeads.filter(l => l.status === "RECHAZADO").reduce((acc, l) => acc + l.value, 0);

  const soldCount = userLeads.filter(l => l.status === "FACTURADO" || l.status === "ENTREGADO").length;
  const quotedCount = userLeads.filter(l => l.status === "COTIZADO").length;
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
    return !isNaN(d.getTime()) && `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === currentYearMonth();
  }).length;
  const faltantesPendientes = userFaltantes.filter(f => f.estado === "pendiente").length;

  const newClientCounts = newClientsByMonth(userLeads);
  const recentMonthsForUser = (() => {
    const out: { ym: string; label: string; count: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      out.push({
        ym,
        label: `${MESES[d.getMonth()].slice(0, 3)} ${String(d.getFullYear()).slice(2)}`,
        count: newClientCounts.get(ym) || 0,
      });
    }
    return out;
  })();
  const newClientsThisMonth = newClientCounts.get(currentYearMonth()) || 0;
  const newClientsTotal = [...newClientCounts.values()].reduce((a, b) => a + b, 0);
  const maxBar = Math.max(1, ...recentMonthsForUser.map(m => m.count));

  const userTtfc = timeToFirstContact(userLeads);
  const userFunnelData = funnelByStage(userLeads);
  const userPareto = rechazoMotivosPareto(userLeads);
  const totalLost = userPareto.reduce((s, m) => s + m.lostValue, 0);

  return (
    <div className="lg:col-span-3 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-brand-gray">Total Vendido</p>
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
              <p className="text-xl font-bold text-slate-900">${user.performance.salesGoal.toLocaleString()}</p>
              <p className="text-[10px] text-slate-400">{Math.min(100, Math.round((soldValue / user.performance.salesGoal) * 100))}% alcanzado</p>
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
              {soldValue >= user.performance.salesGoal && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Meta Cumplida</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500 font-medium">Progreso de Meta</span>
                <span className="font-bold">{Math.min(100, Math.round((soldValue / user.performance.salesGoal) * 100))}%</span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (soldValue / user.performance.salesGoal) * 100)}%` }}
                  className={cn(
                    "h-full transition-all",
                    soldValue >= user.performance.salesGoal ? "bg-green-500" : "bg-primary"
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
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-emerald-600 leading-none">{newClientsThisMonth}</span>
                <span className="text-[10px] text-slate-500">este mes</span>
              </div>
              <div className="flex items-end gap-1 h-12 pt-1">
                {recentMonthsForUser.map(m => {
                  const isCurrent = m.ym === currentYearMonth();
                  const heightPct = (m.count / maxBar) * 100;
                  return (
                    <div key={m.ym} className="flex-1 flex flex-col items-center gap-0.5">
                      <span className="text-[9px] font-semibold text-slate-600">{m.count || ""}</span>
                      <div className="w-full bg-slate-100 rounded-t flex items-end" style={{ height: "100%" }}>
                        <div
                          className={`w-full rounded-t ${isCurrent ? "bg-emerald-500" : "bg-emerald-300"}`}
                          style={{ height: `${m.count === 0 ? 0 : Math.max(8, heightPct)}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-slate-400">{m.label}</span>
                    </div>
                  );
                })}
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
    fetch(`/api/users/${viewedUserId}/goals`)
      .then(r => (r.ok ? r.json() : []))
      .then((data: SalesGoal[]) => { if (!aborted) setGoalsTimeline(data); })
      .catch(() => { if (!aborted) setGoalsTimeline([]); });
    return () => { aborted = true; };
  }, [viewedUserId]);

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
      </div>

      {currentUser.role === "Admin" && userFilter === "all" ? (
        <Card className="bg-white overflow-hidden">
          <CardHeader>
            <CardTitle>Resumen de Rendimiento del Equipo</CardTitle>
            <CardDescription>Resumen de todos los vendedores y su estado actual del pipeline.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50">
                    <TableHead className="font-semibold">Vendedor</TableHead>
                    <TableHead className="font-semibold">Vendido ($)</TableHead>
                    <TableHead className="font-semibold">Cotizado ($)</TableHead>
                    <TableHead className="font-semibold">Perdido ($)</TableHead>
                    <TableHead className="font-semibold">Origen</TableHead>
                    <TableHead className="font-semibold">Nuevos Clientes</TableHead>
                    <TableHead className="font-semibold">1er Contacto</TableHead>
                    <TableHead className="font-semibold">COT→FACT</TableHead>
                    <TableHead className="font-semibold">Progreso Meta</TableHead>
                    <TableHead className="text-right font-semibold">Conversión</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => {
                    const userLeads = leads.filter(l => l.assignedTo === user.id);
                    const soldValue = userLeads.filter(l => l.status === "FACTURADO" || l.status === "ENTREGADO").reduce((acc, l) => acc + (l.invoicedAmount ?? l.value), 0);
                    const quotedValue = userLeads.filter(l => l.status === "COTIZADO").reduce((acc, l) => acc + (l.quotedAmount ?? l.value), 0);
                    const lostValue = userLeads.filter(l => l.status === "RECHAZADO").reduce((acc, l) => acc + l.value, 0);
                    const clientInitiated = userLeads.filter(l => l.clientInitiated).length;
                    const sellerInitiated = userLeads.length - clientInitiated;
                    const newClientCounts = newClientsByMonth(userLeads);
                    const newClientsThisMonth = newClientCounts.get(currentYearMonth()) || 0;
                    const newClientsTotal = [...newClientCounts.values()].reduce((a, b) => a + b, 0);
                    const ttfc = timeToFirstContact(userLeads);
                    const userFunnel = funnelByStage(userLeads);
                    const cotToFact = userFunnel.find(s => s.stage === "FACTURADO")?.stepConversion ?? null;
                    const progress = Math.min(100, Math.round((soldValue / user.performance.salesGoal) * 100));

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
                        <TableCell className="font-bold text-green-600">${soldValue.toLocaleString()}</TableCell>
                        <TableCell className="text-amber-600">${quotedValue.toLocaleString()}</TableCell>
                        <TableCell className="text-red-600">${lostValue.toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5 leading-tight">
                            <span className="text-[11px] text-blue-600">Cliente: <span className="font-bold">{clientInitiated}</span></span>
                            <span className="text-[11px] text-slate-600">Vendedor: <span className="font-bold">{sellerInitiated}</span></span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5 leading-tight">
                            <span className="text-sm font-bold text-emerald-700">{newClientsThisMonth}</span>
                            <span className="text-[10px] text-slate-500">este mes · {newClientsTotal} total</span>
                          </div>
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
            />
          ))}
        </div>
      )}
    </>
  );
}
