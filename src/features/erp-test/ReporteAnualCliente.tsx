/**
 * REPORTE ANALÍTICO DE VENTAS ANUAL (CLIENTE) — the ManagementPro report,
 * materialized. Reads ONLY the Supabase mirror table erp_ventas_cliente_mensual
 * (populated each ERP sync) via /api/erp-test/reporte/* — no live ERP API call,
 * so it's instant and works on the Vercel build. Clients grouped by segmento,
 * importe (sin IVA, facturado) per month ENE…DIC + TOTAL.
 */
import { useEffect, useState, type CSSProperties } from "react";

type Vendedor = { id: string; name: string };
type Cliente = { clave: string; nombre: string; razonSocial: string; meses: number[]; total: number };
type Segmento = { id: string; name: string; clientes: Cliente[]; totalesMes: number[]; total: number };
type Resp = {
  vendedor: { id: string };
  anio: string;
  segmentos: Segmento[];
  totalesMes: number[];
  total: number;
  clientesConVenta: number;
};

const MESES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
const mxn = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
const money = (n: number) => (n ? mxn.format(n) : "–");

export default function ReporteAnualCliente() {
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [anios, setAnios] = useState<string[]>([]);
  const [vendedor, setVendedor] = useState("");
  const [anio, setAnio] = useState("");
  const [loadingOpts, setLoadingOpts] = useState(true);
  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState<Resp | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/erp-test/reporte/vendedores");
        const json = await r.json();
        if (!r.ok) { setError(json?.error || `Error HTTP ${r.status}`); return; }
        setVendedores(json.vendedores || []);
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
    if (!vendedor || !anio) return;
    setLoading(true);
    setError(null);
    setResp(null);
    try {
      const r = await fetch("/api/erp-test/reporte/anual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendedor, anio }),
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

  const vendedorName = vendedores.find((v) => v.id === vendedor)?.name || vendedor;

  const th: CSSProperties = { padding: "6px 8px", fontSize: 10.5, color: "#64748b", fontWeight: 700, borderBottom: "2px solid #e2e8f0", textTransform: "uppercase", letterSpacing: 0.3, whiteSpace: "nowrap" };
  const thNum: CSSProperties = { ...th, textAlign: "right" };
  const td: CSSProperties = { padding: "6px 8px", fontSize: 12, borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" };
  const num: CSSProperties = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };

  return (
    <div>
      {/* Controls */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ fontSize: 13, flex: "1 1 300px" }}>
            <span style={{ display: "block", fontWeight: 600, color: "#475569", marginBottom: 4 }}>Vendedor</span>
            <select value={vendedor} onChange={(e) => setVendedor(e.target.value)} disabled={loadingOpts}
              style={{ width: "100%", padding: "9px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13, background: "#fff", boxSizing: "border-box" }}>
              <option value="">{loadingOpts ? "Cargando…" : "— Selecciona un vendedor —"}</option>
              {vendedores.map((v) => <option key={v.id} value={v.id}>{v.name} · {v.id}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 13 }}>
            <span style={{ display: "block", fontWeight: 600, color: "#475569", marginBottom: 4 }}>Año</span>
            <select value={anio} onChange={(e) => setAnio(e.target.value)} disabled={loadingOpts}
              style={{ padding: "9px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13, background: "#fff" }}>
              {anios.length === 0 && <option value="">—</option>}
              {anios.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <button onClick={run} disabled={loading || !vendedor || !anio}
            style={{ padding: "10px 22px", fontSize: 14, fontWeight: 700, cursor: loading || !vendedor || !anio ? "default" : "pointer",
              borderRadius: 6, border: "none", background: loading || !vendedor || !anio ? "#94a3b8" : "#e11d48", color: "#fff" }}>
            {loading ? "Cargando…" : "Generar reporte"}
          </button>
        </div>
        <p style={{ margin: "12px 0 0", fontSize: 12, color: "#94a3b8" }}>
          Desde la réplica en Supabase (poblada en cada sync del ERP). Importes facturados (FA), sin IVA. Se omiten clientes sin ventas en el año.
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
            <Stat label="Vendedor" value={vendedorName} big />
            <Stat label="Año" value={resp.anio} />
            <Stat label="Clientes con venta" value={String(resp.clientesConVenta)} />
            <Stat label="Total anual" value={mxn.format(resp.total)} big />
          </div>

          {resp.segmentos.length === 0 && (
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 20, fontSize: 13, color: "#64748b" }}>
              Sin ventas registradas para este vendedor en {resp.anio}.
            </div>
          )}

          {resp.segmentos.map((s) => (
            <div key={s.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: "#f1f5f9", borderBottom: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#141456", letterSpacing: 0.5 }}>SEGMENTO</span>
                <span style={{ fontSize: 14, fontWeight: 800 }}>{s.id} · {s.name}</span>
                <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: "#475569" }}>
                  {s.clientes.length} cliente{s.clientes.length === 1 ? "" : "s"} · {mxn.format(s.total)}
                </span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1100 }}>
                  <thead>
                    <tr>
                      <th style={{ ...th, position: "sticky", left: 0, background: "#fff" }}>Clave</th>
                      <th style={th}>Descripción</th>
                      {MESES.map((m) => <th key={m} style={thNum}>{m}</th>)}
                      <th style={{ ...thNum, color: "#141456" }}>TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.clientes.map((c) => (
                      <tr key={c.clave}>
                        <td style={{ ...td, color: "#64748b", fontVariantNumeric: "tabular-nums", position: "sticky", left: 0, background: "#fff" }}>{c.clave}</td>
                        <td style={{ ...td, fontWeight: 600 }}>{c.nombre || c.razonSocial || "—"}</td>
                        {c.meses.map((v, i) => (
                          <td key={i} style={{ ...num, color: v ? "#0f172a" : "#cbd5e1" }}>{money(v)}</td>
                        ))}
                        <td style={{ ...num, fontWeight: 700 }}>{mxn.format(c.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "#f8fafc", fontWeight: 700 }}>
                      <td style={{ ...td, position: "sticky", left: 0, background: "#f8fafc" }} colSpan={2}>TOTAL: {s.clientes.length}</td>
                      {s.totalesMes.map((v, i) => <td key={i} style={num}>{money(v)}</td>)}
                      <td style={num}>{mxn.format(s.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))}

          {/* Grand total across segmentos */}
          {resp.segmentos.length > 0 && (
            <div style={{ background: "#141456", color: "#fff", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1100 }}>
                  <tbody>
                    <tr style={{ fontWeight: 800 }}>
                      <td style={{ ...td, borderBottom: "none", color: "#fff", position: "sticky", left: 0, background: "#141456" }} colSpan={2}>TOTAL GENERAL</td>
                      {resp.totalesMes.map((v, i) => (
                        <td key={i} style={{ ...num, borderBottom: "none", color: "#fff" }}>{money(v)}</td>
                      ))}
                      <td style={{ ...num, borderBottom: "none", color: "#fff" }}>{mxn.format(resp.total)}</td>
                    </tr>
                  </tbody>
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
