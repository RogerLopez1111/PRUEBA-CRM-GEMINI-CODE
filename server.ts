import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { Lead, User } from "./src/types.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Mock Data
  let leads: Lead[] = [
    { 
      id: "1", 
      name: "John Doe", 
      email: "john@example.com", 
      company: "TechCorp", 
      status: "CONTACTADO", 
      value: 5000, 
      sucursal: "CDMX",
      segmento: "CONTROLADORES DE PLAGAS",
      createdAt: new Date().toISOString(), 
      updatedAt: new Date().toISOString(),
      history: [] 
    },
    { 
      id: "2", 
      name: "Jane Smith", 
      email: "jane@example.com", 
      company: "Innovate Ltd", 
      status: "NEGOCIACION", 
      assignedTo: "seller-1", 
      value: 12000, 
      sucursal: "Jalisco",
      segmento: "GRANOS ALMACENADOS",
      createdAt: new Date().toISOString(), 
      updatedAt: new Date().toISOString(),
      history: [
        { id: "h1", status: "NEGOCIACION", comment: "Initial assignment", updatedBy: "admin-1", timestamp: new Date().toISOString() }
      ] 
    },
    { 
      id: "3", 
      name: "Bob Wilson", 
      email: "bob@example.com", 
      company: "Global Systems", 
      status: "CONTACTADO", 
      value: 8000, 
      sucursal: "Nuevo León",
      segmento: "DISTRIBUIDORES",
      createdAt: new Date().toISOString(), 
      updatedAt: new Date().toISOString(),
      history: [] 
    },
  ];

  let users: User[] = [
    { id: "admin-1", name: "Admin User", email: "admin@leadflow.com", role: "Admin", performance: { totalClosed: 0, totalValue: 0, conversionRate: 0, salesGoal: 100000 } },
    { id: "seller-1", name: "Alice Seller", email: "alice@leadflow.com", role: "Seller", performance: { totalClosed: 5, totalValue: 45000, conversionRate: 0.25, salesGoal: 50000 } },
    { id: "seller-2", name: "Charlie Seller", email: "charlie@leadflow.com", role: "Seller", performance: { totalClosed: 3, totalValue: 28000, conversionRate: 0.18, salesGoal: 50000 } },
  ];

  // API Routes
  app.post("/api/login", (req, res) => {
    const { email } = req.body;
    const user = users.find(u => u.email === email);
    if (user) {
      res.json(user);
    } else {
      res.status(401).json({ error: "User not found" });
    }
  });

  app.post("/api/users/:id/role", (req, res) => {
    const { id } = req.params;
    const { role } = req.body;
    const user = users.find(u => u.id === id);
    if (user) {
      user.role = role;
      res.json(user);
    } else {
      res.status(404).json({ error: "User not found" });
    }
  });

  app.post("/api/users/:id/goal", (req, res) => {
    const { id } = req.params;
    const { goal } = req.body;
    const user = users.find(u => u.id === id);
    if (user) {
      user.performance.salesGoal = goal;
      res.json(user);
    } else {
      res.status(404).json({ error: "User not found" });
    }
  });

  app.get("/api/leads", (req, res) => {
    res.json(leads);
  });

  app.get("/api/users", (req, res) => {
    res.json(users);
  });

  app.post("/api/leads/:id/assign", (req, res) => {
    const { id } = req.params;
    const { userId } = req.body;
    const lead = leads.find(l => l.id === id);
    if (lead) {
      lead.assignedTo = userId;
      lead.status = "ASIGNADO";
      lead.updatedAt = new Date().toISOString();
      res.json(lead);
    } else {
      res.status(404).json({ error: "Lead not found" });
    }
  });

  app.post("/api/leads/:id/status", (req, res) => {
    const { id } = req.params;
    const { status, comment, evidenceUrl, userId, quotedAmount, invoicedAmount } = req.body;
    const lead = leads.find(l => l.id === id);
    if (lead) {
      lead.status = status;
      lead.updatedAt = new Date().toISOString();
      
      if (status === "COTIZADO" && quotedAmount !== undefined) {
        lead.quotedAmount = quotedAmount;
      }
      if (status === "FACTURADO" && invoicedAmount !== undefined) {
        lead.invoicedAmount = invoicedAmount;
        // Also update the lead value to the actual invoiced amount
        lead.value = invoicedAmount;
      }
      
      // Add to history
      lead.history.push({
        id: Math.random().toString(36).substr(2, 9),
        status,
        comment: comment || `Status updated to ${status}`,
        evidenceUrl,
        quotedAmount: status === "COTIZADO" ? quotedAmount : undefined,
        invoicedAmount: status === "FACTURADO" ? invoicedAmount : undefined,
        updatedBy: userId || "System",
        timestamp: new Date().toISOString()
      });
      
      // Update performance if closed (FACTURADO or ENTREGADO)
      if ((status === "FACTURADO" || status === "ENTREGADO") && lead.assignedTo) {
        const user = users.find(u => u.id === lead.assignedTo);
        if (user) {
          user.performance.totalClosed += 1;
          user.performance.totalValue += lead.value;
        }
      }
      
      res.json(lead);
    } else {
      res.status(404).json({ error: "Lead not found" });
    }
  });

  app.post("/api/leads", (req, res) => {
    const { userId, ...leadData } = req.body;
    const newLead: Lead = {
      ...leadData,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: userId ? "ASIGNADO" : "CONTACTADO",
      assignedTo: userId || undefined,
      history: userId ? [{
        id: Math.random().toString(36).substr(2, 9),
        status: "ASIGNADO",
        comment: "Lead created and self-assigned",
        updatedBy: userId,
        timestamp: new Date().toISOString()
      }] : []
    };
    leads.push(newLead);
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
