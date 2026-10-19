/**
 * Live "clientes por vendedor, agrupados por segmento" roster — the client list
 * ManagementPro gives per seller, grouped by segmento. Pulled on demand from the
 * ERP API via /api/erp-test/clientes-por-segmento. No Supabase mirror: the seller
 * list and each client's segmento come straight from the WServices HTTP API.
 */
import { useEffect, useState, type CSSProperties } from "react";

type Vendedor = { id: string; name: string };
type Cliente = { clave: string; nombre: string; razonSocial: string; error?: string };
type Segmento = { id: string; name: string; count: number; clientes: Cliente[] };
type Resp = {
  vendedor: Vendedor;
  segmentos: Segmento[];
  totals: { clientes: number; segmentos: number };
  meta: { errors: number; truncated: boolean; elapsedMs: number };
};

export default function ClientesPorSegmento() {
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [vendedor, setVendedor] = useState("");
  const [loadingVend, setLoadingVend] = useState(true);
  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState<Resp | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load the seller dropdown once (live from the ERP catalog).
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/erp-test/vendedores");
        const json = await r.json();
        if (!r.ok) setError(json?.error || `Error HTTP ${r.status}`);
        else setVendedores(json.vendedores || []);
      } catch (e: any) {
        setError(`No se pudo cargar vendedores: ${e?.message || e}`);
      } finally {
        setLoadingVend(false);
      }
    })();
  }, []);

  async function run() {
    if (!vendedor) return;
    setLoading(true);
    setError(null);
    setResp(null);
    try {
      const r = await fetch("/api/erp-test/clientes-por-segmento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendedor }),
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

  const th: CSSProperties = { textAlign: "left", padding: "8px 12px", fontSize: 11, color: "#64748b", fontWeight: 700, borderBottom: "2px solid #e2e8f0", textTransform: "uppercase", letterSpacing: 0.3 };
  const td: CSSProperties = { padding: "8px 12px", fontSize: 13, borderBottom: "1px solid #f1f5f9" };

  return (
    <div>
      {/* Controls */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ fontSize: 13, flex: "1 1 320px" }}>
            <span style={{ display: "block", fontWeight: 600, color: "#475569", marginBottom: 4 }}>Vendedor</span>
            <select
              value={vendedor}
              onChange={(e) => setVendedor(e.target.value)}
              disabled={loadingVend}
              style={{ width: "100%", padding: "9px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13, background: "#fff", boxSizing: "border-box" }}
            >
              <option value="">{loadingVend ? "Cargando vendedores…" : "— Selecciona un vendedor —"}</option>
              {vendedores.map((v) => (
                <option key={v.id} value={v.id}>{v.name} · {v.id}</option>
              ))}
            </select>
          </label>
          <button onClick={run} disabled={loading || !vendedor}
            style={{ padding: "10px 22px", fontSize: 14, fontWeight: 700, cursor: loading || !vendedor ? "default" : "pointer",
              borderRadius: 6, border: "none", background: loading || !vendedor ? "#94a3b8" : "#e11d48", color: "#fff" }}>
            {loading ? "Consultando ERP…" : "Generar reporte"}
          </button>
        </div>
        <p style={{ margin: "12px 0 0", fontSize: 12, color: "#94a3b8" }}>
          En vivo desde el ERP (sin réplica en Supabase). Se consulta la lista de clientes del vendedor y luego el segmento de cada uno — unos segundos para vendedores con muchos clientes.
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
            <Stat label="Vendedor" value={resp.vendedor.name} big />
            <Stat label="Clientes" value={String(resp.totals.clientes)} />
            <Stat label="Segmentos" value={String(resp.totals.segmentos)} />
            <Stat label="Tiempo" value={`${(resp.meta.elapsedMs / 1000).toFixed(1)} s`} />
          </div>

          {resp.meta.errors > 0 && (
            <div style={{ padding: "10px 20px", background: "#fffbeb", color: "#92400e", fontSize: 12, borderRadius: 10, marginBottom: 16 }}>
              {resp.meta.errors} cliente(s) sin segmento (el ERP devolvió error o estaba ocupado); aparecen en “SIN SEGMENTO (no obtenido)”.
            </div>
          )}

          {/* One block per segmento */}
          {resp.segmentos.map((s) => (
            <div key={s.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: "#f1f5f9", borderBottom: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#141456", letterSpacing: 0.5 }}>SEGMENTO</span>
                <span style={{ fontSize: 14, fontWeight: 800 }}>{s.id} · {s.name}</span>
                <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: "#475569", background: "#e2e8f0", padding: "2px 10px", borderRadius: 999 }}>
                  {s.count} cliente{s.count === 1 ? "" : "s"}
                </span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
                  <thead>
                    <tr>
                      <th style={{ ...th, width: 40 }}>#</th>
                      <th style={{ ...th, width: 120 }}>Clave</th>
                      <th style={th}>Nombre</th>
                      <th style={th}>Razón social</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.clientes.map((c, i) => (
                      <tr key={c.clave || i}>
                        <td style={{ ...td, color: "#94a3b8" }}>{i + 1}</td>
                        <td style={{ ...td, color: "#64748b", fontVariantNumeric: "tabular-nums" }}>{c.clave}</td>
                        <td style={{ ...td, fontWeight: 600 }}>
                          {c.nombre || <span style={{ color: "#cbd5e1" }}>—</span>}
                          {c.error && <span style={{ color: "#b45309", fontSize: 11, marginLeft: 8 }}>⚠ {c.error}</span>}
                        </td>
                        <td style={{ ...td, color: "#475569" }}>{c.razonSocial || <span style={{ color: "#cbd5e1" }}>—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
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
