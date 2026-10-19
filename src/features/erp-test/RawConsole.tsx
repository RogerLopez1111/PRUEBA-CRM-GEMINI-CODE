/**
 * Raw request console for the ERP API — sends an arbitrary provider/action/data
 * through the server proxy (/api/erp-test/call) and shows the raw JSON response.
 * Useful for exploring any endpoint from the mproerp docs.
 */
import { useState } from "react";

type Preset = {
  label: string;
  provider: string;
  action: string;
  data: Record<string, unknown>;
};

// Confirmed read-only actions from the mproerp v2 docs. `provider` differs per
// resource: clientes → "catalogos", productos → "producto", ventas → "venta".
const PRESETS: Preset[] = [
  {
    label: "Clientes — lista (5)",
    provider: "catalogos",
    action: "GetClienteLista",
    data: { busqueda: "", estado: "AC", clave: "", sucursal: "", grupo_comercial: "", vendedor: "", registros: "5" },
  },
  {
    label: "Cliente — por clave",
    provider: "catalogos",
    action: "GetCliente",
    data: { cliente: "0000000001" },
  },
  {
    label: "Productos — lista (5)",
    provider: "producto",
    action: "GetProductoLista",
    data: { registros: "5" },
  },
  {
    label: "Ventas — lista (5)",
    provider: "venta",
    action: "GetVentaLista",
    data: { fecha_inicio: "2026-10-01", fecha_final: "2026-10-16", registros: "5" },
  },
];

type ApiResult = {
  ok: boolean;
  httpStatus: number;
  sentRequest?: { provider: string; action: string; data: unknown };
  body: unknown;
  error?: string;
};

export default function RawConsole() {
  const [presetIdx, setPresetIdx] = useState(0);
  const [provider, setProvider] = useState(PRESETS[0].provider);
  const [action, setAction] = useState(PRESETS[0].action);
  const [dataText, setDataText] = useState(JSON.stringify(PRESETS[0].data, null, 2));
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  function applyPreset(idx: number) {
    const p = PRESETS[idx];
    setPresetIdx(idx);
    setProvider(p.provider);
    setAction(p.action);
    setDataText(JSON.stringify(p.data, null, 2));
    setParseError(null);
    setResult(null);
  }

  async function send() {
    let data: unknown;
    try {
      data = dataText.trim() ? JSON.parse(dataText) : {};
      setParseError(null);
    } catch (e: any) {
      setParseError(`JSON inválido en 'data': ${e?.message || e}`);
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/erp-test/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, action, data }),
      });
      const json = await res.json();
      setResult(json);
    } catch (e: any) {
      setResult({ ok: false, httpStatus: 0, body: null, error: `Fallo de red al llamar al proxy: ${e?.message || e}` });
    } finally {
      setLoading(false);
    }
  }

  const bodyData = (result?.body as any)?.data;
  let recordHint: string | null = null;
  if (bodyData) {
    if (Array.isArray(bodyData.cliente)) recordHint = `${bodyData.cliente.length} cliente(s)`;
    else if (Array.isArray(bodyData.producto)) recordHint = `${bodyData.producto.length} producto(s)`;
    else if (Array.isArray(bodyData.venta)) recordHint = `${bodyData.venta.length} venta(s)`;
    else if (bodyData.cliente) recordHint = "1 cliente";
    else if (bodyData.producto) recordHint = "1 producto";
  }

  return (
    <div>
      {/* Presets */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
        {PRESETS.map((p, i) => (
          <button
            key={p.label}
            onClick={() => applyPreset(i)}
            style={{
              padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
              borderRadius: 6, border: "1px solid",
              borderColor: presetIdx === i ? "#141456" : "#cbd5e1",
              background: presetIdx === i ? "#141456" : "#fff",
              color: presetIdx === i ? "#fff" : "#334155",
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Request form */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
          <label style={{ flex: "1 1 180px", fontSize: 13 }}>
            <span style={{ display: "block", fontWeight: 600, color: "#475569", marginBottom: 4 }}>provider</span>
            <input value={provider} onChange={(e) => setProvider(e.target.value)}
              style={{ width: "100%", padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13, boxSizing: "border-box" }} />
          </label>
          <label style={{ flex: "1 1 220px", fontSize: 13 }}>
            <span style={{ display: "block", fontWeight: 600, color: "#475569", marginBottom: 4 }}>action</span>
            <input value={action} onChange={(e) => setAction(e.target.value)}
              style={{ width: "100%", padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13, boxSizing: "border-box" }} />
          </label>
        </div>
        <label style={{ fontSize: 13 }}>
          <span style={{ display: "block", fontWeight: 600, color: "#475569", marginBottom: 4 }}>data (JSON)</span>
          <textarea value={dataText} onChange={(e) => setDataText(e.target.value)} rows={8} spellCheck={false}
            style={{ width: "100%", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13, fontFamily: "ui-monospace, monospace", boxSizing: "border-box", resize: "vertical" }} />
        </label>
        {parseError && <p style={{ color: "#dc2626", fontSize: 13, margin: "8px 0 0" }}>{parseError}</p>}

        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 16 }}>
          <button onClick={send} disabled={loading}
            style={{ padding: "10px 22px", fontSize: 14, fontWeight: 700, cursor: loading ? "default" : "pointer",
              borderRadius: 6, border: "none", background: loading ? "#94a3b8" : "#e11d48", color: "#fff" }}>
            {loading ? "Enviando…" : "Enviar petición"}
          </button>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>POST {provider} · {action}</span>
        </div>
      </div>

      {/* Response */}
      {result && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
            <strong style={{ fontSize: 14 }}>Respuesta</strong>
            <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
              background: result.ok ? "#dcfce7" : "#fee2e2", color: result.ok ? "#166534" : "#991b1b" }}>
              HTTP {result.httpStatus}
            </span>
            {recordHint && <span style={{ fontSize: 12, color: "#475569" }}>· {recordHint}</span>}
          </div>
          {result.error && <p style={{ color: "#dc2626", fontSize: 13, marginTop: 0 }}>{result.error}</p>}
          <pre style={{ margin: 0, maxHeight: 500, overflow: "auto", background: "#0f172a", color: "#e2e8f0",
            padding: 16, borderRadius: 8, fontSize: 12.5, lineHeight: 1.5 }}>
            {JSON.stringify(result.body, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
