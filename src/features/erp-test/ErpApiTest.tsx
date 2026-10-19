/**
 * Standalone ERP API test screen (shell).
 *
 * Rendered in place of <App/> when the URL has `?erp-test` (see main.tsx), so it
 * is fully isolated: no login, no AppDataProvider, no shared state. Two tabs:
 *   • Ventas por vendedor    — live sales-by-seller aggregation (the real goal)
 *   • Clientes por segmento  — seller's client roster grouped by segmento (live)
 *   • Reporte anual          — materialized annual sales matrix (from the sync)
 *   • Consola API            — raw request/response explorer
 */
import { useState } from "react";
import VentasPorVendedor from "./VentasPorVendedor";
import ClientesPorSegmento from "./ClientesPorSegmento";
import ReporteAnualCliente from "./ReporteAnualCliente";
import RawConsole from "./RawConsole";

type Tab = "ventas" | "clientes" | "reporte" | "consola";

export default function ErpApiTest() {
  const [tab, setTab] = useState<Tab>("ventas");

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", color: "#0f172a", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 20px 64px" }}>
        <header style={{ marginBottom: 20 }}>
          <div style={{ display: "inline-block", background: "#141456", color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: 1, padding: "4px 10px", borderRadius: 4, marginBottom: 10 }}>
            PANTALLA DE PRUEBA · ERP API
          </div>
          <h1 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 800 }}>ManagementPro WServices — Test</h1>
          <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>
            Datos en vivo del ERP vía el proxy del servidor. Aislado del CRM — sin réplica en Supabase.
          </p>
        </header>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "1px solid #e2e8f0" }}>
          {([["ventas", "Ventas por vendedor"], ["clientes", "Clientes por segmento"], ["reporte", "Reporte anual"], ["consola", "Consola API"]] as [Tab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                padding: "10px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer",
                background: "none", border: "none", borderBottom: "3px solid",
                borderColor: tab === key ? "#e11d48" : "transparent",
                color: tab === key ? "#0f172a" : "#94a3b8", marginBottom: -1,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "ventas" ? <VentasPorVendedor /> : tab === "clientes" ? <ClientesPorSegmento /> : tab === "reporte" ? <ReporteAnualCliente /> : <RawConsole />}
      </div>
    </div>
  );
}
