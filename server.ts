import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { Lead, User, LeadStatus } from "./src/types";
import { supabase } from "./src/db";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function getUsersWithPerformance(): Promise<User[]> {
  const { data: vendedores } = await supabase.from("vendedores").select("*");
  if (!vendedores) return [];

  return Promise.all(
    vendedores.map(async (v) => {
      const { data: closedLeads } = await supabase
        .from("clientes")
        .select("valor")
        .eq("vendedor_id", v.id)
        .in("status", ["FACTURADO", "ENTREGADO"]);

      const { count: totalAssigned } = await supabase
        .from("clientes")
        .select("*", { count: "exact", head: true })
        .eq("vendedor_id", v.id);

      const { data: activeLeads } = await supabase
        .from("clientes")
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
        sucursalId: v.sucursal_id,
      };
    })
  );
}

async function getLeadsWithHistory(): Promise<Lead[]> {
  const { data: clientes } = await supabase
    .from("clientes")
    .select(`*, sucursales(nombre), segmentos(descripcion), lead_history(*)`)
    .order("created_at", { ascending: false });

  if (!clientes) return [];

  return clientes.map((c) => ({
    id: c.id,
    name: c.contacto || "",
    email: c.email || "",
    company: c.razon_social,
    status: c.status as LeadStatus,
    assignedTo: c.vendedor_id,
    clientId: c.id,
    value: c.valor || 0,
    sucursal: (c.sucursales as any)?.nombre || "",
    segmento: (c.segmentos as any)?.descripcion || "",
    quotedAmount: c.monto_cotizado ?? undefined,
    invoicedAmount: c.monto_facturado ?? undefined,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
    history: ((c.lead_history as any[]) || [])
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

export function createApp() {
  const app = express();
  app.use(express.json());

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

  app.get("/api/leads", async (_req, res) => {
    res.json(await getLeadsWithHistory());
  });

  app.get("/api/clients", async (_req, res) => {
    const { data: clients } = await supabase
      .from("clientes")
      .select("*, sucursales(nombre)")
      .order("contacto", { ascending: true });
    
    if (!clients) return res.json([]);

    res.json(clients.map(c => ({
      id: c.id,
      name: c.contacto || "",
      email: c.email || "",
      company: c.razon_social,
      phone: c.telefono_1,
      rfc: c.r_f_c,
      city: c.ciudad,
      state: c.estado,
      assignedSellerId: c.vendedor_id,
      sucursalId: c.sucursal_id,
      createdAt: c.created_at
    })));
  });

  app.get("/api/lookups/sucursales", async (_req, res) => {
    const { data } = await supabase.from("sucursales").select("id, nombre");
    res.json((data || []).map((s) => ({ id: s.id, name: s.nombre })));
  });

  app.get("/api/lookups/segmentos", async (_req, res) => {
    const { data } = await supabase.from("segmentos").select("id, descripcion");
    res.json((data || []).map((s) => ({ id: s.id, name: s.descripcion })));
  });

  app.post("/api/leads/:id/assign", async (req, res) => {
    const { id } = req.params;
    const { userId } = req.body;
    const now = new Date().toISOString();

    const { error } = await supabase
      .from("clientes")
      .update({ vendedor_id: userId, status: "ASIGNADO", updated_at: now })
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
      .from("clientes")
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

    await supabase.from("clientes").update(updates).eq("id", id);

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

  app.post("/api/leads", async (req, res) => {
    const { userId, isExistingClient, clientId, ...leadData } = req.body;
    const now = new Date().toISOString();
    const status = "ASIGNADO";
    
    let targetClientId = clientId;

    if (!isExistingClient) {
      targetClientId = Math.random().toString(36).substr(2, 9);
      
      const { data: sucursalRow } = await supabase
        .from("sucursales")
        .select("id")
        .or(`nombre.eq.${leadData.sucursal},id.eq.${leadData.sucursal}`)
        .maybeSingle();

      const { data: segmentoRow } = await supabase
        .from("segmentos")
        .select("id")
        .or(`descripcion.eq.${leadData.segmento},id.eq.${leadData.segmento}`)
        .maybeSingle();

      await supabase.from("clientes").insert({
        id: targetClientId,
        contacto: leadData.name,
        email: leadData.email,
        razon_social: leadData.company,
        status,
        vendedor_id: userId || null,
        valor: leadData.value,
        sucursal_id: sucursalRow?.id || "S001",
        segmento_id: segmentoRow?.id || "SEG01",
        created_at: now,
        updated_at: now,
      });
    } else {
      // If existing client, we might want to update its status to ASIGNADO for the new lead context
      // or just create a new lead entry if we had a separate leads table.
      // Since current schema uses 'clientes' table as leads, we might be creating a "new lead" 
      // which in this schema is actually just another entry in 'clientes' or updating the existing one.
      // The user said "create a new lead that creates a new client or choose from the existing pool".
      // If choosing from existing pool, it implies the client already exists.
      // In this schema, 'clientes' IS the lead. So if we choose an existing client, 
      // are we creating a NEW lead for that same client? 
      // If 'clientes' table represents both the entity and the lead, then a client can have multiple leads?
      // Usually, one row in 'clientes' = one lead/opportunity in this specific app's current state.
      
      // Let's assume for now that if it's an existing client, we just update its status and value for a new opportunity,
      // OR we create a new row with the same client info but a new ID.
      // Given the requirement "choose from existing pool", let's create a NEW lead row but linked to that client info.
      // Wait, the schema doesn't have a separate 'leads' table. It uses 'clientes'.
      // If I create a new row in 'clientes', it's a new lead.
      
      targetClientId = Math.random().toString(36).substr(2, 9);
      
      const { data: existingClient } = await supabase
        .from("clientes")
        .select("*")
        .eq("id", clientId)
        .maybeSingle();

      if (existingClient) {
        await supabase.from("clientes").insert({
          id: targetClientId,
          contacto: existingClient.contacto,
          email: existingClient.email,
          razon_social: existingClient.razon_social,
          status,
          vendedor_id: userId || existingClient.vendedor_id || null,
          valor: leadData.value,
          sucursal_id: existingClient.sucursal_id,
          segmento_id: existingClient.segmento_id,
          created_at: now,
          updated_at: now,
        });
      }
    }

    await supabase.from("lead_history").insert({
      id: Math.random().toString(36).substr(2, 9),
      lead_id: targetClientId,
      status: "ASIGNADO",
      comment: userId ? "Lead created and self-assigned" : "Lead created in ASIGNADO stage",
      updated_by: userId || "System",
      timestamp: now,
    });

    const leads = await getLeadsWithHistory();
    res.status(201).json(leads.find((l) => l.id === targetClientId));
  });

  return app;
}

// Only start the HTTP server when run directly (not when imported by Vercel)
if (!process.env.VERCEL) {
  async function startServer() {
    const PORT = 3000;
    const app = createApp();

    if (process.env.NODE_ENV !== "production") {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }

  startServer();
}
