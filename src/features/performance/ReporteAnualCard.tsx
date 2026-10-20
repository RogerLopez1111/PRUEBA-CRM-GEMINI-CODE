/**
 * "Ventas por Cliente" annual report embedded in the Performance tab — the
 * ManagementPro REPORTE ANALÍTICO DE VENTAS ANUAL (CLIENTE) for the viewed
 * seller. Read from the materialized mirror via /api/performance/reporte-anual
 * (role-scoped server-side; sellers only ever get their own).
 *
 * The month filter keys off the tab's selected month: show every client, only
 * those that bought in that month, or only those that did NOT — in every case
 * the full 12-month row is shown (just the row set changes).
 */
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { MESES } from "../../lib/helpers";
import { apiFetch } from "../../lib/api";

type Cliente = { clave: string; nombre: string; razonSocial: string; meses: number[]; total: number };
type Segmento = { id: string; name: string; clientes: Cliente[]; totalesMes: number[]; total: number };
type Reporte = { anio: string; segmentos: Segmento[]; totalesMes: number[]; total: number; clientesConVenta: number };

type Filtro = "todos" | "compraron" | "sin";

const mxn = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
const money = (n: number) => (n ? mxn.format(n) : "–");

export function ReporteAnualCard({ userId, filterMonth }: { userId: string; filterMonth: string }) {
  const anio = filterMonth.slice(0, 4);
  const monthIdx = Number(filterMonth.slice(5, 7)) - 1; // 0..11
  const mesLabel = MESES[monthIdx] ?? "";

  const [data, setData] = useState<Reporte | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todos");

  useEffect(() => {
    let aborted = false;
    setLoading(true);
    setError(null);
    apiFetch(`/api/performance/reporte-anual?vendedor=${encodeURIComponent(userId)}&anio=${anio}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: Reporte) => { if (!aborted) setData(d); })
      .catch((e) => { if (!aborted) setError(e?.message || "Error"); })
      .finally(() => { if (!aborted) setLoading(false); });
    return () => { aborted = true; };
  }, [userId, anio]);

  // Apply the month filter at the client level, then recompute segment / grand
  // totals from the visible rows so the footer matches what's shown.
  const view = useMemo(() => {
    if (!data) return null;
    const keep = (c: Cliente) =>
      filtro === "todos" ? true : filtro === "compraron" ? c.meses[monthIdx] > 0 : c.meses[monthIdx] <= 0;

    const grandMes = new Array(12).fill(0);
    let grandTotal = 0;
    let visibles = 0;
    const segmentos = data.segmentos
      .map((s) => {
        const clientes = s.clientes.filter(keep);
        const totalesMes = new Array(12).fill(0);
        let total = 0;
        for (const c of clientes) {
          for (let i = 0; i < 12; i++) totalesMes[i] += c.meses[i];
          total += c.total;
        }
        for (let i = 0; i < 12; i++) grandMes[i] += totalesMes[i];
        grandTotal += total;
        visibles += clientes.length;
        return { ...s, clientes, totalesMes, total };
      })
      .filter((s) => s.clientes.length > 0);
    return { segmentos, totalesMes: grandMes, total: grandTotal, visibles };
  }, [data, filtro, monthIdx]);

  const compr6 = useMemo(() => {
    if (!data) return 0;
    return data.segmentos.reduce((n, s) => n + s.clientes.filter((c) => c.meses[monthIdx] > 0).length, 0);
  }, [data, monthIdx]);

  const FILTROS: { key: Filtro; label: string }[] = [
    { key: "todos", label: "Todos" },
    { key: "compraron", label: `Compraron en ${mesLabel}` },
    { key: "sin", label: `Sin compra en ${mesLabel}` },
  ];

  return (
    <Card className="bg-white lg:col-span-3">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base font-bold text-brand-navy">
            Ventas por Cliente · {anio}
            <span className="ml-2 text-[11px] font-normal text-slate-400">facturado, sin IVA · agrupado por segmento</span>
          </CardTitle>
          {data && (
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                {compr6} / {data.clientesConVenta} compraron en {mesLabel}
              </Badge>
            </div>
          )}
        </div>
        {/* Filter segmented control */}
        <div className="flex flex-wrap gap-1 pt-2">
          {FILTROS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFiltro(f.key)}
              className={cn(
                "px-3 py-1 text-xs font-semibold rounded-full border transition-colors",
                filtro === f.key
                  ? "bg-brand-navy text-white border-brand-navy"
                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-xs text-slate-400 italic py-6 text-center">Cargando reporte…</p>
        ) : error ? (
          <p className="text-xs text-red-500 italic py-6 text-center">No se pudo cargar el reporte: {error}</p>
        ) : !view || view.segmentos.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-6 text-center">
            {data && data.clientesConVenta > 0
              ? `Ningún cliente coincide con el filtro en ${mesLabel} ${anio}.`
              : `Sin ventas registradas para este vendedor en ${anio}.`}
          </p>
        ) : (
          <div className="space-y-5">
            {view.segmentos.map((s) => (
              <div key={s.id}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-bold text-brand-navy tracking-wide">SEGMENTO</span>
                  <span className="text-sm font-bold text-slate-800">{s.id} · {s.name}</span>
                  <span className="ml-auto text-[11px] font-semibold text-slate-500">
                    {s.clientes.length} cliente{s.clientes.length === 1 ? "" : "s"} · {mxn.format(s.total)}
                  </span>
                </div>
                <div className="overflow-x-auto rounded-lg border border-slate-100">
                  <table className="w-full border-collapse text-xs" style={{ minWidth: 980 }}>
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="sticky left-0 bg-slate-50 text-left font-semibold text-slate-500 px-2 py-1.5 whitespace-nowrap">Cliente</th>
                        {MESES.map((m, i) => (
                          <th key={m} className={cn("text-right font-semibold px-2 py-1.5 whitespace-nowrap", i === monthIdx ? "text-brand-navy bg-indigo-50" : "text-slate-500")}>{m}</th>
                        ))}
                        <th className="text-right font-bold text-brand-navy px-2 py-1.5 whitespace-nowrap">TOTAL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.clientes.map((c) => (
                        <tr key={c.clave} className="border-t border-slate-100">
                          <td className="sticky left-0 bg-white px-2 py-1.5 whitespace-nowrap">
                            <span className="font-semibold text-slate-700">{c.nombre || c.razonSocial || c.clave}</span>
                            <span className="ml-1.5 text-[10px] text-slate-400">{c.clave}</span>
                          </td>
                          {c.meses.map((v, i) => (
                            <td key={i} className={cn("text-right px-2 py-1.5 tabular-nums whitespace-nowrap", i === monthIdx ? "bg-indigo-50/60" : "", v ? "text-slate-700" : "text-slate-300")}>{money(v)}</td>
                          ))}
                          <td className="text-right px-2 py-1.5 font-bold tabular-nums whitespace-nowrap">{mxn.format(c.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-slate-200 bg-slate-50 font-bold">
                        <td className="sticky left-0 bg-slate-50 px-2 py-1.5 whitespace-nowrap">TOTAL: {s.clientes.length}</td>
                        {s.totalesMes.map((v, i) => (
                          <td key={i} className={cn("text-right px-2 py-1.5 tabular-nums whitespace-nowrap", i === monthIdx ? "bg-indigo-50" : "")}>{money(v)}</td>
                        ))}
                        <td className="text-right px-2 py-1.5 tabular-nums whitespace-nowrap">{mxn.format(s.total)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            ))}

            {/* Grand total across visible segmentos */}
            <div className="overflow-x-auto rounded-lg bg-brand-navy text-white">
              <table className="w-full border-collapse text-xs" style={{ minWidth: 980 }}>
                <tbody>
                  <tr className="font-bold">
                    <td className="sticky left-0 bg-brand-navy px-2 py-2 whitespace-nowrap">TOTAL GENERAL</td>
                    {view.totalesMes.map((v, i) => (
                      <td key={i} className="text-right px-2 py-2 tabular-nums whitespace-nowrap">{money(v)}</td>
                    ))}
                    <td className="text-right px-2 py-2 tabular-nums whitespace-nowrap">{mxn.format(view.total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
