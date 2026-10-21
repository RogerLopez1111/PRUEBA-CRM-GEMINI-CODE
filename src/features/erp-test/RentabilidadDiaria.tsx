/**
 * RENTABILIDAD DIARIA (POR DÍA) — daily-grain twin of RentabilidadVendedores.
 * Reads ONLY the Supabase mirror table erp_rentabilidad_vendedor_diario (rolling
 * window populated each ERP sync) via /api/erp-test/rentabilidad/diario/* — no
 * live ERP call, works on the Vercel build. Pick a month (and optionally one
 * vendedor); one row per day: importe neto, costo, utilidad y % de rentabilidad.
 */
import { useEffect, useState, type CSSProperties } from "react";

type CeldaDia = { fecha: string; importe: number; costo: number; utilidad: number; rentabilidad: number };
type Celda = { importe: number; costo: number; utilidad: number; rentabilidad: number };
type Resp = {
  mes: string;
  vendedorId: string;
  dias: CeldaDia[];
  total: Celda;
  vendedores: { id: string; nombre: string }[];
};

const mxn = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
const pct = new Intl.NumberFormat("es-MX", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });
const money = (n: number) => (n ? mxn.format(n) : "–");

// 'YYYY-MM' → 'octubre 2026'
function mesLabel(mes: string): string {
  if (!/^\d{4}-\d{2}$/.test(mes)) return mes;
  const d = new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)) - 1, 1);
  return d.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
}
// 'YYYY-MM-DD' → 'mié 21'
function diaLabel(fecha: string): string {
  const d = new Date(Number(fecha.slice(0, 4)), Number(fecha.slice(5, 7)) - 1, Number(fecha.slice(8, 10)));
  return d.toLocaleDateString("es-MX", { weekday: "short", day: "2-digit" });
}

function pctColor(hasData: boolean, r: number): CSSProperties {
  if (!hasData) return { color: "#cbd5e1" };
  if (r < 0) return { color: "#b91c1c", fontWeight: 700 };
  if (r < 0.1) return { color: "#c2410c" };
  if (r < 0.2) return { color: "#a16207" };
  return { color: "#15803d", fontWeight: 600 };
}

export default function RentabilidadDiaria() {
  const [meses, setMeses] = useState<string[]>([]);
  const [mes, setMes] = useState("");
  const [vendedorId, setVendedorId] = useState("");
  const [loadingOpts, setLoadingOpts] = useState(true);
  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState<Resp | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/erp-test/rentabilidad/diario/meses");
        const json = await r.json();
        if (!r.ok) { setError(json?.error || `Error HTTP ${r.status}`); return; }
        setMeses(json.meses || []);
        if (json.meses?.length) setMes(json.meses[0]);
      } catch (e: any) {
        setError(`No se pudieron cargar las opciones: ${e?.message || e}`);
      } finally {
        setLoadingOpts(false);
      }
    })();
  }, []);

  async function run() {
    if (!mes) return;
    setLoading(true);
    setError(null);
    setResp(null);
    try {
      const r = await fetch("/api/erp-test/rentabilidad/diario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mes, vendedorId: vendedorId || undefined }),
      });
      const json = await r.json();
      if (!r.ok) setError(json?.error || `Error HTTP ${r.status}`);
      else setResp(json);
    } catch (e: any) {
      setError(`Fallo de red: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  }

  const th: CSSProperties = { padding: "6px 8px", fontSize: 10.5, color: "#64748b", fontWeight: 700, borderBottom: "2px solid #e2e8f0", textTransform: "uppercase", letterSpacing: 0.3, whiteSpace: "nowrap" };
  const thNum: CSSProperties = { ...th, textAlign: "right" };
  const td: CSSProperties = { padding: "6px 8px", fontSize: 12, borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" };
  const num: CSSProperties = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };

  const vendedores = resp?.vendedores || [];

  return (
    <div>
      {/* Controls */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ fontSize: 13 }}>
            <span style={{ display: "block", fontWeight: 600, color: "#475569", marginBottom: 4 }}>Mes</span>
            <select value={mes} onChange={(e) => setMes(e.target.value)} disabled={loadingOpts}
              style={{ padding: "9px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13, background: "#fff", textTransform: "capitalize" }}>
              {meses.length === 0 && <option value="">{loadingOpts ? "Cargando…" : "—"}</option>}
              {meses.map((m) => <option key={m} value={m}>{mesLabel(m)}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 13 }}>
            <span style={{ display: "block", fontWeight: 600, color: "#475569", marginBottom: 4 }}>Vendedor</span>
            <select value={vendedorId} onChange={(e) => setVendedorId(e.target.value)}
              style={{ padding: "9px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13, background: "#fff", minWidth: 180 }}>
              <option value="">Todos</option>
              {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
            </select>
          </label>
          <button onClick={run} disabled={loading || !mes}
            style={{ padding: "10px 22px", fontSize: 14, fontWeight: 700, cursor: loading || !mes ? "default" : "pointer",
              borderRadius: 6, border: "none", background: loading || !mes ? "#94a3b8" : "#e11d48", color: "#fff" }}>
            {loading ? "Cargando…" : "Generar reporte"}
          </button>
        </div>
        <p style={{ margin: "12px 0 0", fontSize: 12, color: "#94a3b8" }}>
          Desde la réplica en Supabase (ventana móvil poblada en cada sync del ERP). Importe neto = ventas − devoluciones/rechazos − bonificaciones;
          costo neto = costo ventas − costo dev/rzo. Una fila por día. Montos en pesos (tipo de cambio aplicado).
          El selector de vendedor se llena tras generar el reporte.
        </p>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", borderRadius: 10, padding: 16, fontSize: 13, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {resp && (
        <div>
          {/* Summary bar */}
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", padding: "16px 20px", background: "#141456", color: "#fff", borderRadius: 10, marginBottom: 16 }}>
            <Stat label="Mes" value={mesLabel(resp.mes)} />
            <Stat label="Días con venta" value={String(resp.dias.length)} />
            <Stat label="Importe neto" value={mxn.format(resp.total.importe)} big />
            <Stat label="Utilidad bruta" value={mxn.format(resp.total.utilidad)} big />
            <Stat label="% Rentabilidad" value={pct.format(resp.total.rentabilidad)} big />
          </div>

          {resp.dias.length === 0 && (
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 20, fontSize: 13, color: "#64748b" }}>
              Sin ventas registradas en {mesLabel(resp.mes)}{resp.vendedorId ? " para ese vendedor" : ""}.
            </div>
          )}

          {resp.dias.length > 0 && (
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
                  <thead>
                    <tr>
                      <th style={{ ...th, position: "sticky", left: 0, background: "#fff", zIndex: 2 }}>Día</th>
                      <th style={thNum}>Importe neto</th>
                      <th style={thNum}>Costo</th>
                      <th style={thNum}>Utilidad</th>
                      <th style={{ ...thNum, color: "#141456" }}>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resp.dias.map((d) => {
                      const has = d.importe !== 0 || d.costo !== 0;
                      return (
                        <tr key={d.fecha}>
                          <td style={{ ...td, fontWeight: 600, position: "sticky", left: 0, background: "#fff", textTransform: "capitalize" }}>
                            {diaLabel(d.fecha)} <span style={{ color: "#94a3b8", fontWeight: 400 }}>· {d.fecha}</span>
                          </td>
                          <td style={num}>{money(d.importe)}</td>
                          <td style={{ ...num, color: "#64748b" }}>{money(d.costo)}</td>
                          <td style={{ ...num, fontWeight: 700 }}>{money(d.utilidad)}</td>
                          <td style={{ ...num, ...pctColor(has, d.rentabilidad) }}>
                            {has ? pct.format(d.rentabilidad) : "–"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "#141456", color: "#fff", fontWeight: 800 }}>
                      <td style={{ ...td, borderBottom: "none", color: "#fff", position: "sticky", left: 0, background: "#141456" }}>TOTAL MES</td>
                      <td style={{ ...num, borderBottom: "none", color: "#fff" }}>{mxn.format(resp.total.importe)}</td>
                      <td style={{ ...num, borderBottom: "none", color: "#c7d2fe" }}>{mxn.format(resp.total.costo)}</td>
                      <td style={{ ...num, borderBottom: "none", color: "#fff" }}>{mxn.format(resp.total.utilidad)}</td>
                      <td style={{ ...num, borderBottom: "none", color: "#fff" }}>{pct.format(resp.total.rentabilidad)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 11, opacity: 0.7, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: big ? 20 : 18, fontWeight: 800, marginTop: 2, textTransform: "capitalize" }}>{value}</div>
    </div>
  );
}
