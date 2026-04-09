import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(process.cwd(), 'database.sqlite');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

export function initDb() {
  // Create Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      role TEXT CHECK(role IN ('Admin', 'Seller')) NOT NULL,
      salesGoal REAL DEFAULT 0
    )
  `);

  // Create Leads table
  db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      company TEXT NOT NULL,
      status TEXT NOT NULL,
      assignedTo TEXT,
      value REAL NOT NULL,
      sucursal TEXT NOT NULL,
      segmento TEXT NOT NULL,
      quotedAmount REAL,
      invoicedAmount REAL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (assignedTo) REFERENCES users(id)
    )
  `);

  // Create Lead History table
  db.exec(`
    CREATE TABLE IF NOT EXISTS lead_history (
      id TEXT PRIMARY KEY,
      leadId TEXT NOT NULL,
      status TEXT NOT NULL,
      comment TEXT,
      evidenceUrl TEXT,
      quotedAmount REAL,
      invoicedAmount REAL,
      updatedBy TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (leadId) REFERENCES leads(id) ON DELETE CASCADE
    )
  `);

  // Seed initial data if empty
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCount.count === 0) {
    const insertUser = db.prepare('INSERT INTO users (id, name, email, role, salesGoal) VALUES (?, ?, ?, ?, ?)');
    insertUser.run('admin-1', 'Admin User', 'admin@leadflow.com', 'Admin', 100000);
    insertUser.run('seller-1', 'Alice Seller', 'alice@leadflow.com', 'Seller', 50000);
    insertUser.run('seller-2', 'Charlie Seller', 'charlie@leadflow.com', 'Seller', 50000);

    const insertLead = db.prepare(`
      INSERT INTO leads (id, name, email, company, status, assignedTo, value, sucursal, segmento, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const now = new Date().toISOString();
    insertLead.run('1', 'John Doe', 'john@example.com', 'TechCorp', 'CONTACTADO', null, 5000, 'CDMX', 'CONTROLADORES DE PLAGAS', now, now);
    insertLead.run('2', 'Jane Smith', 'jane@example.com', 'Innovate Ltd', 'NEGOCIACION', 'seller-1', 12000, 'Jalisco', 'GRANOS ALMACENADOS', now, now);
    insertLead.run('3', 'Bob Wilson', 'bob@example.com', 'Global Systems', 'CONTACTADO', null, 8000, 'Nuevo León', 'DISTRIBUIDORES', now, now);

    const insertHistory = db.prepare(`
      INSERT INTO lead_history (id, leadId, status, comment, updatedBy, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertHistory.run('h1', '2', 'NEGOCIACION', 'Initial assignment', 'admin-1', now);
  }
}

export default db;
