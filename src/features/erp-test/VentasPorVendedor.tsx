/**
 * Live "ventas por vendedor" report — pulled on demand from the ERP API via
 * /api/erp-test/ventas. No data is mirrored into Supabase; the server queries
 * the ERP once per seller (date-ranged) and caches each result ~10 min.
 */
import { useState, type CSSProperties } from "react";

type Row = {
  vendedorId: string;
  vendedorName: string;
  count: number;
  subtotal: number;
  total: number;
  truncated: boolean;
  error?: string;
};

type Resp = {
  desde: string;
  hasta: string;
  vendedores: Row[];
  grand: { count: number; subtotal: number; total: number };
  meta: { vendedorCount: number; withSales: number; errors: number; elapsedMs: number };
};

const mxn = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

function firstOfMonthISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function VentasPorVendedor() {
  const [desde, setDesde] = useState(firstOfMonthISO());
  const [hasta, setHasta] = useState(todayISO());
  const [vendedor, setVendedor] = useState("");
  const [loading, setLoading] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [resp, setResp] = useState<Resp | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    setResp(null);
    try {
      const r = await fetch("/api/erp-test/ventas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ desde, hasta, vendedor: vendedor.trim() || undefined }),
      });
      const json = await r.json();
      if (!r.ok) {
        setError(json?.error || `Error HTTP ${r.status}`);
      } else {
        setResp(json);
      }
    } catch (e: any) {
      setError(`Fallo de red: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  }

  // Re-query ONLY the sellers that errored, then merge the fresh rows back into
  // the existing table (same date range as the shown data, not the inputs).
  async function retryFailed() {
    if (!resp) return;
    const failedIds = resp.vendedores.filter((v) => v.error).map((v) => v.vendedorId);
    if (failedIds.length === 0) return;

    setRetrying(true);
    setError(null);
    try {
      const r = await fetch("/api/erp-test/ventas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ desde: resp.desde, hasta: resp.hasta, vendedores: failedIds }),
      });
      const json = await r.json();
      if (!r.ok) {
        setError(json?.error || `Error HTTP ${r.status}`);
        return;
      }
      const fresh = new Map<string, Row>((json.vendedores as Row[]).map((v) => [v.vendedorId, v]));
      const merged = resp.vendedores.map((v) => fresh.get(v.vendedorId) ?? v);
      merged.sort((a, b) => b.total - a.total);
      const grand = merged.reduce(
        (acc, v) => ({ count: acc.count + v.count, subtotal: acc.subtotal + v.subtotal, total: acc.total + v.total }),
        { count: 0, subtotal: 0, total: 0 }
      );
      setResp({
        ...resp,
        vendedores: merged,
        grand,
        meta: {
          ...resp.meta,
          withSales: merged.filter((v) => v.count > 0).length,
          errors: merged.filter((v) => v.error).length,
          elapsedMs: json.meta?.elapsedMs ?? resp.meta.elapsedMs,
        },
      });
    } catch (e: any) {
      setError(`Fallo de red al reintentar: ${e?.message || e}`);
    } finally {
      setRetrying(false);
    }
  }

  const th: CSSProperties = { textAlign: "left", padding: "10px 12px", fontSize: 12, color: "#64748b", fontWeight: 700, borderBottom: "2px solid #e2e8f0", textTransform: "uppercase", letterSpacing: 0.3 };
  const td: CSSProperties = { padding: "10px 12px", fontSize: 13, borderBottom: "1px solid #f1f5f9" };
  const num: CSSProperties = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };

  return (
    <div>
      {/* Controls */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ fontSize: 13 }}>
            <span style={{ display: "block", fontWeight: 600, color: "#475569", marginBottom: 4 }}>Desde</span>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
              style={{ padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13 }} />
          </label>
          <label style={{ fontSize: 13 }}>
            <span style={{ display: "block", fontWeight: 600, color: "#475569", marginBottom: 4 }}>Hasta</span>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)}
              style={{ padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13 }} />
          </label>
          <label style={{ fontSize: 13, flex: "1 1 200px" }}>
            <span style={{ display: "block", fontWeight: 600, color: "#475569", marginBottom: 4 }}>Vendedor (clave, opcional)</span>
            <input value={vendedor} onChange={(e) => setVendedor(e.target.value)} placeholder="vacío = todos los activos"
              style={{ width: "100%", padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13, boxSizing: "border-box" }} />
          </label>
          <button onClick={run} disabled={loading}
            style={{ padding: "10px 22px", fontSize: 14, fontWeight: 700, cursor: loading ? "default" : "pointer",
              borderRadius: 6, border: "none", background: loading ? "#94a3b8" : "#e11d48", color: "#fff" }}>
            {loading ? "Consultando ERP…" : "Calcular ventas"}
          </button>
        </div>
        <p style={{ margin: "12px 0 0", fontSize: 12, color: "#94a3b8" }}>
          En vivo desde el ERP (sin réplica en Supabase). La primera consulta del rango tarda unos segundos; luego se sirve de caché ~10 min.
        </p>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", borderRadius: 10, padding: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      {resp && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
          {/* Summary bar */}
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", padding: "16px 20px", background: "#141456", color: "#fff" }}>
            <Stat label="Total vendido" value={mxn.format(resp.grand.total)} big />
            <Stat label="Subtotal (sin IVA)" value={mxn.format(resp.grand.subtotal)} />
            <Stat label="Ventas" value={String(resp.grand.count)} />
            <Stat label="Vendedores con venta" value={`${resp.meta.withSales} / ${resp.meta.vendedorCount}`} />
            <Stat label="Tiempo" value={`${(resp.meta.elapsedMs / 1000).toFixed(1)} s`} />
          </div>

          {resp.meta.errors > 0 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "10px 20px", background: "#fffbeb", color: "#92400e", fontSize: 12 }}>
              <span>
                {resp.meta.errors} vendedor(es) devolvieron error del ERP (fila marcada ⚠). Suele ser saturación momentánea.
              </span>
              <button onClick={retryFailed} disabled={retrying}
                style={{ padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: retrying ? "default" : "pointer",
                  borderRadius: 6, border: "1px solid #d97706", background: retrying ? "#fcd34d" : "#f59e0b", color: "#422006", whiteSpace: "nowrap" }}>
                {retrying ? "Reintentando…" : `Reintentar fallidos (${resp.meta.errors})`}
              </button>
            </div>
          )}

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
              <thead>
                <tr>
                  <th style={th}>#</th>
                  <th style={th}>Vendedor</th>
                  <th style={{ ...th, textAlign: "right" }}>Ventas</th>
                  <th style={{ ...th, textAlign: "right" }}>Subtotal</th>
                  <th style={{ ...th, textAlign: "right" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {resp.vendedores.map((v, i) => (
                  <tr key={v.vendedorId} style={{ background: v.error ? "#fffbeb" : v.count === 0 ? "#fafafa" : "#fff" }}>
                    <td style={{ ...td, color: "#94a3b8" }}>{i + 1}</td>
                    <td style={td}>
                      <span style={{ fontWeight: 600 }}>{v.vendedorName}</span>
                      <span style={{ color: "#cbd5e1", fontSize: 11, marginLeft: 8 }}>{v.vendedorId}</span>
                      {v.error && <span style={{ color: "#b45309", fontSize: 11, marginLeft: 8 }}>⚠ {v.error}</span>}
                      {v.truncated && <span style={{ color: "#b45309", fontSize: 11, marginLeft: 8 }}>⚠ truncado</span>}
                    </td>
                    <td style={num}>{v.count}</td>
                    <td style={{ ...num, color: "#64748b" }}>{mxn.format(v.subtotal)}</td>
                    <td style={{ ...num, fontWeight: 700 }}>{mxn.format(v.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "#f8fafc", fontWeight: 700 }}>
                  <td style={td}></td>
                  <td style={td}>TOTAL</td>
                  <td style={num}>{resp.grand.count}</td>
                  <td style={num}>{mxn.format(resp.grand.subtotal)}</td>
                  <td style={num}>{mxn.format(resp.grand.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 11, opacity: 0.7, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: big ? 24 : 18, fontWeight: 800, marginTop: 2 }}>{value}</div>
    </div>
  );
}
