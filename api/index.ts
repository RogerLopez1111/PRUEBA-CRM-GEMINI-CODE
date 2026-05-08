import 'dotenv/config';
import express from "express";
import { createClient } from "@supabase/supabase-js";

// Server runs queries on behalf of users authenticated by our own login route,
// so we use the service role key (server-only secret). This bypasses RLS by
// design — RLS will be added later as defense-in-depth, not as the auth boundary.
// Never expose SUPABASE_SERVICE_ROLE_KEY to the browser.
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// ERP clients have all-numeric IDs (e.g. "0000000180"); CRM prospects have random alphanumeric IDs
const isErpId = (id: string) => /^\d+$/.test(id);

async function getSucursalesMap(): Promise<Record<string, string>> {
  const { data } = await supabase.from("sucursales").select("Sc_Cve_Sucursal, Sc_Descripcion");
  const map: Record<string, string> = {};
  for (const s of data || []) map[String(s.Sc_Cve_Sucursal)] = s.Sc_Descripcion;
  return map;
}

async function getSegmentosMap(): Promise<Record<string, string>> {
  const { data } = await supabase.from("segmentos").select("Sg_Cve_Segmento, Sg_Descripcion");
  const map: Record<string, string> = {};
  for (const s of data || []) map[String(s.Sg_Cve_Segmento)] = s.Sg_Descripcion;
  return map;
}

type LeadStatus =
  | "CONTACTADO"
  | "ASIGNADO"
  | "NEGOCIACION"
  | "COTIZADO"
  | "FACTURADO"
  | "ENTREGADO"
  | "RECHAZADO";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getUsersWithPerformance() {
  const { data: vendedores } = await supabase.from("vendedores").select("*").eq("Es_Cve_Estado", "AC");
  if (!vendedores) return [];

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  return Promise.all(
    vendedores.map(async (v) => {
      const [closedLeadsResult, totalAssignedResult, activeLeadsResult, metaResult] =
        await Promise.all([
          supabase
            .from("leads")
            .select("Cl_Valor_CRM")
            .eq("Vn_Cve_Vendedor", v.Vn_Cve_Vendedor)
            .in("Cl_Status_CRM", ["FACTURADO", "ENTREGADO"]),
          supabase
            .from("leads")
            .select("*", { count: "exact", head: true })
            .eq("Vn_Cve_Vendedor", v.Vn_Cve_Vendedor),
          supabase
            .from("leads")
            .select("Cl_Valor_CRM")
            .eq("Vn_Cve_Vendedor", v.Vn_Cve_Vendedor)
            .neq("Cl_Status_CRM", "FACTURADO")
            .neq("Cl_Status_CRM", "ENTREGADO")
            .neq("Cl_Status_CRM", "RECHAZADO"),
          supabase
            .from("vendedor_metas")
            .select("meta")
            .eq("Vn_Cve_Vendedor", v.Vn_Cve_Vendedor)
            .eq("year", currentYear)
            .eq("month", currentMonth)
            .maybeSingle(),
        ]);

      const closedLeads = closedLeadsResult.data;
      const activeLeads = activeLeadsResult.data;
      const totalAssigned = totalAssignedResult.count;

      const totalClosed = closedLeads?.length || 0;
      const totalValue = closedLeads?.reduce((s, l) => s + (l.Cl_Valor_CRM || 0), 0) || 0;
      const pipelineValue = activeLeads?.reduce((s, l) => s + (l.Cl_Valor_CRM || 0), 0) || 0;

      return {
        id: v.Vn_Cve_Vendedor,
        name: v.Vn_Descripcion,
        email: v.Vn_Email,
        role: v.Vn_Perfil as "Admin" | "Seller",
        sucursalId: v.Sc_Cve_Sucursal != null ? String(v.Sc_Cve_Sucursal) : "",
        performance: {
          totalClosed,
          totalValue,
          conversionRate: totalAssigned ? totalClosed / totalAssigned : 0,
          salesGoal: metaResult.data?.meta || 0,
        },
        workload: {
          activeLeads: activeLeads?.length || 0,
          pipelineValue,
        },
      };
    })
  );
}

async function getLeadsWithHistory() {
  const [leadsResult, sucursalesMap, segmentosMap] = await Promise.all([
    supabase
      .from("leads")
      .select(`
        *,
        clientes(Cl_Contacto_1, Cl_email_contacto_1, Cl_Razon_Social),
        lead_history(*, rechazo_motivos(descripcion))
      `)
      .order("Cl_CreatedAt_CRM", { ascending: false }),
    getSucursalesMap(),
    getSegmentosMap(),
  ]);

  const leadsData = leadsResult.data;
  if (!leadsData) return [];

  return leadsData.map((l) => ({
    id: l.id,
    clientId: l.Cl_Cve_Cliente,
    name: (l.clientes as any)?.Cl_Contacto_1 || "",
    email: (l.clientes as any)?.Cl_email_contacto_1 || "",
    company: (l.clientes as any)?.Cl_Razon_Social || "",
    status: l.Cl_Status_CRM as LeadStatus,
    assignedTo: l.Vn_Cve_Vendedor,
    value: l.Cl_Valor_CRM || 0,
    sucursal: sucursalesMap[String(l.Sc_Cve_Sucursal)] || String(l.Sc_Cve_Sucursal || ""),
    segmento: segmentosMap[String(l.Sg_Cve_Segmento)] || String(l.Sg_Cve_Segmento || ""),
    quotedAmount: l.Cl_QuotedAmount_CRM ?? undefined,
    invoicedAmount: l.Cl_InvoicedAmount_CRM ?? undefined,
    clientInitiated: !!l.Cl_Client_Initiated_CRM,
    mostrador: !!l.Cl_Mostrador_CRM,
    newClient: !!l.Cl_New_Client_CRM,
    createdAt: l.Cl_CreatedAt_CRM,
    updatedAt: l.Cl_UpdatedAt_CRM,
    history: ((l.lead_history as any[]) || [])
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .map((h) => ({
        id: h.id,
        leadId: h.lead_id,
        status: h.status as LeadStatus,
        comment: h.comment || "",
        evidenceUrl: h.evidence_url ?? undefined,
        quotedAmount: h.quoted_amount ?? undefined,
        invoicedAmount: h.invoiced_amount ?? undefined,
        rechazoMotivoId: h.rechazo_motivo_id ?? undefined,
        rechazoMotivo: (h.rechazo_motivos as any)?.descripcion ?? undefined,
        updatedBy: h.updated_by,
        timestamp: h.timestamp,
      })),
  }));
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

const app = express();
app.use(express.json());

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  const { data: vendor } = await supabase
    .from("vendedores")
    .select("Vn_Cve_Vendedor, Vn_Password")
    .eq("Vn_Email", email)
    .eq("Es_Cve_Estado", "AC")
    .maybeSingle();

  // Accounts without a password set are not loggable. Use the same generic
  // error as a wrong password so callers can't probe which accounts exist
  // without a credential set.
  if (!vendor || !vendor.Vn_Password || vendor.Vn_Password !== password) {
    res.status(401).json({ error: "Correo o contraseña incorrectos" });
    return;
  }

  const users = await getUsersWithPerformance();
  res.json(users.find((u) => u.id === vendor.Vn_Cve_Vendedor));
});

// ---------------------------------------------------------------------------
// Users / Vendedores
// ---------------------------------------------------------------------------

app.get("/api/users", async (_req, res) => {
  res.json(await getUsersWithPerformance());
});

app.post("/api/users", async (req, res) => {
  const { name, email, role, salesGoal, sucursal } = req.body;
  const id = Math.random().toString(36).substr(2, 9);

  const { data: sucursalRow } = await supabase
    .from("sucursales")
    .select("Sc_Cve_Sucursal")
    .eq("Sc_Descripcion", sucursal)
    .maybeSingle();

  const { error } = await supabase.from("vendedores").insert({
    Vn_Cve_Vendedor: id,
    Vn_Descripcion: name,
    Vn_Email: email,
    Vn_Perfil: role,
    Sc_Cve_Sucursal: sucursalRow?.Sc_Cve_Sucursal || "",
    // Mark active so /api/login (which filters Es_Cve_Estado = 'AC') will
    // find the row. Without this, CRM-created users can never log in.
    Es_Cve_Estado: "AC",
  });

  if (error) {
    res.status(400).json({ error: "Email already exists" });
    return;
  }

  if (salesGoal) {
    const now = new Date();
    await supabase.from("vendedor_metas").insert({
      id: Math.random().toString(36).substr(2, 9),
      Vn_Cve_Vendedor: id,
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      meta: salesGoal,
    });
  }

  const users = await getUsersWithPerformance();
  res.status(201).json(users.find((u) => u.id === id));
});

app.post("/api/users/:id/role", async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  const { error } = await supabase
    .from("vendedores")
    .update({ Vn_Perfil: role })
    .eq("Vn_Cve_Vendedor", id);

  if (!error) {
    const users = await getUsersWithPerformance();
    res.json(users.find((u) => u.id === id));
  } else {
    res.status(404).json({ error: "User not found" });
  }
});

app.post("/api/users/:id/email", async (req, res) => {
  const { id } = req.params;
  const { email } = req.body;
  if (!email) {
    res.status(400).json({ error: "Email is required" });
    return;
  }
  const { error } = await supabase
    .from("vendedores")
    .update({ Vn_Email: email })
    .eq("Vn_Cve_Vendedor", id);

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }
  const users = await getUsersWithPerformance();
  res.json(users.find((u) => u.id === id));
});

app.post("/api/users/:id/reset-password", async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;
  if (!password) {
    res.status(400).json({ error: "Password is required" });
    return;
  }
  const { error } = await supabase
    .from("vendedores")
    .update({ Vn_Password: password })
    .eq("Vn_Cve_Vendedor", id);

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }
  res.json({ success: true });
});

app.post("/api/users/:id/goal", async (req, res) => {
  const { id } = req.params;
  const { goal, year, month } = req.body;
  const now = new Date();
  const targetYear: number = year ?? now.getFullYear();
  const targetMonth: number = month ?? now.getMonth() + 1;

  // Check vendedor exists
  const { data: vendedor } = await supabase
    .from("vendedores")
    .select("Vn_Cve_Vendedor")
    .eq("Vn_Cve_Vendedor", id)
    .maybeSingle();

  if (!vendedor) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // Upsert goal for the given month/year
  const { error } = await supabase.from("vendedor_metas").upsert(
    {
      id: Math.random().toString(36).substr(2, 9),
      Vn_Cve_Vendedor: id,
      year: targetYear,
      month: targetMonth,
      meta: goal,
    },
    { onConflict: "Vn_Cve_Vendedor,year,month" }
  );

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const users = await getUsersWithPerformance();
  res.json(users.find((u) => u.id === id));
});

app.post("/api/sucursales/:id/goal", async (req, res) => {
  const { id } = req.params;
  const { goal, year, month } = req.body;
  const now = new Date();
  const targetYear: number = year ?? now.getFullYear();
  const targetMonth: number = month ?? now.getMonth() + 1;

  const { data: sellers } = await supabase
    .from("vendedores")
    .select("Vn_Cve_Vendedor")
    .eq("Sc_Cve_Sucursal", id)
    .eq("Es_Cve_Estado", "AC");

  if (!sellers || sellers.length === 0) {
    res.status(404).json({ error: "No hay vendedores activos en esta sucursal" });
    return;
  }

  const { error } = await supabase.from("vendedor_metas").upsert(
    sellers.map((s) => ({
      id: Math.random().toString(36).substr(2, 9),
      Vn_Cve_Vendedor: s.Vn_Cve_Vendedor,
      year: targetYear,
      month: targetMonth,
      meta: goal,
    })),
    { onConflict: "Vn_Cve_Vendedor,year,month" }
  );

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ success: true, updated: sellers.length });
});

app.get("/api/users/:id/goals", async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from("vendedor_metas")
    .select("id, Vn_Cve_Vendedor, year, month, meta, created_at")
    .eq("Vn_Cve_Vendedor", id)
    .order("year", { ascending: false })
    .order("month", { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  // For each month with a goal, calculate actual invoiced amount from leads
  const { data: closedLeads } = await supabase
    .from("leads")
    .select("Cl_InvoicedAmount_CRM, Cl_Valor_CRM, Cl_UpdatedAt_CRM")
    .eq("Vn_Cve_Vendedor", id)
    .in("Cl_Status_CRM", ["FACTURADO", "ENTREGADO"]);

  const invoicedByMonth: Record<string, number> = {};
  for (const lead of closedLeads || []) {
    const d = new Date(lead.Cl_UpdatedAt_CRM);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    invoicedByMonth[key] = (invoicedByMonth[key] || 0) + (lead.Cl_InvoicedAmount_CRM ?? lead.Cl_Valor_CRM ?? 0);
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  res.json(
    (data || []).map((r) => {
      const key = `${r.year}-${r.month}`;
      const invoiced = invoicedByMonth[key] || 0;
      const isPast = r.year < currentYear || (r.year === currentYear && r.month < currentMonth);
      const isCurrent = r.year === currentYear && r.month === currentMonth;
      return {
        id: r.id,
        vendedorId: r.Vn_Cve_Vendedor,
        year: r.year,
        month: r.month,
        meta: r.meta,
        invoiced,
        status: isCurrent ? "current" : isPast ? (invoiced >= r.meta ? "achieved" : "missed") : "future",
        createdAt: r.created_at,
      };
    })
  );
});

// ---------------------------------------------------------------------------
// Leads (CRM-only table)
// ---------------------------------------------------------------------------

app.get("/api/leads", async (_req, res) => {
  res.json(await getLeadsWithHistory());
});

app.post("/api/leads", async (req, res) => {
  const { userId, isExistingClient, clientId: existingClientId, clientInitiated, mostrador, ...leadData } = req.body;
  const now = new Date().toISOString();
  const status = "ASIGNADO";

  // Resolve segment
  const { data: segmentoRow } = await supabase
    .from("segmentos")
    .select("Sg_Cve_Segmento")
    .eq("Sg_Descripcion", leadData.segmento)
    .maybeSingle();

  // Resolve branch: prefer seller's branch, then provided sucursal
  let sucursalId = "";
  if (userId) {
    const { data: seller } = await supabase
      .from("vendedores")
      .select("Sc_Cve_Sucursal")
      .eq("Vn_Cve_Vendedor", userId)
      .maybeSingle();
    sucursalId = seller?.Sc_Cve_Sucursal || "";
  }
  if (!sucursalId && leadData.sucursal) {
    const { data: sucursalRow } = await supabase
      .from("sucursales")
      .select("Sc_Cve_Sucursal")
      .eq("Sc_Descripcion", leadData.sucursal)
      .maybeSingle();
    sucursalId = sucursalRow?.Sc_Cve_Sucursal || "";
  }

  // Resolve client: use existing or create new
  let clientId: string;
  if (isExistingClient && existingClientId) {
    clientId = existingClientId;
  } else {
    clientId = Math.random().toString(36).substr(2, 9);
    const { error: clientError } = await supabase.from("clientes").insert({
      Cl_Cve_Cliente: clientId,
      Cl_Razon_Social: leadData.company,
      Cl_Contacto_1: leadData.name,
      Cl_email_contacto_1: leadData.email,
      Sc_Cve_Sucursal: sucursalId || null,
      Sg_Cve_Segmento: segmentoRow?.Sg_Cve_Segmento || null,
      Vn_Cve_Vendedor: userId || null,
      Fecha_Alta: now,
      Fecha_Ult_Modif: now,
    });
    if (clientError) {
      res.status(400).json({ error: clientError.message });
      return;
    }
  }

  // Create lead
  const leadId = Math.random().toString(36).substr(2, 9);
  const { error: leadError } = await supabase.from("leads").insert({
    id: leadId,
    Cl_Cve_Cliente: clientId,
    Cl_Status_CRM: status,
    Vn_Cve_Vendedor: userId || null,
    Cl_Valor_CRM: leadData.value,
    Sc_Cve_Sucursal: sucursalId || null,
    Sg_Cve_Segmento: segmentoRow?.Sg_Cve_Segmento || null,
    // Mostrador implies clientInitiated by definition (a walk-in is always client-initiated).
    Cl_Client_Initiated_CRM: !!clientInitiated || !!mostrador,
    Cl_Mostrador_CRM: !!mostrador,
    Cl_New_Client_CRM: !isExistingClient,
    Cl_CreatedAt_CRM: now,
    Cl_UpdatedAt_CRM: now,
  });

  if (leadError) {
    res.status(400).json({ error: leadError.message });
    return;
  }

  await supabase.from("lead_history").insert({
    id: Math.random().toString(36).substr(2, 9),
    lead_id: leadId,
    status,
    comment: userId ? "Lead created and self-assigned" : "Lead created in ASIGNADO stage",
    updated_by: userId || "System",
    timestamp: now,
  });

  const leads = await getLeadsWithHistory();
  res.status(201).json(leads.find((l) => l.id === leadId));
});

app.post("/api/leads/:id/assign", async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  const now = new Date().toISOString();

  const { data: seller } = await supabase
    .from("vendedores")
    .select("Sc_Cve_Sucursal")
    .eq("Vn_Cve_Vendedor", userId)
    .maybeSingle();

  const updates: Record<string, any> = {
    Vn_Cve_Vendedor: userId,
    Cl_Status_CRM: "ASIGNADO",
    Cl_UpdatedAt_CRM: now,
  };
  if (seller?.Sc_Cve_Sucursal) {
    updates.Sc_Cve_Sucursal = seller.Sc_Cve_Sucursal;
  }

  const { error } = await supabase.from("leads").update(updates).eq("id", id);

  if (!error) {
    const leads = await getLeadsWithHistory();
    res.json(leads.find((l) => l.id === id));
  } else {
    res.status(404).json({ error: "Lead not found" });
  }
});

app.post("/api/leads/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status, comment, evidenceUrl, userId, quotedAmount, invoicedAmount, rechazoMotivoId, erpClientId } = req.body;
  const now = new Date().toISOString();

  const { data: lead } = await supabase
    .from("leads")
    .select("Cl_Cve_Cliente, Cl_Valor_CRM, Cl_QuotedAmount_CRM, Cl_InvoicedAmount_CRM, clientes(Cl_Razon_Social)")
    .eq("id", id)
    .maybeSingle();

  if (!lead) return res.status(404).json({ error: "Lead not found" });

  const updates: Record<string, any> = { Cl_Status_CRM: status, Cl_UpdatedAt_CRM: now };
  const effectiveQuotedAmount = status === "COTIZADO"
    ? (quotedAmount && quotedAmount > 0 ? quotedAmount : (lead.Cl_Valor_CRM || 0))
    : quotedAmount;
  if (status === "COTIZADO") {
    updates.Cl_QuotedAmount_CRM = effectiveQuotedAmount;
  }
  if (status === "FACTURADO" && invoicedAmount !== undefined) {
    updates.Cl_InvoicedAmount_CRM = invoicedAmount;
    updates.Cl_Valor_CRM = invoicedAmount;
  }

  // When a sale is closed on a CRM-only prospect, the seller must supply the
  // matching ERP client id so we can re-point the lead and retire the prospect.
  if (status === "FACTURADO") {
    const oldClientId = lead.Cl_Cve_Cliente;
    if (!isErpId(oldClientId)) {
      const requestedErpId = String(erpClientId || "").trim();
      if (!requestedErpId) {
        return res.status(400).json({ error: "Selecciona el ID del cliente ERP para vincular antes de facturar." });
      }
      if (!isErpId(requestedErpId)) {
        return res.status(400).json({ error: "El ID del cliente ERP debe ser numérico." });
      }
      const { data: erpClient } = await supabase
        .from("clientes")
        .select("Cl_Cve_Cliente")
        .eq("Cl_Cve_Cliente", requestedErpId)
        .maybeSingle();
      if (!erpClient) {
        return res.status(400).json({ error: `No existe un cliente ERP con id ${requestedErpId}.` });
      }

      // Re-point every lead that referenced the CRM prospect, then retire the prospect.
      await supabase.from("leads")
        .update({ Cl_Cve_Cliente: requestedErpId })
        .eq("Cl_Cve_Cliente", oldClientId);
      await supabase.from("clientes").delete().eq("Cl_Cve_Cliente", oldClientId);
    }
  }

  await supabase.from("leads").update(updates).eq("id", id);

  await supabase.from("lead_history").insert({
    id: Math.random().toString(36).substr(2, 9),
    lead_id: id,
    status,
    comment: comment || `Status updated to ${status}`,
    evidence_url: evidenceUrl || null,
    quoted_amount: status === "COTIZADO" ? effectiveQuotedAmount : null,
    invoiced_amount: status === "FACTURADO" ? invoicedAmount : null,
    rechazo_motivo_id: status === "RECHAZADO" ? (rechazoMotivoId ?? null) : null,
    updated_by: userId || "System",
    timestamp: now,
  });

  const leads = await getLeadsWithHistory();
  res.json(leads.find((l) => l.id === id));
});

// ---------------------------------------------------------------------------
// Clients catalogue (mirrors ERP Cliente table)
// ---------------------------------------------------------------------------

app.get("/api/clients", async (_req, res) => {
  // Paginate: PostgREST caps responses (often 1000 rows), so we fetch in pages until exhausted
  const PAGE_SIZE = 1000;
  const allRows: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("clientes")
      .select(`
        Cl_Cve_Cliente, Cl_Razon_Social, Cl_Descripcion, Cl_Contacto_1, Cl_email_contacto_1,
        Cl_R_F_C, Cl_Telefono_1, Cl_Ciudad, Cl_Estado,
        Sc_Cve_Sucursal, Sg_Cve_Segmento, Fecha_Alta
      `)
      .order("Cl_Razon_Social", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) { console.error("[clients] page error:", error.message); break; }
    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  const segmentosMap = await getSegmentosMap();

  const clients = allRows.map((c) => ({
    id: c.Cl_Cve_Cliente,
    name: c.Cl_Contacto_1 || "",
    email: c.Cl_email_contacto_1 || "",
    company: (c.Cl_Razon_Social || "").trim(),
    tradeName: c.Cl_Descripcion ? String(c.Cl_Descripcion).trim() : undefined,
    rfc: c.Cl_R_F_C || undefined,
    phone: c.Cl_Telefono_1 || undefined,
    city: c.Cl_Ciudad || undefined,
    state: c.Cl_Estado || undefined,
    sucursalId: c.Sc_Cve_Sucursal ? String(c.Sc_Cve_Sucursal) : undefined,
    segmentoId: c.Sg_Cve_Segmento ? String(c.Sg_Cve_Segmento) : undefined,
    segmento: c.Sg_Cve_Segmento ? segmentosMap[String(c.Sg_Cve_Segmento)] : undefined,
    createdAt: c.Fecha_Alta,
    source: isErpId(c.Cl_Cve_Cliente) ? 'erp' as const : 'crm' as const,
  }));

  res.json(clients);
});

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

app.get("/api/lookups/sucursales", async (_req, res) => {
  // neq alone excludes NULL rows (PostgREST inherits SQL 3-valued logic),
  // so explicitly allow NULL to mean "active by default"
  const { data } = await supabase
    .from("sucursales")
    .select("Sc_Cve_Sucursal, Sc_Descripcion, Es_Cve_Estado")
    .or("Es_Cve_Estado.is.null,Es_Cve_Estado.neq.BA");
  res.json((data || []).map((s) => ({ id: String(s.Sc_Cve_Sucursal), name: s.Sc_Descripcion })));
});

app.get("/api/lookups/segmentos", async (_req, res) => {
  const { data } = await supabase
    .from("segmentos")
    .select("Sg_Cve_Segmento, Sg_Descripcion, Es_Cve_Estado")
    .eq("Es_Cve_Estado", "AC");
  res.json((data || []).map((s) => ({ id: String(s.Sg_Cve_Segmento), name: s.Sg_Descripcion })));
});

app.get("/api/lookups/rechazo-motivos", async (_req, res) => {
  const { data, error } = await supabase
    .from("rechazo_motivos")
    .select("id, descripcion")
    .order("id");
  if (error) console.error("[rechazo-motivos]", error.message);
  res.json((data || []).map((m) => ({ id: m.id, descripcion: m.descripcion })));
});

// ---------------------------------------------------------------------------
// Productos (active only, paginated like /api/clients)
// ---------------------------------------------------------------------------
app.get("/api/productos", async (_req, res) => {
  const PAGE_SIZE = 1000;
  const allRows: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("productos")
      .select("Pr_Cve_Producto, Pr_Clave_Corta, Pr_Numero_Parte, Pr_Barras, Pr_Descripcion, Pr_Descripcion_Corta, Pr_Unidad_Venta, Es_Cve_Estado")
      .eq("Es_Cve_Estado", "AC")
      .order("Pr_Descripcion", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) { console.error("[productos] page error:", error.message); break; }
    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  res.json(allRows.map((p) => ({
    id: String(p.Pr_Cve_Producto),
    claveCorta: p.Pr_Clave_Corta ? String(p.Pr_Clave_Corta).trim() : undefined,
    numeroParte: p.Pr_Numero_Parte ? String(p.Pr_Numero_Parte).trim() : undefined,
    barras: p.Pr_Barras ? String(p.Pr_Barras).trim() : undefined,
    descripcion: (p.Pr_Descripcion || "").trim(),
    descripcionCorta: p.Pr_Descripcion_Corta ? String(p.Pr_Descripcion_Corta).trim() : undefined,
    unidadVenta: p.Pr_Unidad_Venta ? String(p.Pr_Unidad_Venta).trim() : undefined,
    estado: p.Es_Cve_Estado ? String(p.Es_Cve_Estado).trim() : undefined,
  })));
});

// ---------------------------------------------------------------------------
// Productos faltantes (lost sales due to stock-outs)
// ---------------------------------------------------------------------------

async function fetchFaltantes(filters: { vendedorId?: string } = {}) {
  let query = supabase
    .from("productos_faltantes")
    .select(`
      id, Vn_Cve_Vendedor, Sc_Cve_Sucursal, Cl_Cve_Cliente, Pr_Cve_Producto,
      producto_descripcion, cantidad, comentario, estado, created_at, updated_at,
      vendedores(Vn_Descripcion),
      sucursales(Sc_Descripcion),
      clientes(Cl_Razon_Social, Cl_Descripcion)
    `)
    .order("created_at", { ascending: false });
  if (filters.vendedorId) query = query.eq("Vn_Cve_Vendedor", filters.vendedorId);
  const { data, error } = await query;
  if (error) { console.error("[faltantes]", error.message); return []; }
  return (data || []).map((r: any) => ({
    id: r.id,
    vendedorId: String(r.Vn_Cve_Vendedor || ""),
    vendedorName: r.vendedores?.Vn_Descripcion || undefined,
    sucursalId: r.Sc_Cve_Sucursal ? String(r.Sc_Cve_Sucursal) : undefined,
    sucursalName: r.sucursales?.Sc_Descripcion || undefined,
    clienteId: r.Cl_Cve_Cliente ? String(r.Cl_Cve_Cliente) : null,
    clienteName: r.clientes
      ? (String(r.clientes.Cl_Descripcion || r.clientes.Cl_Razon_Social || "").trim() || null)
      : null,
    productoId: r.Pr_Cve_Producto ? String(r.Pr_Cve_Producto) : null,
    productoDescripcion: r.producto_descripcion || "",
    cantidad: Number(r.cantidad || 0),
    comentario: r.comentario || "",
    estado: r.estado as "pendiente" | "resuelto",
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

app.get("/api/productos-faltantes", async (req, res) => {
  const vendedorId = typeof req.query.vendedorId === "string" ? req.query.vendedorId : undefined;
  res.json(await fetchFaltantes({ vendedorId }));
});

app.post("/api/productos-faltantes", async (req, res) => {
  const { userId, productoId, productoDescripcion, cantidad, comentario, clienteId } = req.body;
  if (!userId) return res.status(400).json({ error: "Falta el id del vendedor." });
  if (!productoDescripcion || !String(productoDescripcion).trim()) {
    return res.status(400).json({ error: "Selecciona un producto o escribe una descripción." });
  }
  if (!cantidad || Number(cantidad) <= 0) {
    return res.status(400).json({ error: "La cantidad debe ser mayor a 0." });
  }

  const { data: seller } = await supabase
    .from("vendedores")
    .select("Sc_Cve_Sucursal")
    .eq("Vn_Cve_Vendedor", userId)
    .maybeSingle();

  const now = new Date().toISOString();
  const id = Math.random().toString(36).substr(2, 12);

  const { error } = await supabase.from("productos_faltantes").insert({
    id,
    Vn_Cve_Vendedor: userId,
    Sc_Cve_Sucursal: seller?.Sc_Cve_Sucursal || null,
    Cl_Cve_Cliente: clienteId || null,
    Pr_Cve_Producto: productoId || null,
    producto_descripcion: String(productoDescripcion).trim(),
    cantidad: Number(cantidad),
    comentario: comentario ? String(comentario).trim() : "",
    estado: "pendiente",
    created_at: now,
    updated_at: now,
  });
  if (error) return res.status(400).json({ error: error.message });

  const all = await fetchFaltantes();
  res.status(201).json(all.find((f) => f.id === id));
});

app.patch("/api/productos-faltantes/:id", async (req, res) => {
  const { id } = req.params;
  const { estado, comentario, productoId, productoDescripcion, cantidad, clienteId } = req.body;
  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (estado === "pendiente" || estado === "resuelto") updates.estado = estado;
  if (typeof comentario === "string") updates.comentario = comentario.trim();
  if (productoId !== undefined) updates.Pr_Cve_Producto = productoId || null;
  if (typeof productoDescripcion === "string") {
    if (!productoDescripcion.trim()) {
      return res.status(400).json({ error: "Selecciona un producto o escribe una descripción." });
    }
    updates.producto_descripcion = productoDescripcion.trim();
  }
  if (cantidad !== undefined) {
    if (!cantidad || Number(cantidad) <= 0) {
      return res.status(400).json({ error: "La cantidad debe ser mayor a 0." });
    }
    updates.cantidad = Number(cantidad);
  }
  if (clienteId !== undefined) updates.Cl_Cve_Cliente = clienteId || null;

  const { error } = await supabase.from("productos_faltantes").update(updates).eq("id", id);
  if (error) return res.status(400).json({ error: error.message });

  const all = await fetchFaltantes();
  res.json(all.find((f) => f.id === id));
});

// ────────────────────────────────────────────────────────────────────────────
// Pedidos Extraordinarios — formal requests to procure stock outside the
// regular buy windows. Lifecycle: solicitado → aprobado | rechazado | cancelado.
// ────────────────────────────────────────────────────────────────────────────

const PEDIDO_ESTADOS = new Set(["solicitado", "aprobado", "pedido", "rechazado", "cancelado"]);

async function fetchPedidosExtraordinarios(filters: { vendedorId?: string } = {}) {
  // Two FKs from pedidos_extraordinarios → vendedores (Vn_Cve_Vendedor and
  // resuelto_por) require disambiguation. Supabase resolves the embed via
  // the source-column alias syntax: `<alias>:<column>(...)`.
  let query = supabase
    .from("pedidos_extraordinarios")
    .select(`
      id, Vn_Cve_Vendedor, Sc_Cve_Sucursal, Cl_Cve_Cliente, Pr_Cve_Producto, lead_id,
      producto_descripcion, cantidad, valor_estimado, compromiso_dias, justificacion,
      estado, resolucion_comentario, resuelto_por, resuelto_at, created_at, updated_at,
      vendedor:Vn_Cve_Vendedor(Vn_Descripcion),
      resolver:resuelto_por(Vn_Descripcion),
      sucursales(Sc_Descripcion),
      clientes(Cl_Razon_Social, Cl_Descripcion),
      leads(Cl_Status_CRM, clientes(Cl_Razon_Social, Cl_Descripcion))
    `)
    .order("created_at", { ascending: false });
  if (filters.vendedorId) query = query.eq("Vn_Cve_Vendedor", filters.vendedorId);
  const { data, error } = await query;
  if (error) { console.error("[pedidos_extraordinarios]", error.message); return []; }
  return (data || []).map((r: any) => {
    const leadCompany = r.leads?.clientes
      ? String(r.leads.clientes.Cl_Razon_Social || r.leads.clientes.Cl_Descripcion || "").trim() || undefined
      : undefined;
    const clienteName = r.clientes
      ? (String(r.clientes.Cl_Descripcion || r.clientes.Cl_Razon_Social || "").trim() || null)
      : null;
    return {
      id: r.id,
      vendedorId: String(r.Vn_Cve_Vendedor || ""),
      vendedorName: r.vendedor?.Vn_Descripcion || undefined,
      sucursalId: r.Sc_Cve_Sucursal ? String(r.Sc_Cve_Sucursal) : undefined,
      sucursalName: r.sucursales?.Sc_Descripcion || undefined,
      leadId: String(r.lead_id || ""),
      leadCompany,
      leadStatus: r.leads?.Cl_Status_CRM || undefined,
      clienteId: r.Cl_Cve_Cliente ? String(r.Cl_Cve_Cliente) : null,
      clienteName,
      productoId: r.Pr_Cve_Producto ? String(r.Pr_Cve_Producto) : null,
      productoDescripcion: r.producto_descripcion || "",
      cantidad: Number(r.cantidad || 0),
      valorEstimado: Number(r.valor_estimado || 0),
      compromisoDias: Number(r.compromiso_dias || 0),
      justificacion: r.justificacion || "",
      estado: r.estado,
      resolucionComentario: r.resolucion_comentario || undefined,
      resueltoPor: r.resuelto_por || undefined,
      resueltoPorName: r.resolver?.Vn_Descripcion || undefined,
      resueltoAt: r.resuelto_at || undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  });
}

app.get("/api/pedidos-extraordinarios", async (req, res) => {
  const vendedorId = typeof req.query.vendedorId === "string" ? req.query.vendedorId : undefined;
  res.json(await fetchPedidosExtraordinarios({ vendedorId }));
});

app.post("/api/pedidos-extraordinarios", async (req, res) => {
  const { userId, leadId, productoId, productoDescripcion, cantidad, valorEstimado, compromisoDias, justificacion } = req.body;
  if (!userId) return res.status(400).json({ error: "Falta el id del vendedor." });
  if (!leadId) return res.status(400).json({ error: "Selecciona un lead activo." });
  if (!productoDescripcion || !String(productoDescripcion).trim()) {
    return res.status(400).json({ error: "Selecciona un producto o escribe una descripción." });
  }
  if (!cantidad || Number(cantidad) <= 0) {
    return res.status(400).json({ error: "La cantidad debe ser mayor a 0." });
  }
  if (!valorEstimado || Number(valorEstimado) <= 0) {
    return res.status(400).json({ error: "Captura el valor estimado de la venta." });
  }
  const dias = Number(compromisoDias);
  if (!dias || dias < 1 || dias > 10) {
    return res.status(400).json({ error: "El compromiso debe ser entre 1 y 10 días." });
  }

  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .select("Cl_Cve_Cliente, Cl_Status_CRM")
    .eq("id", leadId)
    .maybeSingle();
  if (leadErr || !lead) return res.status(400).json({ error: "Lead no encontrado." });
  if (["FACTURADO", "ENTREGADO", "RECHAZADO"].includes(String(lead.Cl_Status_CRM))) {
    return res.status(400).json({ error: "Solo puedes pedir productos para leads activos." });
  }

  const { data: seller } = await supabase
    .from("vendedores")
    .select("Sc_Cve_Sucursal")
    .eq("Vn_Cve_Vendedor", userId)
    .maybeSingle();

  const now = new Date().toISOString();
  const id = Math.random().toString(36).substr(2, 12);

  const { error } = await supabase.from("pedidos_extraordinarios").insert({
    id,
    Vn_Cve_Vendedor: userId,
    Sc_Cve_Sucursal: seller?.Sc_Cve_Sucursal || null,
    Cl_Cve_Cliente: lead.Cl_Cve_Cliente || null,
    lead_id: leadId,
    Pr_Cve_Producto: productoId || null,
    producto_descripcion: String(productoDescripcion).trim(),
    cantidad: Number(cantidad),
    valor_estimado: Number(valorEstimado),
    compromiso_dias: dias,
    justificacion: justificacion ? String(justificacion).trim() : "",
    estado: "solicitado",
    created_at: now,
    updated_at: now,
  });
  if (error) return res.status(400).json({ error: error.message });

  const all = await fetchPedidosExtraordinarios();
  res.status(201).json(all.find((p) => p.id === id));
});

app.patch("/api/pedidos-extraordinarios/:id", async (req, res) => {
  const { id } = req.params;
  const {
    actorId, actorRole,
    estado,
    productoId, productoDescripcion, cantidad, valorEstimado, compromisoDias,
    justificacion, resolucionComentario,
  } = req.body;

  const { data: existing, error: fetchErr } = await supabase
    .from("pedidos_extraordinarios")
    .select("Vn_Cve_Vendedor, estado")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr || !existing) return res.status(404).json({ error: "Pedido no encontrado." });

  const isAdmin = actorRole === "Admin";
  const isCompras = actorRole === "Compras";
  const isOwner = actorId && actorId === existing.Vn_Cve_Vendedor;

  // Permission check.
  if (!isAdmin && !isCompras && !isOwner) return res.status(403).json({ error: "No autorizado." });
  // Compras can transition to aprobado / rechazado / pedido. Allowed source
  // states: solicitado (any of the three) or aprobado (advance to pedido or
  // rechazado). pedido / rechazado / cancelado are terminal for Compras.
  if (isCompras && !isAdmin) {
    if (!["aprobado", "rechazado", "pedido"].includes(estado)) {
      return res.status(403).json({ error: "Compras solo puede aprobar, rechazar o marcar como pedido." });
    }
    if (!["solicitado", "aprobado"].includes(String(existing.estado))) {
      return res.status(409).json({ error: "Pedido ya resuelto." });
    }
  }
  // Sellers (non-admin, non-compras) can only cancel their own pending request.
  if (!isAdmin && !isCompras) {
    if (estado !== "cancelado") return res.status(403).json({ error: "Como vendedor solo puedes cancelar tu propio pedido." });
    if (existing.estado !== "solicitado") return res.status(409).json({ error: "Solo se puede cancelar un pedido pendiente." });
  }
  // Once a pedido reaches a terminal state, only admins can rewind it.
  // (aprobado is no longer terminal — Compras can advance it to pedido.)
  if (!isAdmin && ["pedido", "rechazado", "cancelado"].includes(String(existing.estado))) {
    return res.status(409).json({ error: "Pedido ya resuelto." });
  }

  const updates: Record<string, any> = { updated_at: new Date().toISOString() };

  if (estado !== undefined) {
    if (!PEDIDO_ESTADOS.has(estado)) return res.status(400).json({ error: "Estado inválido." });
    updates.estado = estado;
    if (["aprobado", "rechazado", "cancelado"].includes(estado)) {
      updates.resuelto_por = actorId || null;
      updates.resuelto_at = new Date().toISOString();
    } else {
      // Returning to solicitado clears prior resolution.
      updates.resuelto_por = null;
      updates.resuelto_at = null;
    }
  }

  // Field edits — admin only.
  if (isAdmin) {
    if (productoId !== undefined) updates.Pr_Cve_Producto = productoId || null;
    if (typeof productoDescripcion === "string") {
      if (!productoDescripcion.trim()) return res.status(400).json({ error: "La descripción del producto no puede estar vacía." });
      updates.producto_descripcion = productoDescripcion.trim();
    }
    if (cantidad !== undefined) {
      if (!cantidad || Number(cantidad) <= 0) return res.status(400).json({ error: "La cantidad debe ser mayor a 0." });
      updates.cantidad = Number(cantidad);
    }
    if (valorEstimado !== undefined) {
      if (!valorEstimado || Number(valorEstimado) <= 0) return res.status(400).json({ error: "Valor estimado inválido." });
      updates.valor_estimado = Number(valorEstimado);
    }
    if (compromisoDias !== undefined) {
      const dias = Number(compromisoDias);
      if (!dias || dias < 1 || dias > 10) return res.status(400).json({ error: "El compromiso debe ser entre 1 y 10 días." });
      updates.compromiso_dias = dias;
    }
    if (typeof justificacion === "string") updates.justificacion = justificacion.trim();
    if (typeof resolucionComentario === "string") updates.resolucion_comentario = resolucionComentario.trim();
  } else if (typeof resolucionComentario === "string") {
    // Compras attaches the approve/reject comment; sellers attach a cancel comment.
    updates.resolucion_comentario = resolucionComentario.trim();
  }

  const { error } = await supabase.from("pedidos_extraordinarios").update(updates).eq("id", id);
  if (error) return res.status(400).json({ error: error.message });

  const all = await fetchPedidosExtraordinarios();
  res.json(all.find((p) => p.id === id));
});

export default app;
