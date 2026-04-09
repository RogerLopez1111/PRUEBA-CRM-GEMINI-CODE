import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { Lead, User } from "./src/types.ts";
import db, { initDb } from "./src/db.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Initialize Database
  initDb();

  // Helper to get users with calculated performance and workload
  function getUsersWithPerformance(): User[] {
    const users = db.prepare('SELECT * FROM users').all() as any[];
    return users.map(user => {
      const stats = db.prepare(`
        SELECT 
          COUNT(*) as totalClosed,
          SUM(value) as totalValue
        FROM leads 
        WHERE assignedTo = ? AND status IN ('FACTURADO', 'ENTREGADO')
      `).get(user.id) as { totalClosed: number, totalValue: number };

      const totalAssigned = db.prepare('SELECT COUNT(*) as count FROM leads WHERE assignedTo = ?').get(user.id) as { count: number };
      
      const workload = db.prepare(`
        SELECT 
          COUNT(*) as activeLeads,
          SUM(value) as pipelineValue
        FROM leads 
        WHERE assignedTo = ? AND status NOT IN ('FACTURADO', 'ENTREGADO', 'RECHAZADO')
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
        }
      };
    });
  }

  // Helper to get leads with history
  function getLeadsWithHistory(): Lead[] {
    const leads = db.prepare('SELECT * FROM leads').all() as any[];
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

  // API Routes
  app.post("/api/login", (req, res) => {
    const { email } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
    if (user) {
      const usersWithPerf = getUsersWithPerformance();
      const fullUser = usersWithPerf.find(u => u.id === user.id);
      res.json(fullUser);
    } else {
      res.status(401).json({ error: "User not found" });
    }
  });

  app.post("/api/users", (req, res) => {
    const { name, email, role, salesGoal } = req.body;
    const id = Math.random().toString(36).substr(2, 9);
    try {
      db.prepare('INSERT INTO users (id, name, email, role, salesGoal) VALUES (?, ?, ?, ?, ?)')
        .run(id, name, email, role, salesGoal || 0);
      res.status(201).json(getUsersWithPerformance().find(u => u.id === id));
    } catch (error) {
      res.status(400).json({ error: "Email already exists" });
    }
  });

  app.post("/api/users/:id/role", (req, res) => {
    const { id } = req.params;
    const { role } = req.body;
    const result = db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
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
    const result = db.prepare('UPDATE users SET salesGoal = ? WHERE id = ?').run(goal, id);
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

  app.post("/api/leads/:id/assign", (req, res) => {
    const { id } = req.params;
    const { userId } = req.body;
    const now = new Date().toISOString();
    const result = db.prepare('UPDATE leads SET assignedTo = ?, status = ?, updatedAt = ? WHERE id = ?')
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
    
    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(id) as any;
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

      db.prepare('UPDATE leads SET status = ?, updatedAt = ?, value = ?, quotedAmount = ?, invoicedAmount = ? WHERE id = ?')
        .run(status, now, finalValue, qAmount, iAmount, id);
      
      // Add to history
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

    db.prepare(`
      INSERT INTO leads (id, name, email, company, status, assignedTo, value, sucursal, segmento, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      leadData.name,
      leadData.email,
      leadData.company,
      status,
      userId || null,
      leadData.value,
      leadData.sucursal,
      leadData.segmento,
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

  // Vite middleware for development
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
