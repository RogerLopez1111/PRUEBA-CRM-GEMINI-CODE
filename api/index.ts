import express from "express";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

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
  const { data: leadsData } = await supabase
    .from("leads")
    .select(`
      *,
      clientes(Cl_Contacto_1, Cl_email_contacto_1, Cl_Razon_Social),
      sucursales(Sc_Descripcion),
      segmentos(Sg_Descripcion),
      lead_history(*)
    `)
    .order("Cl_CreatedAt_CRM", { ascending: false });

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
    sucursal: (l.sucursales as any)?.Sc_Descripcion || "",
    segmento: (l.segmentos as any)?.Sg_Descripcion || "",
    quotedAmount: l.Cl_QuotedAmount_CRM ?? undefined,
    invoicedAmount: l.Cl_InvoicedAmount_CRM ?? undefined,
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

  if (!vendor) {
    res.status(401).json({ error: "Correo o contraseña incorrectos" });
    return;
  }

  if (vendor.Vn_Password && vendor.Vn_Password !== password) {
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
  const { userId, isExistingClient, clientId: existingClientId, ...leadData } = req.body;
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
  const { status, comment, evidenceUrl, userId, quotedAmount, invoicedAmount } = req.body;
  const now = new Date().toISOString();

  const { data: lead } = await supabase
    .from("leads")
    .select("Cl_Valor_CRM, Cl_QuotedAmount_CRM, Cl_InvoicedAmount_CRM")
    .eq("id", id)
    .maybeSingle();

  if (!lead) return res.status(404).json({ error: "Lead not found" });

  const updates: Record<string, any> = { Cl_Status_CRM: status, Cl_UpdatedAt_CRM: now };
  if (status === "COTIZADO" && quotedAmount !== undefined) {
    updates.Cl_QuotedAmount_CRM = quotedAmount;
  }
  if (status === "FACTURADO" && invoicedAmount !== undefined) {
    updates.Cl_InvoicedAmount_CRM = invoicedAmount;
    updates.Cl_Valor_CRM = invoicedAmount;
  }

  await supabase.from("leads").update(updates).eq("id", id);

  await supabase.from("lead_history").insert({
    id: Math.random().toString(36).substr(2, 9),
    lead_id: id,
    status,
    comment: comment || `Status updated to ${status}`,
    evidence_url: evidenceUrl || null,
    quoted_amount: status === "COTIZADO" ? quotedAmount : null,
    invoiced_amount: status === "FACTURADO" ? invoicedAmount : null,
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
  const { data, error } = await supabase
    .from("clientes")
    .select(`
      Cl_Cve_Cliente,
      Cl_Razon_Social,
      Cl_Contacto_1,
      Cl_email_contacto_1,
      Cl_R_F_C,
      Cl_Telefono_1,
      Cl_Ciudad,
      Cl_Estado,
      Sc_Cve_Sucursal,
      Sg_Cve_Segmento,
      Fecha_Alta,
      segmentos(Sg_Descripcion),
      leads(Sc_Cve_Sucursal, Cl_CreatedAt_CRM)
    `)
    .order("Fecha_Alta", { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json(
    (data || []).map((c) => {
      const sortedLeads = ((c.leads as any[]) || []).sort(
        (a, b) => new Date(b.Cl_CreatedAt_CRM).getTime() - new Date(a.Cl_CreatedAt_CRM).getTime()
      );
      return {
        id: c.Cl_Cve_Cliente,
        name: c.Cl_Contacto_1 || "",
        email: c.Cl_email_contacto_1 || "",
        company: c.Cl_Razon_Social || "",
        rfc: c.Cl_R_F_C || undefined,
        phone: c.Cl_Telefono_1 || undefined,
        city: c.Cl_Ciudad || undefined,
        state: c.Cl_Estado || undefined,
        sucursalId: (sortedLeads[0]?.Sc_Cve_Sucursal ?? c.Sc_Cve_Sucursal) != null ? String(sortedLeads[0]?.Sc_Cve_Sucursal ?? c.Sc_Cve_Sucursal) : undefined,
        segmentoId: c.Sg_Cve_Segmento || undefined,
        segmento: (c.segmentos as any)?.Sg_Descripcion || undefined,
        createdAt: c.Fecha_Alta,
      };
    })
  );
});

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

app.get("/api/lookups/sucursales", async (_req, res) => {
  const { data } = await supabase.from("sucursales").select("Sc_Cve_Sucursal, Sc_Descripcion");
  res.json((data || []).map((s) => ({ id: String(s.Sc_Cve_Sucursal), name: s.Sc_Descripcion })));
});

app.get("/api/lookups/segmentos", async (_req, res) => {
  const { data } = await supabase.from("segmentos").select("Sg_Cve_Segmento, Sg_Descripcion");
  res.json((data || []).map((s) => ({ id: s.Sg_Cve_Segmento, name: s.Sg_Descripcion })));
});

export default app;
