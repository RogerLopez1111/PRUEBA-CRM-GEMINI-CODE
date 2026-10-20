/**
 * REPORTE DE RENTABILIDAD (POR VENDEDOR) — admin view. All sellers × ENE…DIC,
 * the headline value is UTILIDAD BRUTA (net of devoluciones/rechazos y
 * bonificaciones, exactly like ManagementPro RPVNA06). Reads the materialized
 * mirror via GET /api/performance/rentabilidad (admin-only) — no ERP access, so
 * it works on every build. Each month cell is the month's utilidad bruta in
 * pesos; the TOTAL block carries importe neto, costo, utilidad y % del año.
 */
import { useEffect, useState } from "react";
import { TrendingUp, Percent } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { apiFetch } from "../../lib/api";

type Celda = { importe: number; costo: number; utilidad: number; rentabilidad: number };
type Vendedor = { id: string; nombre: string; meses: Celda[]; total: Celda };
type Resp = {
  anio: string;
  vendedores: Vendedor[];
  totalesMes: Celda[];
  total: Celda;
  vendedoresConVenta: number;
};

const MESES_CORTOS = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
const mxn = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
const mxn2 = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
const pct = new Intl.NumberFormat("es-MX", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });

// Utilidad cell color: red if negative, muted if empty, slate otherwise.
function utilColor(has: boolean, u: number): string {
  if (!has) return "text-slate-300";
  if (u < 0) return "text-red-600 font-semibold";
  return "text-slate-800";
}

export function RentabilidadReport() {
  const [anios, setAnios] = useState<string[]>([]);
  const [anio, setAnio] = useState("");
  const [loadingOpts, setLoadingOpts] = useState(true);
  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState<Resp | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await apiFetch("/api/performance/rentabilidad/anios");
        const json = await r.json();
        if (!r.ok) { setError(json?.error || `Error HTTP ${r.status}`); return; }
        setAnios(json.anios || []);
        if (json.anios?.length) setAnio(json.anios[0]);
      } catch (e: any) {
        setError(`No se pudieron cargar los años: ${e?.message || e}`);
      } finally {
        setLoadingOpts(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!anio) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await apiFetch(`/api/performance/rentabilidad?anio=${anio}`);
        const json = await r.json();
        if (cancelled) return;
        if (!r.ok) setError(json?.error || `Error HTTP ${r.status}`);
        else setResp(json);
      } catch (e: any) {
        if (!cancelled) setError(`Fallo de red: ${e?.message || e}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [anio]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-slate-400" />
            Reporte de Rentabilidad por Vendedor
          </h3>
          <p className="text-xs text-slate-500">
            Utilidad bruta neta de devoluciones/rechazos y bonificaciones (fórmula ManagementPro RPVNA06). Montos en pesos.
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-medium text-brand-gray ml-1">Año</p>
          <Select value={anio} onValueChange={setAnio} disabled={loadingOpts}>
            <SelectTrigger className="w-[120px] h-9"><SelectValue placeholder={loadingOpts ? "Cargando…" : "—"} /></SelectTrigger>
            <SelectContent>
              {anios.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm">{error}</div>
      )}

      {resp && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-white">
              <CardContent className="pt-6">
                <p className="text-sm font-medium text-slate-500">Vendedores con venta</p>
                <h3 className="text-2xl font-bold">{resp.vendedoresConVenta}</h3>
              </CardContent>
            </Card>
            <Card className="bg-white">
              <CardContent className="pt-6">
                <p className="text-sm font-medium text-slate-500">Importe neto</p>
                <h3 className="text-2xl font-bold">{mxn.format(resp.total.importe)}</h3>
              </CardContent>
            </Card>
            <Card className="bg-brand-navy text-white border-none">
              <CardContent className="pt-6">
                <p className="text-sm font-medium text-white/70">Utilidad bruta</p>
                <h3 className="text-2xl font-bold">{mxn.format(resp.total.utilidad)}</h3>
              </CardContent>
            </Card>
            <Card className="bg-white">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">% Rentabilidad</p>
                    <h3 className="text-2xl font-bold">{pct.format(resp.total.rentabilidad)}</h3>
                  </div>
                  <div className="bg-emerald-50 p-2 rounded-lg"><Percent className="w-5 h-5 text-emerald-600" /></div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold text-brand-navy">Utilidad bruta por mes · {resp.anio}</CardTitle>
              <CardDescription className="text-[11px]">
                Cada celda es la utilidad bruta del mes. El bloque TOTAL muestra importe neto, costo, utilidad y % del año.
                {loading && <span className="ml-2 text-slate-400">Actualizando…</span>}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {resp.vendedores.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400">Sin ventas registradas en {resp.anio}.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/50">
                        <TableHead className="text-[10px] sticky left-0 bg-slate-50/50 z-10">Vendedor</TableHead>
                        {MESES_CORTOS.map((m) => <TableHead key={m} className="text-[10px] text-right">{m}</TableHead>)}
                        <TableHead className="text-[10px] text-right border-l">Importe neto</TableHead>
                        <TableHead className="text-[10px] text-right">Costo</TableHead>
                        <TableHead className="text-[10px] text-right">Utilidad</TableHead>
                        <TableHead className="text-[10px] text-right text-brand-navy">%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resp.vendedores.map((v) => (
                        <TableRow key={v.id}>
                          <TableCell className="text-xs sticky left-0 bg-white">
                            <div className="font-medium text-slate-900">{v.nombre}</div>
                            <div className="text-[10px] text-slate-400">{v.id}</div>
                          </TableCell>
                          {v.meses.map((c, i) => {
                            const has = c.importe !== 0 || c.costo !== 0;
                            return (
                              <TableCell
                                key={i}
                                className={`text-right text-xs tabular-nums ${utilColor(has, c.utilidad)}`}
                                title={has ? `Importe ${mxn2.format(c.importe)} · Costo ${mxn2.format(c.costo)} · ${pct.format(c.rentabilidad)}` : "Sin ventas"}
                              >
                                {has ? mxn.format(c.utilidad) : "–"}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-right text-xs tabular-nums border-l">{mxn.format(v.total.importe)}</TableCell>
                          <TableCell className="text-right text-xs tabular-nums text-slate-500">{mxn.format(v.total.costo)}</TableCell>
                          <TableCell className="text-right text-xs tabular-nums font-bold">{mxn.format(v.total.utilidad)}</TableCell>
                          <TableCell className={`text-right text-xs tabular-nums font-semibold ${v.total.utilidad < 0 ? "text-red-600" : "text-emerald-700"}`}>
                            {v.total.importe !== 0 ? pct.format(v.total.rentabilidad) : "–"}
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Grand total */}
                      <TableRow className="bg-brand-navy hover:bg-brand-navy">
                        <TableCell className="text-xs font-bold text-white sticky left-0 bg-brand-navy">TOTAL GENERAL</TableCell>
                        {resp.totalesMes.map((c, i) => (
                          <TableCell key={i} className="text-right text-xs tabular-nums font-semibold text-white">
                            {c.importe !== 0 || c.costo !== 0 ? mxn.format(c.utilidad) : "–"}
                          </TableCell>
                        ))}
                        <TableCell className="text-right text-xs tabular-nums font-bold text-white border-l border-white/20">{mxn.format(resp.total.importe)}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums text-white/70">{mxn.format(resp.total.costo)}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums font-bold text-white">{mxn.format(resp.total.utilidad)}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums font-bold text-white">{pct.format(resp.total.rentabilidad)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
