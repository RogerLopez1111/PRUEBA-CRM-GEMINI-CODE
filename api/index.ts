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
  const { data: vendedores } = await supabase.from("vendedores").select("*");
  if (!vendedores) return [];

  return Promise.all(
    vendedores.map(async (v) => {
      const { data: closedLeads } = await supabase
        .from("leads")
        .select("valor")
        .eq("vendedor_id", v.id)
        .in("status", ["FACTURADO", "ENTREGADO"]);

      const { count: totalAssigned } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("vendedor_id", v.id);

      const { data: activeLeads } = await supabase
        .from("leads")
        .select("valor")
        .eq("vendedor_id", v.id)
        .neq("status", "FACTURADO")
        .neq("status", "ENTREGADO")
        .neq("status", "RECHAZADO");

      const totalClosed = closedLeads?.length || 0;
      const totalValue = closedLeads?.reduce((s, l) => s + (l.valor || 0), 0) || 0;
      const pipelineValue = activeLeads?.reduce((s, l) => s + (l.valor || 0), 0) || 0;

      return {
        id: v.id,
        name: v.nombre,
        email: v.email,
        role: v.rol as "Admin" | "Seller",
        performance: {
          totalClosed,
          totalValue,
          conversionRate: totalAssigned ? totalClosed / totalAssigned : 0,
          salesGoal: v.meta_ventas || 0,
        },
        workload: {
          activeLeads: activeLeads?.length || 0,
          pipelineValue,
        },
        Vn_Sucursal: v.sucursal_id,
      };
    })
  );
}

async function getLeadsWithHistory() {
  const { data: leadsData } = await supabase
    .from("leads")
    .select(`*, clientes(contacto, email, razon_social), sucursales(nombre), segmentos(descripcion), lead_history(*)`)
    .order("created_at", { ascending: false });

  if (!leadsData) return [];

  return leadsData.map((l) => ({
    id: l.id,
    clientId: l.client_id,
    name: (l.clientes as any)?.contacto || "",
    email: (l.clientes as any)?.email || "",
    company: (l.clientes as any)?.razon_social || "",
    status: l.status as LeadStatus,
    assignedTo: l.vendedor_id,
    value: l.valor || 0,
    sucursal: (l.sucursales as any)?.nombre || "",
    segmento: (l.segmentos as any)?.descripcion || "",
    quotedAmount: l.monto_cotizado ?? undefined,
    invoicedAmount: l.monto_facturado ?? undefined,
    createdAt: l.created_at,
    updatedAt: l.updated_at,
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
  const { email } = req.body;
  const { data: vendor } = await supabase
    .from("vendedores")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (vendor) {
    const users = await getUsersWithPerformance();
    res.json(users.find((u) => u.id === vendor.id));
  } else {
    res.status(401).json({ error: "User not found" });
  }
});

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

app.get("/api/users", async (_req, res) => {
  res.json(await getUsersWithPerformance());
});

app.post("/api/users", async (req, res) => {
  const { name, email, role, salesGoal, sucursal } = req.body;
  const id = Math.random().toString(36).substr(2, 9);

  const { data: sucursalRow } = await supabase
    .from("sucursales")
    .select("id")
    .or(`nombre.eq.${sucursal},id.eq.${sucursal}`)
    .maybeSingle();

  const { error } = await supabase.from("vendedores").insert({
    id,
    nombre: name,
    email,
    rol: role,
    meta_ventas: salesGoal || 0,
    sucursal_id: sucursalRow?.id || null,
  });

  if (error) {
    res.status(400).json({ error: "Email already exists" });
  } else {
    const users = await getUsersWithPerformance();
    res.status(201).json(users.find((u) => u.id === id));
  }
});

app.post("/api/users/:id/role", async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  const { error } = await supabase
    .from("vendedores")
    .update({ rol: role })
    .eq("id", id);

  if (!error) {
    const users = await getUsersWithPerformance();
    res.json(users.find((u) => u.id === id));
  } else {
    res.status(404).json({ error: "User not found" });
  }
});

app.post("/api/users/:id/goal", async (req, res) => {
  const { id } = req.params;
  const { goal } = req.body;
  const { error } = await supabase
    .from("vendedores")
    .update({ meta_ventas: goal })
    .eq("id", id);

  if (!error) {
    const users = await getUsersWithPerformance();
    res.json(users.find((u) => u.id === id));
  } else {
    res.status(404).json({ error: "User not found" });
  }
});

// ---------------------------------------------------------------------------
// Leads
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
    .select("id")
    .or(`descripcion.eq.${leadData.segmento},id.eq.${leadData.segmento}`)
    .maybeSingle();

  // Resolve branch: prefer seller's branch, then provided sucursal
  let sucursalId = "S001";
  if (userId) {
    const { data: seller } = await supabase
      .from("vendedores")
      .select("sucursal_id")
      .eq("id", userId)
      .maybeSingle();
    sucursalId = seller?.sucursal_id || "S001";
  } else if (leadData.sucursal) {
    const { data: sucursalRow } = await supabase
      .from("sucursales")
      .select("id")
      .or(`nombre.eq.${leadData.sucursal},id.eq.${leadData.sucursal}`)
      .maybeSingle();
    sucursalId = sucursalRow?.id || "S001";
  }

  // Resolve client: use existing client or create a new one
  let clientId: string;
  if (isExistingClient && existingClientId) {
    clientId = existingClientId;
  } else {
    clientId = Math.random().toString(36).substr(2, 9);
    const { error: clientError } = await supabase.from("clientes").insert({
      id: clientId,
      contacto: leadData.name,
      email: leadData.email,
      razon_social: leadData.company,
      created_at: now,
    });
    if (clientError) {
      res.status(400).json({ error: "Error creating client record" });
      return;
    }
  }

  // Create lead
  const leadId = Math.random().toString(36).substr(2, 9);
  const { error: leadError } = await supabase.from("leads").insert({
    id: leadId,
    client_id: clientId,
    status,
    vendedor_id: userId || null,
    valor: leadData.value,
    sucursal_id: sucursalId,
    segmento_id: segmentoRow?.id || "SEG01",
    created_at: now,
    updated_at: now,
  });

  if (leadError) {
    res.status(400).json({ error: "Error creating lead" });
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
    .select("sucursal_id")
    .eq("id", userId)
    .maybeSingle();

  const updates: Record<string, any> = { vendedor_id: userId, status: "ASIGNADO", updated_at: now };
  if (seller?.sucursal_id) {
    updates.sucursal_id = seller.sucursal_id;
  }

  const { error } = await supabase
    .from("leads")
    .update(updates)
    .eq("id", id);

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
    .select("valor, monto_cotizado, monto_facturado")
    .eq("id", id)
    .maybeSingle();

  if (!lead) return res.status(404).json({ error: "Lead not found" });

  const updates: Record<string, any> = { status, updated_at: now };
  if (status === "COTIZADO" && quotedAmount !== undefined) {
    updates.monto_cotizado = quotedAmount;
  }
  if (status === "FACTURADO" && invoicedAmount !== undefined) {
    updates.monto_facturado = invoicedAmount;
    updates.valor = invoicedAmount;
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
// Clients catalogue
// ---------------------------------------------------------------------------

app.get("/api/clients", async (_req, res) => {
  const { data, error } = await supabase
    .from("clientes")
    .select(`
      id,
      contacto,
      email,
      razon_social,
      created_at,
      leads(sucursal_id, created_at)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json(
    (data || []).map((c) => {
      const sortedLeads = ((c.leads as any[]) || []).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      return {
        id: c.id,
        name: c.contacto || "",
        email: c.email || "",
        company: c.razon_social || "",
        sucursalId: sortedLeads[0]?.sucursal_id || undefined,
        createdAt: c.created_at,
      };
    })
  );
});

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

app.get("/api/lookups/sucursales", async (_req, res) => {
  const { data } = await supabase.from("sucursales").select("id, nombre");
  res.json((data || []).map((s) => ({ id: s.id, name: s.nombre })));
});

app.get("/api/lookups/segmentos", async (_req, res) => {
  const { data } = await supabase.from("segmentos").select("id, descripcion");
  res.json((data || []).map((s) => ({ id: s.id, name: s.descripcion })));
});

export default app;
