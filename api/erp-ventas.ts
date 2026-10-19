import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import { erpConfigured } from "./erp-client.js";
import { aggregateVentas, ISO_DATE } from "./erp-ventas-core.js";

/**
 * Test-only ventas-by-vendedor endpoint for the ?erp-test screen (no auth).
 * The real, role-scoped endpoint lives in api/index.ts (/api/performance/ventas)
 * and shares the same aggregation core (api/erp-ventas-core.ts).
 */
const router = Router();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

router.post("/api/erp-test/ventas", async (req, res) => {
  if (!erpConfigured()) {
    res.status(500).json({ error: "MPRO_API_URL / MPRO_API_KEY no están configurados en .env" });
    return;
  }

  const { desde, hasta, vendedor, vendedores: vendedorList } = req.body ?? {};
  if (!ISO_DATE.test(String(desde || "")) || !ISO_DATE.test(String(hasta || ""))) {
    res.status(400).json({ error: "desde y hasta son obligatorios con formato YYYY-MM-DD." });
    return;
  }

  const started = Date.now();
  try {
    // Which sellers to compute:
    //  - `vendedores` (array of claves) → just those (used by "reintentar fallidos")
    //  - `vendedor` (single clave)      → just that one
    //  - neither                        → all active sellers
    // All paths go through the vendedores table so we can label each row.
    let sellers: { id: string; name: string }[];
    if (Array.isArray(vendedorList) && vendedorList.length > 0) {
      const ids = [...new Set(vendedorList.map((v: any) => String(v)).filter(Boolean))];
      const { data } = await supabase
        .from("vendedores")
        .select("Vn_Cve_Vendedor, Vn_Descripcion")
        .in("Vn_Cve_Vendedor", ids);
      const nameById = new Map((data || []).map((v) => [String(v.Vn_Cve_Vendedor), v.Vn_Descripcion]));
      sellers = ids.map((id) => ({ id, name: nameById.get(id) || id }));
    } else if (vendedor) {
      const { data } = await supabase
        .from("vendedores")
        .select("Vn_Cve_Vendedor, Vn_Descripcion")
        .eq("Vn_Cve_Vendedor", String(vendedor))
        .maybeSingle();
      sellers = [{ id: String(vendedor), name: data?.Vn_Descripcion || String(vendedor) }];
    } else {
      const { data, error } = await supabase
        .from("vendedores")
        .select("Vn_Cve_Vendedor, Vn_Descripcion")
        .eq("Es_Cve_Estado", "AC")
        .order("Vn_Descripcion", { ascending: true });
      if (error) {
        res.status(500).json({ error: `No se pudo leer vendedores: ${error.message}` });
        return;
      }
      sellers = (data || []).map((v) => ({ id: String(v.Vn_Cve_Vendedor), name: v.Vn_Descripcion }));
    }

    const results = await aggregateVentas(sellers, desde, hasta);

    // Sellers with sales first (desc by total), then the zero/erroring ones.
    results.sort((a, b) => b.total - a.total);

    const grand = results.reduce(
      (acc, r) => ({ count: acc.count + r.count, subtotal: acc.subtotal + r.subtotal, total: acc.total + r.total }),
      { count: 0, subtotal: 0, total: 0 }
    );

    res.json({
      desde,
      hasta,
      vendedores: results,
      grand,
      meta: {
        vendedorCount: sellers.length,
        withSales: results.filter((r) => r.count > 0).length,
        errors: results.filter((r) => r.error).length,
        elapsedMs: Date.now() - started,
      },
    });
  } catch (err: any) {
    res.status(502).json({ error: `Error consultando ventas del ERP: ${err?.message || String(err)}` });
  }
});

export default router;
