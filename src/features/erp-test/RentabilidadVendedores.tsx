/**
 * REPORTE DE RENTABILIDAD (POR VENDEDOR) — the ManagementPro RPVNA06 report,
 * materialized. Reads ONLY the Supabase mirror table
 * erp_rentabilidad_vendedor_mensual (populated each ERP sync) via
 * /api/erp-test/rentabilidad/* — no live ERP API call, so it's instant and works
 * on the Vercel build. All vendedores at once, matrix vendedor × ENE…DIC; each
 * month cell is the net % rentabilidad, and the TOTAL block carries the pesos
 * (importe neto, costo, utilidad bruta, %). Net of devoluciones/rechazos and
 * bonificaciones, exactly like the ERP.
 */
import { useEffect, useState, type CSSProperties } from "react";

type Celda = { importe: number; costo: number; utilidad: number; rentabilidad: number };
type Vendedor = { id: string; nombre: string; meses: Celda[]; total: Celda };
type Resp = {
  anio: string;
  vendedores: Vendedor[];
  totalesMes: Celda[];
  total: Celda;
  vendedoresConVenta: number;
};

const MESES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
const mxn = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
const pct = new Intl.NumberFormat("es-MX", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });
const money = (n: number) => (n ? mxn.format(n) : "–");

// Color a % rentabilidad cell: red for negative/thin margins, deepening green as
// the margin improves. Empty cells (no sales) stay muted.
function pctColor(hasData: boolean, r: number): CSSProperties {
  if (!hasData) return { color: "#cbd5e1" };
  if (r < 0) return { color: "#b91c1c", fontWeight: 700 };
  if (r < 0.1) return { color: "#c2410c" };
  if (r < 0.2) return { color: "#a16207" };
  return { color: "#15803d", fontWeight: 600 };
}

export default function RentabilidadVendedores() {
  const [anios, setAnios] = useState<string[]>([]);
  const [anio, setAnio] = useState("");
  const [loadingOpts, setLoadingOpts] = useState(true);
  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState<Resp | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/erp-test/rentabilidad/anios");
        const json = await r.json();
        if (!r.ok) { setError(json?.error || `Error HTTP ${r.status}`); return; }
        setAnios(json.anios || []);
        if (json.anios?.length) setAnio(json.anios[0]);
      } catch (e: any) {
        setError(`No se pudieron cargar las opciones: ${e?.message || e}`);
      } finally {
        setLoadingOpts(false);
      }
    })();
  }, []);

  async function run() {
    if (!anio) return;
    setLoading(true);
    setError(null);
    setResp(null);
    try {
      const r = await fetch("/api/erp-test/rentabilidad/mensual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anio }),
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

  return (
    <div>
      {/* Controls */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ fontSize: 13 }}>
            <span style={{ display: "block", fontWeight: 600, color: "#475569", marginBottom: 4 }}>Año</span>
            <select value={anio} onChange={(e) => setAnio(e.target.value)} disabled={loadingOpts}
              style={{ padding: "9px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13, background: "#fff" }}>
              {anios.length === 0 && <option value="">{loadingOpts ? "Cargando…" : "—"}</option>}
              {anios.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <button onClick={run} disabled={loading || !anio}
            style={{ padding: "10px 22px", fontSize: 14, fontWeight: 700, cursor: loading || !anio ? "default" : "pointer",
              borderRadius: 6, border: "none", background: loading || !anio ? "#94a3b8" : "#e11d48", color: "#fff" }}>
            {loading ? "Cargando…" : "Generar reporte"}
          </button>
        </div>
        <p style={{ margin: "12px 0 0", fontSize: 12, color: "#94a3b8" }}>
          Desde la réplica en Supabase (poblada en cada sync del ERP). Importe neto = ventas − devoluciones/rechazos − bonificaciones;
          costo neto = costo ventas − costo dev/rzo. Cada celda = % de utilidad bruta del mes. Montos en pesos (tipo de cambio aplicado).
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
            <Stat label="Año" value={resp.anio} />
            <Stat label="Vendedores con venta" value={String(resp.vendedoresConVenta)} />
            <Stat label="Importe neto" value={mxn.format(resp.total.importe)} big />
            <Stat label="Utilidad bruta" value={mxn.format(resp.total.utilidad)} big />
            <Stat label="% Rentabilidad" value={pct.format(resp.total.rentabilidad)} big />
          </div>

          {resp.vendedores.length === 0 && (
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 20, fontSize: 13, color: "#64748b" }}>
              Sin ventas registradas en {resp.anio}.
            </div>
          )}

          {resp.vendedores.length > 0 && (
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1250 }}>
                  <thead>
                    <tr>
                      <th style={{ ...th, position: "sticky", left: 0, background: "#fff", zIndex: 2 }}>Vendedor</th>
                      {MESES.map((m) => <th key={m} style={thNum}>{m}</th>)}
                      <th style={{ ...thNum, borderLeft: "2px solid #e2e8f0" }}>Importe neto</th>
                      <th style={thNum}>Costo</th>
                      <th style={thNum}>Utilidad</th>
                      <th style={{ ...thNum, color: "#141456" }}>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resp.vendedores.map((v) => (
                      <tr key={v.id}>
                        <td style={{ ...td, fontWeight: 600, position: "sticky", left: 0, background: "#fff" }}>
                          {v.nombre} <span style={{ color: "#94a3b8", fontWeight: 400 }}>· {v.id}</span>
                        </td>
                        {v.meses.map((c, i) => {
                          const has = c.importe !== 0 || c.costo !== 0;
                          return (
                            <td key={i} style={{ ...num, ...pctColor(has, c.rentabilidad) }} title={has ? `Importe ${money(c.importe)} · Utilidad ${money(c.utilidad)}` : "Sin ventas"}>
                              {has ? pct.format(c.rentabilidad) : "–"}
                            </td>
                          );
                        })}
                        <td style={{ ...num, borderLeft: "2px solid #e2e8f0" }}>{money(v.total.importe)}</td>
                        <td style={{ ...num, color: "#64748b" }}>{money(v.total.costo)}</td>
                        <td style={{ ...num, fontWeight: 700 }}>{money(v.total.utilidad)}</td>
                        <td style={{ ...num, ...pctColor(v.total.importe !== 0, v.total.rentabilidad) }}>
                          {v.total.importe !== 0 ? pct.format(v.total.rentabilidad) : "–"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "#141456", color: "#fff", fontWeight: 800 }}>
                      <td style={{ ...td, borderBottom: "none", color: "#fff", position: "sticky", left: 0, background: "#141456" }}>TOTAL GENERAL</td>
                      {resp.totalesMes.map((c, i) => (
                        <td key={i} style={{ ...num, borderBottom: "none", color: "#fff" }}>
                          {c.importe !== 0 || c.costo !== 0 ? pct.format(c.rentabilidad) : "–"}
                        </td>
                      ))}
                      <td style={{ ...num, borderBottom: "none", color: "#fff", borderLeft: "2px solid #3730a3" }}>{mxn.format(resp.total.importe)}</td>
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
      <div style={{ fontSize: big ? 20 : 18, fontWeight: 800, marginTop: 2 }}>{value}</div>
    </div>
  );
}
