import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { Lead, User } from "./src/types.ts";
import db, { initDb } from "./src/db.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to get users with calculated performance and workload
function getUsersWithPerformance(): User[] {
  const users = db.prepare(`
    SELECT
      Vn_Cve_Vendedor as id,
      Vn_Descripcion as name,
      Vn_Email as email,
      Vn_Rol_CRM as role,
      Vn_Meta_Ventas_CRM as salesGoal,
      Vn_Sucursal
    FROM Vendedor
  `).all() as any[];
  return users.map(user => {
    const stats = db.prepare(`
      SELECT
        COUNT(*) as totalClosed,
        SUM(Cl_Valor_CRM) as totalValue
      FROM Cliente
      WHERE Vn_Cve_Vendedor = ? AND Cl_Status_CRM IN ('FACTURADO', 'ENTREGADO')
    `).get(user.id) as { totalClosed: number, totalValue: number };

    const totalAssigned = db.prepare('SELECT COUNT(*) as count FROM Cliente WHERE Vn_Cve_Vendedor = ?').get(user.id) as { count: number };

    const workload = db.prepare(`
      SELECT
        COUNT(*) as activeLeads,
        SUM(Cl_Valor_CRM) as pipelineValue
      FROM Cliente
      WHERE Vn_Cve_Vendedor = ? AND Cl_Status_CRM NOT IN ('FACTURADO', 'ENTREGADO', 'RECHAZADO')
    `).get(user.id) as { activeLeads: number, pipelineValue: number };

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      performance: {
        totalClosed: stats.totalClosed || 0,
        totalValue: stats.totalValue || 0,
        conversionRate: totalAssigned.count > 0 ? (stats.totalClosed || 0) / totalAssigned.count : 0,
        salesGoal: user.salesGoal
      },
      workload: {
        activeLeads: workload.activeLeads || 0,
        pipelineValue: workload.pipelineValue || 0
      },
      Vn_Sucursal: user.Vn_Sucursal
    };
  });
}

// Helper to get leads with history
function getLeadsWithHistory(): Lead[] {
  const leads = db.prepare(`
    SELECT
      c.Cl_Cve_Cliente as id,
      c.Cl_Contacto_1 as name,
      c.Cl_email_contacto_1 as email,
      c.Cl_Razon_Social as company,
      c.Cl_Status_CRM as status,
      c.Vn_Cve_Vendedor as assignedTo,
      c.Cl_Valor_CRM as value,
      s.Sc_Descripcion as sucursal,
      sg.Descripcion as segmento,
      c.Cl_QuotedAmount_CRM as quotedAmount,
      c.Cl_InvoicedAmount_CRM as invoicedAmount,
      c.Cl_CreatedAt_CRM as createdAt,
      c.Cl_UpdatedAt_CRM as updatedAt
    FROM Cliente c
    LEFT JOIN Sucursal s ON c.Sc_Cve_Sucursal = s.Sc_Cve_Sucursal
    LEFT JOIN Segmento sg ON c.Sg_Cve_Segmento = sg.Sg_Cve_Segmento
  `).all() as any[];
  return leads.map(lead => {
    const history = db.prepare('SELECT * FROM lead_history WHERE leadId = ? ORDER BY timestamp ASC').all(lead.id) as any[];
    return {
      ...lead,
      history: history.map(h => ({
        ...h,
        quotedAmount: h.quotedAmount ?? undefined,
        invoicedAmount: h.invoicedAmount ?? undefined
      }))
    };
  });
}

export function createApp() {
  const app = express();
  app.use(express.json());

  // API Routes
  app.post("/api/login", (req, res) => {
    const { email } = req.body;
    const user = db.prepare('SELECT Vn_Cve_Vendedor as id FROM Vendedor WHERE Vn_Email = ?').get(email) as any;
    if (user) {
      const usersWithPerf = getUsersWithPerformance();
      const fullUser = usersWithPerf.find(u => u.id === user.id);
      res.json(fullUser);
    } else {
      res.status(401).json({ error: "User not found" });
    }
  });

  app.post("/api/users", (req, res) => {
    const { name, email, role, salesGoal, sucursal } = req.body;
    const id = Math.random().toString(36).substr(2, 9);

    const sucursalRow = db.prepare('SELECT Sc_Cve_Sucursal FROM Sucursal WHERE Sc_Descripcion = ? OR Sc_Cve_Sucursal = ?').get(sucursal, sucursal) as { Sc_Cve_Sucursal: string } | undefined;
    const sucursalCve = sucursalRow?.Sc_Cve_Sucursal || null;

    try {
      db.prepare('INSERT INTO Vendedor (Vn_Cve_Vendedor, Vn_Descripcion, Vn_Email, Vn_Rol_CRM, Vn_Meta_Ventas_CRM, Vn_Sucursal) VALUES (?, ?, ?, ?, ?, ?)')
        .run(id, name, email, role, salesGoal || 0, sucursalCve);
      res.status(201).json(getUsersWithPerformance().find(u => u.id === id));
    } catch (error) {
      res.status(400).json({ error: "Email already exists" });
    }
  });

  app.post("/api/users/:id/role", (req, res) => {
    const { id } = req.params;
    const { role } = req.body;
    const result = db.prepare('UPDATE Vendedor SET Vn_Rol_CRM = ? WHERE Vn_Cve_Vendedor = ?').run(role, id);
    if (result.changes > 0) {
      const usersWithPerf = getUsersWithPerformance();
      res.json(usersWithPerf.find(u => u.id === id));
    } else {
      res.status(404).json({ error: "User not found" });
    }
  });

  app.post("/api/users/:id/goal", (req, res) => {
    const { id } = req.params;
    const { goal } = req.body;
    const result = db.prepare('UPDATE Vendedor SET Vn_Meta_Ventas_CRM = ? WHERE Vn_Cve_Vendedor = ?').run(goal, id);
    if (result.changes > 0) {
      const usersWithPerf = getUsersWithPerformance();
      res.json(usersWithPerf.find(u => u.id === id));
    } else {
      res.status(404).json({ error: "User not found" });
    }
  });

  app.get("/api/leads", (req, res) => {
    res.json(getLeadsWithHistory());
  });

  app.get("/api/users", (req, res) => {
    res.json(getUsersWithPerformance());
  });

  app.get("/api/lookups/sucursales", (req, res) => {
    const sucursales = db.prepare('SELECT Sc_Cve_Sucursal as id, Sc_Descripcion as name FROM Sucursal').all();
    res.json(sucursales);
  });

  app.get("/api/lookups/segmentos", (req, res) => {
    const segmentos = db.prepare('SELECT Sg_Cve_Segmento as id, Descripcion as name FROM Segmento').all();
    res.json(segmentos);
  });

  app.post("/api/leads/:id/assign", (req, res) => {
    const { id } = req.params;
    const { userId } = req.body;
    const now = new Date().toISOString();
    const result = db.prepare('UPDATE Cliente SET Vn_Cve_Vendedor = ?, Cl_Status_CRM = ?, Cl_UpdatedAt_CRM = ? WHERE Cl_Cve_Cliente = ?')
      .run(userId, 'ASIGNADO', now, id);

    if (result.changes > 0) {
      const lead = getLeadsWithHistory().find(l => l.id === id);
      res.json(lead);
    } else {
      res.status(404).json({ error: "Lead not found" });
    }
  });

  app.post("/api/leads/:id/status", (req, res) => {
    const { id } = req.params;
    const { status, comment, evidenceUrl, userId, quotedAmount, invoicedAmount } = req.body;
    const now = new Date().toISOString();

    const lead = db.prepare('SELECT Cl_Valor_CRM as value, Cl_QuotedAmount_CRM as quotedAmount, Cl_InvoicedAmount_CRM as invoicedAmount FROM Cliente WHERE Cl_Cve_Cliente = ?').get(id) as any;
    if (lead) {
      let finalValue = lead.value;
      let qAmount = lead.quotedAmount;
      let iAmount = lead.invoicedAmount;

      if (status === "COTIZADO" && quotedAmount !== undefined) {
        qAmount = quotedAmount;
      }
      if (status === "FACTURADO" && invoicedAmount !== undefined) {
        iAmount = invoicedAmount;
        finalValue = invoicedAmount;
      }

      db.prepare('UPDATE Cliente SET Cl_Status_CRM = ?, Cl_UpdatedAt_CRM = ?, Cl_Valor_CRM = ?, Cl_QuotedAmount_CRM = ?, Cl_InvoicedAmount_CRM = ? WHERE Cl_Cve_Cliente = ?')
        .run(status, now, finalValue, qAmount, iAmount, id);

      db.prepare(`
        INSERT INTO lead_history (id, leadId, status, comment, evidenceUrl, quotedAmount, invoicedAmount, updatedBy, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        Math.random().toString(36).substr(2, 9),
        id,
        status,
        comment || `Status updated to ${status}`,
        evidenceUrl || null,
        status === "COTIZADO" ? quotedAmount : null,
        status === "FACTURADO" ? invoicedAmount : null,
        userId || "System",
        now
      );

      const updatedLead = getLeadsWithHistory().find(l => l.id === id);
      res.json(updatedLead);
    } else {
      res.status(404).json({ error: "Lead not found" });
    }
  });

  app.post("/api/leads", (req, res) => {
    const { userId, ...leadData } = req.body;
    const id = Math.random().toString(36).substr(2, 9);
    const now = new Date().toISOString();
    const status = userId ? "ASIGNADO" : "CONTACTADO";

    const sucursalRow = db.prepare('SELECT Sc_Cve_Sucursal FROM Sucursal WHERE Sc_Descripcion = ? OR Sc_Cve_Sucursal = ?').get(leadData.sucursal, leadData.sucursal) as { Sc_Cve_Sucursal: string } | undefined;
    const sucursalCve = sucursalRow?.Sc_Cve_Sucursal || 'S001';

    const segmentoRow = db.prepare('SELECT Sg_Cve_Segmento FROM Segmento WHERE Descripcion = ? OR Sg_Cve_Segmento = ?').get(leadData.segmento, leadData.segmento) as { Sg_Cve_Segmento: string } | undefined;
    const segmentoCve = segmentoRow?.Sg_Cve_Segmento || 'SEG01';

    db.prepare(`
      INSERT INTO Cliente (
        Cl_Cve_Cliente, Cl_Contacto_1, Cl_email_contacto_1, Cl_Razon_Social,
        Cl_Status_CRM, Vn_Cve_Vendedor, Cl_Valor_CRM, Sc_Cve_Sucursal, Sg_Cve_Segmento,
        Cl_CreatedAt_CRM, Cl_UpdatedAt_CRM
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      leadData.name,
      leadData.email,
      leadData.company,
      status,
      userId || null,
      leadData.value,
      sucursalCve,
      segmentoCve,
      now,
      now
    );

    if (userId) {
      db.prepare(`
        INSERT INTO lead_history (id, leadId, status, comment, updatedBy, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        Math.random().toString(36).substr(2, 9),
        id,
        "ASIGNADO",
        "Lead created and self-assigned",
        userId,
        now
      );
    }

    const newLead = getLeadsWithHistory().find(l => l.id === id);
    res.status(201).json(newLead);
  });

  return app;
}

// Only start the HTTP server when run directly (not when imported by Vercel)
if (!process.env.VERCEL) {
  async function startServer() {
    const PORT = 3000;
    initDb();
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
