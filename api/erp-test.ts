import { Router } from "express";
import { callErp, erpConfigured } from "./erp-client.js";

/**
 * Test-only raw proxy to the ManagementPro (mproerp) WServices HTTP API.
 *
 * Why a server-side proxy instead of calling the ERP straight from the browser:
 *   1. The apikey must never ship to the client — it stays here, read from .env.
 *   2. The ERP host sends no CORS headers, so a browser fetch would be blocked.
 *
 * This router is intentionally isolated: it is NOT wired into any CRM flow and
 * has no auth gate — it exists only so the /erp-test screen can grab sample data
 * while we evaluate the API. Remove or lock down before any production use.
 */
const router = Router();

router.post("/api/erp-test/call", async (req, res) => {
  if (!erpConfigured()) {
    res.status(500).json({
      error: "MPRO_API_URL / MPRO_API_KEY no están configurados en .env",
    });
    return;
  }

  const { provider, action, data } = req.body ?? {};
  if (!action || typeof action !== "string") {
    res.status(400).json({ error: "Falta 'action' (string)." });
    return;
  }

  const resolvedProvider =
    typeof provider === "string" && provider.trim() ? provider : "catalogos";

  try {
    const upstream = await callErp(resolvedProvider, action, data ?? {});
    res.status(200).json({
      ok: upstream.ok,
      httpStatus: upstream.httpStatus,
      // Echo back what we sent, minus the apikey, so the screen can show the
      // exact request shape without ever exposing the secret.
      sentRequest: { provider: resolvedProvider, action, data: data ?? {} },
      body: upstream.body,
    });
  } catch (err: any) {
    res.status(502).json({
      error: `No se pudo conectar al ERP: ${err?.message || String(err)}`,
    });
  }
});

export default router;
